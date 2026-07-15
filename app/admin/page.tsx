import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { TEAMS } from "@/lib/types";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  team_name: string;
  submitted_by: string;
  created_at: string;
  steps: { count: number }[];
};

export default async function AdminPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id, team_name, submitted_by, created_at, steps(count)")
    .order("created_at", { ascending: false });

  const rows = (data as Row[] | null) ?? [];
  const submittedTeams = new Set(rows.map((r) => r.team_name.trim().toLowerCase()));
  const missingTeams = TEAMS.filter((t) => !submittedTeams.has(t.toLowerCase()));

  return (
    <div className="max-w-[1100px] mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-disp font-bold text-2xl">ผลตอบรับ Workflow</h1>
        <LogoutButton />
      </div>
      <p className="text-sm text-[var(--muted)] mb-6">
        รายการทีมที่ส่งแบบฟอร์มแล้วทั้งหมด {rows.length} ทีม
      </p>

      {missingTeams.length > 0 && (
        <div className="bg-[#FBF3E9] border border-[#E9CFA0] text-[#8A5A1C] rounded-2xl px-5 py-4 mb-6 text-sm">
          <b className="font-semibold">ยังไม่ได้ส่ง:</b> {missingTeams.join(", ")}
        </div>
      )}

      {error && (
        <div className="bg-[var(--danger-soft)] text-[var(--danger)] rounded-2xl px-5 py-4 mb-6 text-sm">
          โหลดข้อมูลไม่สำเร็จ: {error.message}
        </div>
      )}

      <div className="flex gap-2.5 mb-5">
        <a
          href="/api/admin/export/json"
          className="text-[13px] font-semibold px-4 py-2 rounded-[10px] bg-[var(--accent)] text-white"
        >
          ดาวน์โหลด JSON ทั้งหมด
        </a>
        <a
          href="/api/admin/export/csv"
          className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border border-[var(--accent)] text-[var(--accent)]"
        >
          ดาวน์โหลด CSV ของตารางขั้นตอน
        </a>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[18px] overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-[var(--faint)] text-xs border-b border-[var(--line)]">
              <th className="px-5 py-3 font-semibold">ชื่อทีม</th>
              <th className="px-5 py-3 font-semibold">คนกรอก</th>
              <th className="px-5 py-3 font-semibold">จำนวนขั้นตอน</th>
              <th className="px-5 py-3 font-semibold">วันเวลาที่ส่ง</th>
              <th className="px-5 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                <td className="px-5 py-3">{r.team_name}</td>
                <td className="px-5 py-3">{r.submitted_by}</td>
                <td className="px-5 py-3">{r.steps?.[0]?.count ?? 0}</td>
                <td className="px-5 py-3 text-[var(--muted)]">
                  {new Date(r.created_at).toLocaleString("th-TH")}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/admin/${r.id}`} className="text-[var(--accent)] font-semibold">
                    ดูรายละเอียด
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[var(--faint)]">
                  ยังไม่มีทีมส่งข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
