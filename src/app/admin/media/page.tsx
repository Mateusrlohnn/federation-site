"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET } from "@/lib/storage";
import Icon from "@/components/ui/Icon";
import { focusStyle } from "@/lib/imageFocus";

// Tipagem para unificar os arquivos encontrados no Storage
type StorageFile = {
    id: string;
    name: string;
    folder: string;
    path: string;
    publicUrl: string;
    size: number;
    created_at: string;
};

// Tipagem para rastrear onde a imagem está sendo usada
type ImageUsage = {
    type: string; // Ex: "Time", "Jogador", "Torneio"
    name: string; // Nome do registro
    id: string;
};

type FilterStatus = "all" | "used" | "orphan";

export default function AdminImagesPage() {
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [usages, setUsages] = useState<Record<string, ImageUsage[]>>({});
    const [busy, setBusy] = useState(true);
    const [q, setQ] = useState("");
    const [err, setErr] = useState("");
    const [msg, setMsg] = useState("");

    // Novos estados para os filtros e pastas
    const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
    const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

    const supabase = createClient();

    const load = useCallback(async () => {
        setBusy(true);
        setErr("");

        try {
            // 1. Buscar todas as pastas na raiz do bucket 'media'
            const { data: rootItems, error: rootErr } = await supabase.storage.from(MEDIA_BUCKET).list();
            if (rootErr) throw rootErr;

            const allFiles: StorageFile[] = [];
            const folders = rootItems?.filter((item) => !item.id) || []; // Itens sem ID normalmente são pastas

            // 2. Iterar sobre as pastas para pegar os arquivos reais
            for (const folder of folders) {
                const { data: folderFiles, error: folderErr } = await supabase.storage
                    .from(MEDIA_BUCKET)
                    .list(folder.name);

                if (folderErr) continue;

                for (const file of folderFiles || []) {
                    if (!file.id) continue; // Ignora subpastas aninhadas para simplificar

                    const path = `${folder.name}/${file.name}`;
                    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

                    allFiles.push({
                        id: file.id,
                        name: file.name,
                        folder: folder.name,
                        path: path,
                        publicUrl: data.publicUrl,
                        size: file.metadata?.size || 0,
                        created_at: file.created_at,
                    });
                }
            }

            setFiles(allFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

            // 3. Buscar os dados do banco para fazer o cruzamento (Linkagem)
            const { data: teams } = await supabase.from("teams").select("id, name, logo_url");
            const { data: tournaments } = await supabase.from("tournaments").select("id, name, logo_url");
            const { data: draft_teams } = await supabase.from("draft_teams").select("id, name, logo_url");

            const usageMap: Record<string, ImageUsage[]> = {};

            const registerUsage = (url: string | null, usage: ImageUsage) => {
                if (!url) return;
                const baseUrl = url.split("?")[0].split("#")[0];

                const matchedFile = allFiles.find((f) => baseUrl.includes(f.path));
                if (matchedFile) {
                    (usageMap[matchedFile.path] ??= []).push(usage);
                }
            };

            // Mapear imagens dos times
            teams?.forEach((team) => {
                registerUsage(team.logo_url, { type: "Time", name: team.name, id: team.id });
            });

            // Mapear imagens dos torneios
            tournaments?.forEach((tournament) => {
                registerUsage(tournament.logo_url, { type: "Torneio", name: tournament.name, id: tournament.id });
            });

            // Mapear imagens dos times de draft
            draft_teams?.forEach((draftTeam) => {
                registerUsage(draftTeam.logo_url, { type: "Time de Draft", name: draftTeam.name, id: draftTeam.id });
            });

            setUsages(usageMap);
        } catch (e: any) {
            setErr(e.message || "Erro ao carregar imagens.");
        } finally {
            setBusy(false);
        }
    }, [supabase]);

    useEffect(() => {
        load();
    }, [load]);

    async function deleteFile(file: StorageFile) {
        const isUsed = (usages[file.path] || []).length > 0;
        if (isUsed) {
            if (!confirm(`CUIDADO: Esta imagem está em uso! Tem certeza que deseja deletar ${file.name}?`)) return;
        } else {
            if (!confirm(`Remover permanentemente o arquivo ${file.name}?`)) return;
        }

        setBusy(true);
        setErr("");
        setMsg("");

        const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([file.path]);

        if (error) {
            setErr(error.message);
            setBusy(false);
        } else {
            setMsg(`Arquivo removido com sucesso.`);
            await load();
        }
    }

    const toggleFolder = (folderName: string) => {
        setCollapsedFolders((prev) => ({
            ...prev,
            [folderName]: !prev[folderName],
        }));
    };

    // Aplicação dos filtros de texto E de status (Todas, Em uso, Órfãs)
    const filteredFiles = files.filter((f) => {
        // 1. Filtro de Busca por Texto
        const matchesSearch = f.name.toLowerCase().includes(q.toLowerCase()) || f.folder.toLowerCase().includes(q.toLowerCase());
        if (!matchesSearch) return false;

        // 2. Filtro de Status de Uso
        const isUsed = (usages[f.path] || []).length > 0;
        if (filterStatus === "used" && !isUsed) return false;
        if (filterStatus === "orphan" && isUsed) return false;

        return true;
    });

    const formatSize = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";

    // Extrair as pastas únicas dos arquivos já filtrados pela barra de busca e status
    const uniqueFolders = Array.from(new Set(filteredFiles.map((f) => f.folder)));

    return (
        <div className="flex flex-col gap-4 p-4 rounded-lg bg-card">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Gerenciador de Mídia</h2>
                <button onClick={load} disabled={busy} className="text-xs text-gold hover:underline">
                    {busy ? "Atualizando..." : "Recarregar"}
                </button>
            </div>

            {(msg || err) && (
                <div className={`p-3 text-xs rounded-md ${err ? "bg-loss/10 text-loss" : "bg-win/10 text-win"}`}>
                    {err || msg}
                </div>
            )}

            {/* Barra de Busca e Filtros Rápidos */}
            <div className="flex flex-col gap-3">
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nome ou pasta..."
                    className="w-full p-2 text-xs text-white rounded-md bg-panel focus:outline-none focus:ring-1 focus:ring-gold/50"
                />

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilterStatus("all")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filterStatus === "all" ? "bg-gold text-black" : "bg-panel text-faint hover:text-white"}`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus("used")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filterStatus === "used" ? "bg-win/20 text-win" : "bg-panel text-faint hover:text-white"}`}
                    >
                        Em Uso
                    </button>
                    <button
                        onClick={() => setFilterStatus("orphan")}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${filterStatus === "orphan" ? "bg-loss/20 text-loss" : "bg-panel text-faint hover:text-white"}`}
                    >
                        Órfãs
                    </button>
                </div>
            </div>

            {busy && files.length === 0 ? (
                <p className="text-sm text-faint">Carregando bucket...</p>
            ) : (
                <div className="flex flex-col gap-8 mt-4">
                    {uniqueFolders.length === 0 && !busy && (
                        <p className="text-sm italic text-center text-faint">Nenhum arquivo encontrado.</p>
                    )}

                    {uniqueFolders.map((folderName) => {
                        const filesInFolder = filteredFiles.filter((f) => f.folder === folderName);
                        const isCollapsed = collapsedFolders[folderName] || false;

                        return (
                            <div key={folderName} className="flex flex-col gap-3">
                                {/* Cabeçalho da Pasta Clicável para Abrir/Fechar */}
                                <button
                                    onClick={() => toggleFolder(folderName)}
                                    className="flex items-center justify-between pb-2 transition-opacity border-b group border-white/10 hover:opacity-80"
                                >
                                    <h3 className="tracking-wide uppercase text-md font-semibold text-gold">
                                        {folderName} <span className="ml-2 text-xs opacity-50 text-faint">({filesInFolder.length})</span>
                                    </h3>
                                    <span className="text-xs text-faint group-hover:text-gold transition-colors">
                                        {isCollapsed ? "▼ Mostrar" : "▲ Ocultar"}
                                    </span>
                                </button>

                                {/* Grid de Imagens da Pasta (Condicional) */}
                                {!isCollapsed && (
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                        {filesInFolder.map((file) => {
                                            const fileUsages = usages[file.path] || [];
                                            const isOrphan = fileUsages.length === 0;

                                            return (
                                                <div key={file.path} className="flex flex-col overflow-hidden border rounded-md border-white/5 bg-panel">
                                                    <div className="relative flex items-center justify-center h-32 overflow-hidden bg-base">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={file.publicUrl}
                                                            alt={file.name}
                                                            className="object-cover w-full h-full"
                                                        />
                                                        {isOrphan && (
                                                            <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-loss/80 text-white">
                                                                Órfão
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col flex-1 gap-2 p-3 text-xs">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold truncate text-white/90" title={file.name}>
                                                                {file.name}
                                                            </span>
                                                            <span className="flex justify-between text-[10px] text-faint">
                                                                <span>/{file.folder}</span>
                                                                <span>{formatSize(file.size)}</span>
                                                            </span>
                                                        </div>

                                                        <div className="flex-1 mt-1 border-t border-white/5 pt-1.5">
                                                            <span className="block mb-1 text-[10px] font-bold uppercase text-faint">Uso no banco:</span>
                                                            {isOrphan ? (
                                                                <span className="text-[11px] italic text-faint">Nenhum vínculo encontrado.</span>
                                                            ) : (
                                                                <ul className="flex flex-col gap-1">
                                                                    {fileUsages.map((u, i) => (
                                                                        <li key={i} className="truncate text-[11px] text-gold">
                                                                            <b className="text-white">{u.type}:</b> {u.name}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={() => deleteFile(file)}
                                                            className="w-full py-1.5 mt-2 font-semibold transition-colors rounded bg-loss/10 text-loss hover:bg-loss hover:text-white"
                                                        >
                                                            Excluir
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}