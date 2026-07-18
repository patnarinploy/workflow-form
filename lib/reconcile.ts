import type { SupabaseClient } from "@supabase/supabase-js";
import { ResponseRow, JobRow, StepRow, StepLinkRow, StepLinkTargetRow, StepDecisionRow } from "./types";
import { loadDirectory } from "./directory";

export type RawData = {
  responses: ResponseRow[];
  jobs: JobRow[];
  steps: StepRow[];
  links: StepLinkRow[];
  targets: StepLinkTargetRow[];
  decisions: StepDecisionRow[];
};

export type EdgeStatus = "matched" | "mismatch" | "pending";

export type PairEdge = {
  from: string; // sender position id
  to: string; // receiver position id
  status: EdgeStatus;
  senderAsserted: boolean;
  receiverAsserted: boolean;
  senderContext: string[];
  receiverContext: string[];
};

export type Workload = {
  positionId: string;
  members: number;
  jobCount: number;
  stepCount: number;
  stepsPerHead: number;
  inbound: number;
  outbound: number;
  approverCount: number;
};

// ---- structure used to draw the swimlane ----
export type FlowSend = { what: string; conditional: boolean; condition: string; targets: string[]; external: boolean };
export type FlowWait = { what: string; targets: string[]; external: boolean };
export type FlowDecision = {
  decider: string; // position id, or "" when own/unknown
  deciderExternal: boolean;
  failStepId: string; // real step id, or ""
  failPosition: string; // position id, or ""
  failExternal: boolean;
  failReason: string;
};
export type FlowStep = {
  id: string;
  order: number;
  action: string;
  sends: FlowSend[];
  waits: FlowWait[];
  approvers: string[];
  approverExternal: boolean;
  decision: FlowDecision | null;
};
export type FlowJob = { id: string; name: string; order: number; steps: FlowStep[] };
export type FlowPosition = { positionId: string; jobs: FlowJob[] };

export type Reconciliation = {
  submittedIds: string[];
  missingIds: string[];
  filledBy: Record<string, string>;
  edges: PairEdge[];
  matched: PairEdge[];
  oneSided: PairEdge[];
  workload: Workload[];
  structure: FlowPosition[];
};

type EdgeAccum = {
  senderAsserted: boolean;
  receiverAsserted: boolean;
  senderContext: Set<string>;
  receiverContext: Set<string>;
};

// targets split into position ids vs external flag, per link
function splitTargets(targets: StepLinkTargetRow[]) {
  const byLink = new Map<string, { positions: string[]; external: boolean }>();
  for (const t of targets) {
    const e = byLink.get(t.link_id) ?? { positions: [], external: false };
    if (t.external) e.external = true;
    else if (t.position_id) e.positions.push(t.position_id);
    byLink.set(t.link_id, e);
  }
  return byLink;
}

