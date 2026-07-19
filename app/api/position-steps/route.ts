import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { JobRow, StepRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public: the steps a position has filled, for the "parallel with which step"
// picker in the form. Empty array if that position hasn't filled anything yet
// (the UI then offers "not pinned yet").
export async function GET(req: Request) {
  const position = new URL(req.url).searchParams.get("position") ?? "";
  if (!position) return NextResponse.json({ steps: [] });

  const supabase = createServiceClient();
  const { data: resp } = await supabase.from("responses").select("id").eq("position_id", position).maybeSingle();
  if (!resp) return NextResponse.json({ steps: [] });

  const { data: jobRows } = await supabase.from("jobs").select("*").eq("response_id", (resp as { id: string }).id);
  const jobs = (jobRows as JobRow[] | null) ?? [];
  if (!jobs.length) return NextResponse.json({ steps: [] });

  const { data: stepRows } = await supabase.from("steps").select("*").in("job_id", jobs.map((j) => j.id));
  const steps = (stepRows as StepRow[] | null) ?? [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const out = steps
    .map((s) => ({ stepId: s.id, jobId: s.job_id, jobName: jobById.get(s.job_id)?.name ?? "", jobOrder: jobById.get(s.job_id)?.job_order ?? 0, order: s.step_order, action: s.action }))
    .sort((a, b) => a.jobOrder - b.jobOrder || a.order - b.order)
    .map((s) => ({ stepId: s.stepId, label: `${s.jobName} · ${s.order}. ${s.action}` }));

  return NextResponse.json({ steps: out });
}
