import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createServiceClient();
  const { data, result } = await loadAndReconcile(supabase);

  const blockers = data.responses
    .filter((r) => r.blockers && r.blockers.trim())
    .map((r) => ({ personId: r.person_id, text: r.blockers as string }));

  return <AdminDashboard result={result} blockers={blockers} />;
}
