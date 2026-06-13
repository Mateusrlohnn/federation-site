import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence the "multiple lockfiles" workspace-root warning by pinning the root
  // to this project directory.
  turbopack: {
    root: __dirname,
  },
  // Allow quality=100 for the crisp Habbo avatar PNGs (Next 16 requires
  // whitelisting non-default qualities).
  images: {
    qualities: [75, 100],
  },
  // Headers de segurança aplicados a todas as rotas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede que o site seja embutido em <iframe> de outros domínios
          // (defesa contra clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Impede o navegador de "adivinhar" tipos de arquivo (MIME sniffing).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Não vaza a URL completa de origem para outros sites.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
