import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";
import { AdminDashboard, ProjectProgress } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServiceClient();
  const { data, result, dir } = await loadAndReconcile(supabase);

  const blockers = data.responses
    .filter((r) => r.blockers && r.blockers.trim())
    .map((r) => ({ positionId: r.position_id, text: r.blockers as string }));

  // Project module counter — how many of the ACTIVE people have filled their
  // projects. Kept separate from the position-based workflow count.
  const { data: asgRows } = await supabase.from("assignments").select("person_id");
  const filledSet = new Set(((asgRows as { person_id: string }[] | null) ?? []).map((a) => a.person_id));
  const people = dir.activeStaff;
  const projectProgress: ProjectProgress = {
    filled: people.filter((s) => filledSet.has(s.id)).length,
    total: people.length,
    missingStaff: people.filter((s) => !filledSet.has(s.id)).map((s) => s.id),
  };

  return <AdminDashboard result={result} blockers={blockers} projectProgress={projectProgress} />;
}
