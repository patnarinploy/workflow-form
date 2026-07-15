"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
    >
      ออกจากระบบ
    </button>
  );
}
