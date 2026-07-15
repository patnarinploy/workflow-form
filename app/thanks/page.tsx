import Link from "next/link";

export default function ThanksPage() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-16 text-center">
      <div className="max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-line)] flex items-center justify-center mx-auto mb-5 text-2xl text-[var(--accent)]">
          ✓
        </div>
        <h1 className="font-disp font-bold text-2xl mb-3">ส่งคำตอบเรียบร้อยแล้ว</h1>
        <p className="text-[var(--muted)] mb-8">
          ขอบคุณที่ช่วยกรอกข้อมูล workflow ของทีม ทีมงานจะนำข้อมูลนี้ไปทำผัง swimlane ต่อไป
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-semibold px-6 py-3 rounded-[10px] bg-[var(--accent)] text-white"
        >
          กรอกข้อมูลทีมอื่นต่อ
        </Link>
      </div>
    </div>
  );
}