// `positions` and `memberCount` are supplied by the caller from the DB-backed
// directory (they used to be module constants).
export function reconcile(
  data: RawData,
  positions: { id: string }[],
  memberCount: (id: string) => number
): Reconciliation {
  const positionIdSet = new Set(positions.map((p) => p.id));
  const ownerByResponse = new Map<string, string>();
  const filledBy: Record<string, string> = {};
  for (const r of data.responses) {
    ownerByResponse.set(r.id, r.position_id);
    if (r.filled_by) filledBy[r.position_id] = r.filled_by;
  }

  const jobById = new Map<string, JobRow>();
  const jobOwner = new Map<string, string>();
  for (const j of data.jobs) {
    jobById.set(j.id, j);
    const owner = ownerByResponse.get(j.response_id);
    if (owner) jobOwner.set(j.id, owner);
  }

  const stepMeta = new Map<string, { owner: string; jobName: string; action: string }>();
  for (const s of data.steps) {
    const job = jobById.get(s.job_id);
    if (!job) continue;
    const owner = jobOwner.get(s.job_id);
    if (!owner) continue;
    stepMeta.set(s.id, { owner, jobName: job.name, action: s.action });
  }

  const targetsByLink = splitTargets(data.targets);

  const submittedIds = data.responses.map((r) => r.position_id);
  const submittedSet = new Set(submittedIds);

  const edges = new Map<string, EdgeAccum>();
  const approverCount = new Map<string, number>();

  const key = (a: string, b: string) => `${a}|${b}`;
  const getEdge = (a: string, b: string): EdgeAccum => {
    const k = key(a, b);
    let e = edges.get(k);
    if (!e) {
      e = { senderAsserted: false, receiverAsserted: false, senderContext: new Set(), receiverContext: new Set() };
      edges.set(k, e);
    }
    return e;
  };
  const ctx = (m: { jobName: string; action: string } | undefined, what: string | null) =>
    m ? `${m.jobName} — ${m.action}${what ? ` (${what})` : ""}` : "";

  for (const link of data.links) {
    const meta = stepMeta.get(link.step_id);
    if (!meta) continue;
    const owner = meta.owner;
    const tg = targetsByLink.get(link.id);
    const positions = tg?.positions ?? [];

    if (link.kind === "sends_to") {
      for (const b of positions) {
        const e = getEdge(owner, b);
        e.senderAsserted = true;
        e.senderContext.add(ctx(meta, link.what));
      }
    } else if (link.kind === "waits_for") {
      for (const a of positions) {
        const e = getEdge(a, owner);
        e.receiverAsserted = true;
        e.receiverContext.add(ctx(meta, link.what));
      }
    } else if (link.kind === "approver") {
      for (const p of positions) approverCount.set(p, (approverCount.get(p) ?? 0) + 1);
    }
  }

  const allEdges: PairEdge[] = [];
  for (const [k, acc] of edges) {
    const [from, to] = k.split("|");
    let status: EdgeStatus;
    if (acc.senderAsserted && acc.receiverAsserted) status = "matched";
    else {
      const missingParty = acc.senderAsserted ? to : from;
      status = submittedSet.has(missingParty) ? "mismatch" : "pending";
    }
    allEdges.push({
      from,
      to,
      status,
      senderAsserted: acc.senderAsserted,
      receiverAsserted: acc.receiverAsserted,
      senderContext: [...acc.senderContext].filter(Boolean),
      receiverContext: [...acc.receiverContext].filter(Boolean),
    });
  }

  // workload
  const jobCount = new Map<string, number>();
  const stepCount = new Map<string, number>();
  for (const j of data.jobs) {
    const owner = jobOwner.get(j.id);
    if (owner) jobCount.set(owner, (jobCount.get(owner) ?? 0) + 1);
  }
  for (const s of data.steps) {
    const owner = stepMeta.get(s.id)?.owner;
    if (owner) stepCount.set(owner, (stepCount.get(owner) ?? 0) + 1);
  }
  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (const e of allEdges) {
    outbound.set(e.from, (outbound.get(e.from) ?? 0) + 1);
    inbound.set(e.to, (inbound.get(e.to) ?? 0) + 1);
  }
  const involved = new Set<string>([...submittedIds, ...inbound.keys(), ...outbound.keys(), ...approverCount.keys()]);
  const workload: Workload[] = [...involved]
    .filter((id) => positionIdSet.has(id))
    .map((id) => {
      const steps = stepCount.get(id) ?? 0;
      const heads = memberCount(id) || 1;
      return {
        positionId: id,
        members: memberCount(id),
        jobCount: jobCount.get(id) ?? 0,
        stepCount: steps,
        stepsPerHead: Math.round((steps / heads) * 10) / 10,
        inbound: inbound.get(id) ?? 0,
        outbound: outbound.get(id) ?? 0,
        approverCount: approverCount.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.stepCount - a.stepCount || b.inbound - a.inbound);

  // structure for the flow
  const linksByStep = new Map<string, StepLinkRow[]>();
  for (const l of data.links) {
    const arr = linksByStep.get(l.step_id) ?? [];
    arr.push(l);
    linksByStep.set(l.step_id, arr);
  }
  const stepsByJob = new Map<string, StepRow[]>();
  for (const s of data.steps) {
    const arr = stepsByJob.get(s.job_id) ?? [];
    arr.push(s);
    stepsByJob.set(s.job_id, arr);
  }
  const jobsByResponse = new Map<string, JobRow[]>();
  for (const j of data.jobs) {
    const arr = jobsByResponse.get(j.response_id) ?? [];
    arr.push(j);
    jobsByResponse.set(j.response_id, arr);
  }
  const decisionByStep = new Map<string, StepDecisionRow>();
  for (const d of data.decisions) decisionByStep.set(d.step_id, d);
  const flowDecision = (stepId: string): FlowDecision | null => {
    const d = decisionByStep.get(stepId);
    if (!d) return null;
    return {
      decider: d.decider_position_id ?? "",
      deciderExternal: !!d.decider_external,
      failStepId: d.fail_step_id ?? "",
      failPosition: d.fail_position_id ?? "",
      failExternal: !!d.fail_external,
      failReason: d.fail_reason ?? "",
    };
  };
  const structure: FlowPosition[] = data.responses.map((r) => ({
    positionId: r.position_id,
    jobs: (jobsByResponse.get(r.id) ?? [])
      .sort((a, b) => a.job_order - b.job_order)
      .map((j) => ({
        id: j.id,
        name: j.name,
        order: j.job_order,
        steps: (stepsByJob.get(j.id) ?? [])
          .sort((a, b) => a.step_order - b.step_order)
          .map((s) => {
            const ls = (linksByStep.get(s.id) ?? []).slice().sort((a, b) => a.link_order - b.link_order);
            const sends: FlowSend[] = ls
              .filter((l) => l.kind === "sends_to")
              .map((l) => {
                const tg = targetsByLink.get(l.id) ?? { positions: [], external: false };
                return { what: l.what ?? "", conditional: !!l.conditional, condition: l.condition ?? "", targets: tg.positions, external: tg.external };
              });
            const waits: FlowWait[] = ls
              .filter((l) => l.kind === "waits_for")
              .map((l) => {
                const tg = targetsByLink.get(l.id) ?? { positions: [], external: false };
                return { what: l.what ?? "", targets: tg.positions, external: tg.external };
              });
            const approverLinks = ls.filter((l) => l.kind === "approver");
            const approvers = approverLinks.flatMap((l) => targetsByLink.get(l.id)?.positions ?? []);
            const approverExternal = approverLinks.some((l) => targetsByLink.get(l.id)?.external);
            return { id: s.id, order: s.step_order, action: s.action, sends, waits, approvers, approverExternal, decision: flowDecision(s.id) };
          }),
      })),
  }));

  const missingIds = positions.filter((p) => !submittedSet.has(p.id)).map((p) => p.id);

  return {
    submittedIds,
    missingIds,
    filledBy,
    edges: allEdges,
    matched: allEdges.filter((e) => e.status === "matched"),
    oneSided: allEdges.filter((e) => e.status !== "matched"),
    workload,
    structure,
  };
}

export async function loadAndReconcile(
  supabase: SupabaseClient
): Promise<{ data: RawData; result: Reconciliation }> {
  const [dir, { data: responses }, { data: jobs }, { data: steps }, { data: links }, { data: targets }, { data: decisions }] = await Promise.all([
    loadDirectory(supabase),
    supabase.from("responses").select("*"),
    supabase.from("jobs").select("*"),
    supabase.from("steps").select("*"),
    supabase.from("step_links").select("*"),
    supabase.from("step_link_targets").select("*"),
    supabase.from("step_decisions").select("*"),
  ]);
  const raw: RawData = {
    responses: (responses as ResponseRow[] | null) ?? [],
    jobs: (jobs as JobRow[] | null) ?? [],
    steps: (steps as StepRow[] | null) ?? [],
    links: (links as StepLinkRow[] | null) ?? [],
    targets: (targets as StepLinkTargetRow[] | null) ?? [],
    decisions: (decisions as StepDecisionRow[] | null) ?? [],
  };
  return { data: raw, result: reconcile(raw, dir.activePositions, dir.memberCount) };
}
