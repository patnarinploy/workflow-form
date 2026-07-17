import { createServiceClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { MatrixClient } from "@/components/admin/MatrixClient";
import { Project, Assignment, STATUS_ORDER, isActive } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function AdminMatrixPage() {
  const supabase = createServiceClient();
  const [{ data: projRows }, { data: asgRows }] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("assignments").select("*"),
  ]);
  const projects = ((projRows as Project[] | null) ?? [])
    .filter(isActive)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "th"));
  const assignments = (asgRows as Assignment[] | null) ?? [];

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <h1 className="font-disp font-bold text-[22px] mb-4">ตารางภาระงาน</h1>
      <AdminNav />
      <MatrixClient projects={projects} assignments={assignments} />
    </div>
  );
}
