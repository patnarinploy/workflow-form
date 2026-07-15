import Link from "next/link";
import { getStaff } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; jobs?: string; steps?: string }>;
}) {
  const { person, jobs, steps } = await searchParams;
  const staff = person ? getStaff(person) : undefined;
  const nJobs = Number(jobs) || 0;
  const nSteps = Number(steps) || 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-line)] flex items-center justify-center mx-auto mb-5 text-2xl text-[var(--accent)]">
          ✓
        </div>
        <h1 className="font-disp font-bold text-2xl mb-2">ส่งคำตอบเรียบร้อยแล้ว</h1>
        <p className="text-[var(--muted)] mb-2">
          ขอบคุณ{staff ? ` ${staff.nick}` : ""} — บันทึกไว้ <b className="text-[var(--ink)]">{nJobs} งาน</b> รวม{" "}
          <b className="text-[var(--ink)]">{nSteps} ขั้นตอน</b>
        </p>
        <p className="text-[13.5px] text-[var(--faint)] mb-8">
          ระบบจะเอาคำตอบของคุณไปต่อกับของคนอื่นเป็นผังงานอัตโนมัติ ถ้ามีอะไรต้องแก้ กดกลับไปแก้ได้เลย
        </p>
        <div className="flex gap-2.5 justify-center flex-wrap">
          {staff && (
            <Link
              href={`/form/${staff.id}`}
              className="inline-block text-sm font-semibold px-6 py-3 rounded-[10px] bg-[var(--accent)] text-white"
            >
              กลับไปแก้คำตอบ
            </Link>
          )}
          <Link
            href="/"
            className="inline-block text-sm font-semibold px-6 py-3 rounded-[10px] border border-[var(--field-bd)] text-[var(--ink)]"
          >
            กรอกในชื่อคนอื่น
          </Link>
        </div>
      </div>
    </div>
  );
}
