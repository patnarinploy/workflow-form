"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "เข้าสู่ระบบไม่สำเร็จ");
      }
      // Hard navigation (not router.push) so the browser makes a fresh request
      // with the new cookie — avoids replaying the stale unauthenticated
      // /admin -> /admin/login redirect from the client router cache (which was
      // the "have to click twice" bug).
      const next = params.get("next");
      window.location.assign(next && next.startsWith("/") ? next : "/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[var(--surface)] border border-[var(--line)] rounded-[18px] p-7"
      >
        <h1 className="font-disp font-bold text-xl mb-1">เข้าสู่ระบบผู้ดูแล</h1>
        <p className="text-sm text-[var(--muted)] mb-5">กรอกรหัสผ่านเพื่อดูผลตอบรับ</p>
        <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
          รหัสผ่าน
        </label>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          className="w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
        />
        {error && <p className="text-sm text-[var(--danger)] mt-2">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full text-sm font-semibold px-5 py-2.5 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-60"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
