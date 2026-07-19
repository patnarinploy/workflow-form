"use client";

import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "ผังงาน + ความคืบหน้า" },
  { href: "/admin/projects", label: "จัดการโปรเจกต์" },
  { href: "/admin/matrix", label: "ตารางภาระงาน" },
  { href: "/admin/insights", label: "ข้อสังเกต" },
  { href: "/admin/staff", label: "จัดการพนักงาน" },
  { href: "/admin/positions", label: "จัดการตำแหน่ง" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-5">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <a
            key={l.href}
            href={l.href}
            className={`text-[12.5px] font-semibold px-3 py-1.5 rounded-full border ${
              active ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "text-[var(--muted)] border-[var(--line)] hover:border-[var(--accent-line)]"
            }`}
          >
            {l.label}
          </a>
        );
      })}
      <a
        href="/"
        className="ml-auto text-[12.5px] font-semibold px-3 py-1.5 rounded-full border border-[var(--accent-line)] text-[var(--accent)] bg-[var(--accent-soft)] hover:opacity-90"
      >
        ← กลับไปหน้ากรอกฟอร์ม
      </a>
    </div>
  );
}
