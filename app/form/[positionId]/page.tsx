import { notFound } from "next/navigation";
import { loadDirectory } from "@/lib/directory";
import { createServiceClient } from "@/lib/supabase/server";
import { FormClient } from "@/components/FormClient";
import {
  FormState,
  Job,
  Step,
  Decision,
  emptyForm,
  emptyStep,
  emptyDecision,
  specialToken,
  JobRow,
  StepRow,
  StepLinkRow,
  StepLinkTargetRow,
  StepDecisionRow,
  DecisionDeciderRow,
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
  const supabase = createServiceClient();
  const dir = await loadDirectory(supabase);
  const position = dir.getPosition(positionId);
  if (!position) notFound();

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
    let decisions: StepDecisionRow[] = [];
    let deciders: DecisionDeciderRow[] = [];
    if (jobs.length) {
      const { data: stepRows } = await supabase.from("steps").select("*").in("job_id", jobs.map((j) => j.id));
      steps = (stepRows as StepRow[] | null) ?? [];
      if (steps.length) {
        const stepIds = steps.map((s) => s.id);
        const [{ data: linkRows }, { data: decisionRows }] = await Promise.all([
          supabase.from("step_links").select("*").in("step_id", stepIds),
          supabase.from("step_decisions").select("*").in("step_id", stepIds),
        ]);
        links = (linkRows as StepLinkRow[] | null) ?? [];
        decisions = (decisionRows as StepDecisionRow[] | null) ?? [];
        if (decisions.length) {
          const { data: deciderRows } = await supabase.from("decision_deciders").select("*").in("decision_id", decisions.map((d) => d.id));
          deciders = (deciderRows as DecisionDeciderRow[] | null) ?? [];
        }
        if (links.length) {
          const { data: targetRows } = await supabase.from("step_link_targets").select("*").in("link_id", links.map((l) => l.id));
          targets = (targetRows as StepLinkTargetRow[] | null) ?? [];
        }
      }
    }

    const tokensByLink = new Map<string, string[]>();
    // parallel targets keep each target's own pinned step
    const parallelTargetsByLink = new Map<string, { token: string; stepId: string }[]>();
    for (const t of targets) {
      const token = t.external ? specialToken("external") : (t.position_id ?? "");
      const arr = tokensByLink.get(t.link_id) ?? [];
      arr.push(token);
      tokensByLink.set(t.link_id, arr.filter(Boolean));
      if (token) {
        const parr = parallelTargetsByLink.get(t.link_id) ?? [];
        parr.push({ token, stepId: t.parallel_step_id ?? "" });
        parallelTargetsByLink.set(t.link_id, parr);
      }
    }
    const linksByStep = new Map<string, StepLinkRow[]>();
    for (const l of links) {
      const arr = linksByStep.get(l.step_id) ?? [];
      arr.push(l);
      linksByStep.set(l.step_id, arr);
    }
    const decisionByStep = new Map<string, StepDecisionRow>();
    for (const d of decisions) decisionByStep.set(d.step_id, d);
    const stepsByJob = new Map<string, StepRow[]>();
    for (const s of steps) {
      const arr = stepsByJob.get(s.job_id) ?? [];
      arr.push(s);
      stepsByJob.set(s.job_id, arr);
    }

    const decidersByDecision = new Map<string, string[]>();
    for (const dd of deciders) {
      const token = dd.external ? specialToken("external") : dd.position_id;
      if (!token) continue;
      const arr = decidersByDecision.get(dd.decision_id) ?? [];
      arr.push(token);
      decidersByDecision.set(dd.decision_id, arr);
    }

    const buildDecision = (stepId: string): Decision => {
      const d = decisionByStep.get(stepId);
      if (!d) return emptyDecision();
      const failKind: Decision["failKind"] = d.fail_step_id ? "step" : d.fail_position_id || d.fail_external ? "position" : "";
      const fromTable = decidersByDecision.get(d.id) ?? [];
      const deciderTokens = fromTable.length
        ? fromTable
        : d.decider_external || d.decider_position_id
        ? [d.decider_external ? specialToken("external") : (d.decider_position_id as string)]
        : [positionId];
      return {
        enabled: true,
        deciders: deciderTokens,
        failKind,
        failStepId: d.fail_step_id ?? "",
        failPosition: d.fail_external ? specialToken("external") : d.fail_position_id ?? "",
        failReason: d.fail_reason ?? "",
      };
    };

    const buildStep = (s: StepRow): Step => {
      const ls = (linksByStep.get(s.id) ?? []).slice().sort((a, b) => a.link_order - b.link_order);
      const waits = ls.filter((l) => l.kind === "waits_for").map((l) => ({ what: l.what ?? "", positions: tokensByLink.get(l.id) ?? [] }));
      const sends = ls
        .filter((l) => l.kind === "sends_to")
        .map((l) => ({ what: l.what ?? "", positions: tokensByLink.get(l.id) ?? [], conditional: !!l.conditional, condition: l.condition ?? "" }));
      const approverPos = ls.filter((l) => l.kind === "approver").flatMap((l) => tokensByLink.get(l.id) ?? []);
      const parallels = ls
        .filter((l) => l.kind === "parallel")
        .map((l) => ({
          what: l.what ?? "",
          targets: (parallelTargetsByLink.get(l.id) ?? []).map((t) => ({ position: t.token, stepId: t.stepId })),
        }))
        .filter((p) => p.targets.length > 0);
      const base = emptyStep();
      return {
        id: s.id,
        action: s.action,
        waitsFor: waits.length ? { enabled: true, items: waits } : base.waitsFor,
        sendsTo: sends.length ? { enabled: true, items: sends } : base.sendsTo,
        approver: approverPos.length ? { enabled: true, positions: approverPos } : base.approver,
        decision: buildDecision(s.id),
        parallel: parallels.length ? { enabled: true, items: parallels } : base.parallel,
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
