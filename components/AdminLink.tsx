"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Small "admin" entry point shown top-right on every page except the admin
// area itself (which has its own logout control).
export function AdminLink() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <Link
      href="/admin"
      aria-label="เข้าระบบแอดมิน"
      className="fixed top-3 right-3 z-40 no-print flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent-line)] shadow-sm"
    >
      <span aria-hidden="true">🔒</span>
      แอดมิน
    </Link>
  );
}
