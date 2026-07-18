import { createServiceClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { StaffAdmin } from "@/components/admin/StaffAdmin";
import { loadDirectorySnapshot } from "@/lib/directory";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const supabase = createServiceClient();
  const { positions, staff } = await loadDirectorySnapshot(supabase); // all rows incl. inactive

  return (
    <div className="max-w-[820px] mx-auto px-5 py-8">
      <h1 className="font-disp font-bold text-[22px] mb-4">จัดการพนักงาน</h1>
      <AdminNav />
      <StaffAdmin positions={positions} initialStaff={staff} />
    </div>
  );
}
