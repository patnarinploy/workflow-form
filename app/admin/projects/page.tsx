import { createServiceClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProjectsAdmin } from "@/components/admin/ProjectsAdmin";
import { Project, STATUS_ORDER } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  const supabase = createServiceClient();
  const { data } = await supabase.from("projects").select("*");
  const projects = ((data as Project[] | null) ?? []).sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "th")
  );

  return (
    <div className="max-w-[900px] mx-auto px-5 py-8">
      <h1 className="font-disp font-bold text-[22px] mb-4">จัดการโปรเจกต์</h1>
      <AdminNav />
      <p className="text-[13.5px] text-[var(--muted)] mb-5">สร้างรายการโปรเจกต์ก่อน พนักงานถึงจะเลือกใน “โปรเจกต์ของฉัน” ได้</p>
      <ProjectsAdmin initial={projects} />
    </div>
  );
}
