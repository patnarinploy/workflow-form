import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Step = {
  step_order: number;
  action: string | null;
  actor: string | null;
  output: string | null;
  handoff_to: string | null;
  approver: string | null;
};

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <div className="text-[12px] font-semibold text-[var(--muted)] mb-0.5">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (!submission) notFound();

  const { data: steps } = await supabase
    .from("steps")
    .select("step_order, action, actor, output, handoff_to, approver")
    .eq("submission_id", id)
    .order("step_order", { ascending: true });

  return (
    <div className="max-w-[940px] mx-auto px-5 py-10">
      <Link href="/admin" className="text-sm text-[var(--accent)] font-semibold">
        ← กลับไปรายการทีม
      </Link>

      <h1 className="font-disp font-bold text-2xl mt-3 mb-1">{submission.team_name}</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        กรอกโดย {submission.submitted_by} · {new Date(submission.created_at).toLocaleString("th-TH")}
      </p>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[18px] p-6 mb-4">
        <h2 className="font-disp font-semibold text-lg mb-3">ขอบเขตงาน</h2>
        <Row label="ชื่อกระบวนการ" value={submission.process_name} />
        <Row label="ตัวจุดชนวนให้งานเริ่ม" value={submission.trigger_event} />
        <Row label="ถือว่างานจบเมื่อไหร่" value={submission.end_condition} />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[18px] p-6 mb-4">
        <h2 className="font-disp font-semibold text-lg mb-3">ตำแหน่งที่เกี่ยวข้อง</h2>
        <div className="text-sm whitespace-pre-wrap">{submission.roles}</div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[18px] p-6 mb-4 overflow-x-auto">
        <h2 className="font-disp font-semibold text-lg mb-3">ขั้นตอนการทำงาน ({steps?.length ?? 0})</h2>
        <table className="w-full text-[13px] border-collapse min-w-[600px]">
          <thead>
            <tr className="text-left text-[var(--faint)] text-xs border-b border-[var(--line)]">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">ขั้นตอน</th>
              <th className="py-2 pr-3">ใครทำ</th>
              <th className="py-2 pr-3">ผลลัพธ์</th>
              <th className="py-2 pr-3">ส่งต่อให้ใคร</th>
              <th className="py-2 pr-3">ใครอนุมัติ</th>
            </tr>
          </thead>
          <tbody>
            {(steps as Step[] | null)?.map((s) => (
              <tr key={s.step_order} className="border-b border-[var(--line)] last:border-0">
                <td className="py-2 pr-3 text-[var(--faint)]">{s.step_order}</td>
                <td className="py-2 pr-3">{s.action}</td>
                <td className="py-2 pr-3">{s.actor}</td>
                <td className="py-2 pr-3">{s.output}</td>
                <td className="py-2 pr-3">{s.handoff_to}</td>
                <td className="py-2 pr-3">{s.approver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[18px] p-6 mb-4">
        <h2 className="font-disp font-semibold text-lg mb-3">งานคู่ขนาน / จุดย้อนกลับ / จุดเชื่อมทีมอื่น</h2>
        <Row label="งานที่ทำคู่ขนาน" value={submission.parallel_work} />
        <Row label="จุดที่ต้องย้อนกลับไปแก้" value={submission.rework_notes} />
        <Row label="รับงาน/ข้อมูล มาจากทีมไหน" value={submission.input_from} />
        <Row label="ส่งงาน/ข้อมูล ให้ทีมไหน" value={submission.output_to} />
      </div>
    </div>
  );
}
