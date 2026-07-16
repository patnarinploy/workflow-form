import { notFound } from "next/navigation";
import { getPosition } from "@/lib/positions";
import { createServiceClient } from "@/lib/supabase/server";
import { FormClient } from "@/components/FormClient";
import {
  FormState,
  Job,
  Step,
  emptyForm,
  emptyStep,
  specialToken,
  JobRow,
  StepRow,
  StepLinkRow,
  StepLinkTargetRow,
} from "@/lib/types";

export const dynamic = "force-dynamic";

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
    let targets: StepLinkTargetRow[] = [];
    if (jobs.length) {
      const { data: stepRows } = await supabase.from("steps").select("*").in("job_id", jobs.map((j) => j.id));
      steps = (stepRows as StepRow[] | null) ?? [];
      if (steps.length) {
        const { data: linkRows } = await supabase.from("step_links").select("*").in("step_id", steps.map((s) => s.id));
        links = (linkRows as StepLinkRow[] | null) ?? [];
        if (links.length) {
          const { data: targetRows } = await supabase.from("step_link_targets").select("*").in("link_id", links.map((l) => l.id));
          targets = (targetRows as StepLinkTargetRow[] | null) ?? [];
        }
      }
    }

    const tokensByLink = new Map<string, string[]>();
    for (const t of targets) {
      const arr = tokensByLink.get(t.link_id) ?? [];
      arr.push(t.external ? specialToken("external") : (t.position_id ?? ""));
      tokensByLink.set(t.link_id, arr.filter(Boolean));
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

    const buildStep = (s: StepRow): Step => {
      const ls = (linksByStep.get(s.id) ?? []).slice().sort((a, b) => a.link_order - b.link_order);
      const waits = ls.filter((l) => l.kind === "waits_for").map((l) => ({ what: l.what ?? "", positions: tokensByLink.get(l.id) ?? [] }));
      const sends = ls
        .filter((l) => l.kind === "sends_to")
        .map((l) => ({ what: l.what ?? "", positions: tokensByLink.get(l.id) ?? [], conditional: !!l.conditional, condition: l.condition ?? "" }));
      const approverPos = ls.filter((l) => l.kind === "approver").flatMap((l) => tokensByLink.get(l.id) ?? []);
      const base = emptyStep();
      return {
        action: s.action,
        waitsFor: waits.length ? { enabled: true, items: waits } : base.waitsFor,
        sendsTo: sends.length ? { enabled: true, items: sends } : base.sendsTo,
        approver: approverPos.length ? { enabled: true, positions: approverPos } : base.approver,
      };
    };

    const builtJobs: Job[] = jobs
      .sort((a, b) => a.job_order - b.job_order)
      .map((j) => ({
        name: j.name,
        trigger: j.trigger ?? "",
        frequency: j.frequency ?? "",
        steps: (stepsByJob.get(j.id) ?? []).sort((a, b) => a.step_order - b.step_order).map(buildStep),
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
