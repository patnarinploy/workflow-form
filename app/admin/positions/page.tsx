import { createServiceClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { PositionsAdmin } from "@/components/admin/PositionsAdmin";
import { loadDirectorySnapshot } from "@/lib/directory";

export const dynamic = "force-dynamic";

export default async function AdminPositionsPage() {
  const supabase = createServiceClient();
  const { positions, staff } = await loadDirectorySnapshot(supabase); // all rows

  const counts: Record<string, number> = {};
  for (const s of staff) {
    if (s.isActive) counts[s.positionId] = (counts[s.positionId] ?? 0) + 1;
  }

  return (
    <div className="max-w-[820px] mx-auto px-5 py-8">
      <h1 className="font-disp font-bold text-[22px] mb-4">จัดการตำแหน่ง</h1>
      <AdminNav />
      <p className="text-[13.5px] text-[var(--muted)] mb-5">
        เพิ่มตำแหน่งใหม่ได้เมื่อรับคนตำแหน่งที่ยังไม่มีในระบบ · แก้ชื่อและจัดลำดับได้ · ปิดใช้งานได้ถ้าไม่มีคนอยู่แล้ว
      </p>
      <PositionsAdmin initial={positions} counts={counts} />
    </div>
  );
}
