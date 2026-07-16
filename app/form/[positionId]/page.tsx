import { notFound } from "next/navigation";
import { getPosition } from "@/lib/positions";
import { createServiceClient } from "@/lib/supabase/server";
import { FormClient } from "@/components/FormClient";
import {
  FormState,
  Job,
  Reveal,
  emptyForm,
  emptyReveal,
  specialToken,
  JobRow,
  StepRow,
  StepLinkRow,
  LinkKind,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function buildReveal(links: StepLinkRow[], kind: LinkKind): Reveal {
  const rows = links.filter((l) => l.kind === kind);
  if (rows.length === 0) return emptyReveal();
  const positions = rows.map((l) => (l.external ? specialToken("external") : (l.position_id ?? ""))).filter(Boolean);
  const what = rows.find((l) => l.what)?.what ?? "";
  return { enabled: true, positions, what };
}

export default async function FormPage({
  params,
  searchParams,
}: {
  params: Promise<{ positionId: string }>;
  searchParams: Promise<{ by?: string }>;
}) {
  const { positionId } = await params;
  const { by } = await searchParams;
  const position = getPosition(positionId);
  if (!position) notFound();

  const supabase = createServiceClient();
  const { data: response } = await supabase
    .from("responses")
    .select("id, filled_by, blockers, updated_at")
    .eq("position_id", positionId)
    .maybeSingle();

  let initial: FormState = emptyForm(positionId, by ?? "");
  let existing: { filledBy: string | null; updatedAt: string } | null = null;

  if (response) {
    existing = { filledBy: response.filled_by, updatedAt: response.updated_at };

    const { data: jobRows } = await supabase.from("jobs").select("*").eq("response_id", response.id);
    const jobs = (jobRows as JobRow[] | null) ?? [];
    let steps: StepRow[] = [];
    let links: StepLinkRow[] = [];
    if (jobs.length) {
      const { data: stepRows } = await supabase.from("steps").select("*").in("job_id", jobs.map((j) => j.id));
      steps = (stepRows as StepRow[] | null) ?? [];
      if (steps.length) {
        const { data: linkRows } = await supabase.from("step_links").select("*").in("step_id", steps.map((s) => s.id));
        links = (linkRows as StepLinkRow[] | null) ?? [];
      }
    }

    const linksByStep = new Map<string, StepLinkRow[]>();
    for (const l of links) {
      const arr = linksByStep.get(l.step_id) ?? [];
      arr.push(l);
      linksByStep.set(l.step_id, arr);
    }
    const stepsByJob = new Map<string, StepRow[]>();
    for (const s of steps) {
      const arr = stepsByJob.get(s.job_id) ?? [];
      arr.push(s);
      stepsByJob.set(s.job_id, arr);
    }

    const builtJobs: Job[] = jobs
      .sort((a, b) => a.job_order - b.job_order)
      .map((j) => ({
        name: j.name,
        trigger: j.trigger ?? "",
        frequency: j.frequency ?? "",
        steps: (stepsByJob.get(j.id) ?? [])
          .sort((a, b) => a.step_order - b.step_order)
          .map((s) => {
            const sl = linksByStep.get(s.id) ?? [];
            return {
              action: s.action,
              waitsFor: buildReveal(sl, "waits_for"),
              sendsTo: buildReveal(sl, "sends_to"),
              approver: buildReveal(sl, "approver"),
            };
          }),
      }));

    initial = {
      positionId,
      filledBy: response.filled_by ?? by ?? "",
      jobs: builtJobs.length ? builtJobs : emptyForm(positionId).jobs,
      blockers: response.blockers ?? "",
    };
  }

  return <FormClient position={position} initial={initial} existing={existing} />;
}
