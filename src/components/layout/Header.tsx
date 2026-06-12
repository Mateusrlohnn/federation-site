"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { ICONS } from "@/components/ui/Icon";

const links: { href: string; icon: keyof typeof ICONS; label: string }[] = [
  { href: "/", icon: "house", label: "Home" },
  { href: "/tournaments", icon: "trophy", label: "Tournaments" },
  { href: "/teams", icon: "shield", label: "Teams" },
  { href: "/players", icon: "user", label: "Players" },
  { href: "/draft", icon: "futbol", label: "Draft" },
  { href: "/feed", icon: "note-sticky", label: "Feed" },
  { href: "/rules", icon: "book-open", label: "Rules" },
];

export default function Header() {
  const pathname = usePathname();

  function changeLanguage(lang: string) {
    const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (combo) {
      combo.value = lang === "pt" ? "pt" : lang;
      combo.dispatchEvent(new Event("change"));
    }
  }

  return (
    <header className="text-xs bg-[#1C1C1C] fixed top-0 w-full flex gap-2 items-center font-bold z-[99] border-b border-[#262626]">
      <Link href="/" className="border-r border-[#262626] px-4 py-1.5 flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rebug-dc.webp" alt="Federação Rebug" className="h-8 w-auto" />
      </Link>

      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "flex gap-[6px] items-center px-4 py-2 rounded transition-colors bg-yellow-500 text-[#2f2f2f]"
                : "flex gap-[6px] items-center px-4 py-2 rounded transition-colors text-[#dcdcdc] hover:bg-[#272727] hover:text-white"
            }
          >
            <Icon name={link.icon} />
            <span className="sm:flex hidden">{link.label}</span>
          </Link>
        );
      })}

      <div className="ml-auto px-4">
        <select
          defaultValue="en"
          onChange={(e) => changeLanguage(e.target.value)}
          className="cursor-pointer rounded-xl border-2 bg-[#1a1a1a] border-[#202020] py-1 px-2 font-bold text-xs text-[#dcdcdc] hover:text-white"
        >
          <option value="en">EN</option>
          <option value="pt">PT-BR</option>
          <option value="es">ES</option>
        </select>
      </div>
    </header>
  );
}
