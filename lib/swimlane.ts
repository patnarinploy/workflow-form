import { FlowPosition, PairEdge, EdgeStatus } from "./reconcile";
import { Directory } from "./directory";

// View A = report swimlane for ONE job at a time (never many jobs / 24 lanes at
// once — that was what made the first diagram unreadable). Lanes = the owner
// position plus every position this job hands off to / waits on. The owner's
// steps flow left→right by step_order; cross-position handoffs become boxes in
// the other lanes. x is ranked by step_order (authoritative time order), so
// decision RETURN edges are simply drawn as back-curves — no topological sort,
// hence no cycle to break.

export const EXTERNAL_LANE = "__external__";

export type JobRef = { jobId: string; owner: string; name: string; label: string };

export function listJobs(structure: FlowPosition[], dir: Directory): JobRef[] {
  const out: JobRef[] = [];
  for (const p of structure) {
    for (const j of p.jobs) {
      out.push({ jobId: j.id, owner: p.positionId, name: j.name, label: `${dir.positionName(p.positionId)} · ${j.name}` });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, "th"));
}

export type SwimLane = { id: string; name: string; members: string[]; hasSteps: boolean };

export type SwimNode = {
  id: string;
  kind: "step" | "decision" | "endpoint";
  lane: string;
  col: number;
  index?: number; // step number
  label: string;
  approver?: string;
  decisionFail?: string;
  targetPos?: string; // endpoint -> the other position (for jump)
  external?: boolean;
};

export type SwimLink = {
  id: string;
  from: string;
  to: string;
  kind: "seq" | "send" | "wait" | "fail";
  status?: EdgeStatus;
  what?: string;
  conditional?: string;
  backEdge?: boolean;
};

export type Swimlane = {
  job: JobRef;
  lanes: SwimLane[];
  nodes: SwimNode[];
  links: SwimLink[];
  stats: { steps: number; sends: number; approvals: number; returns: number };
  crossJob: { pos: string; jobId: string | null; label: string }[];
};

export function buildSwimlane(
  structure: FlowPosition[],
  edges: PairEdge[],
  dir: Directory,
  jobId: string
): Swimlane | null {
  const ownerFp = structure.find((p) => p.jobs.some((j) => j.id === jobId));
  if (!ownerFp) return null;
  const owner = ownerFp.positionId;
  const job = ownerFp.jobs.find((j) => j.id === jobId)!;
  const jobLabel = `${dir.positionName(owner)} · ${job.name}`;

  const edgeStatus = new Map<string, EdgeStatus>();
  for (const e of edges) edgeStatus.set(`${e.from}|${e.to}`, e.status);
  const statusOf = (from: string, to: string): EdgeStatus => edgeStatus.get(`${from}|${to}`) ?? "pending";

  const nodes: SwimNode[] = [];
  const links: SwimLink[] = [];
  const laneSet = new Set<string>([owner]);
  const stepNodeId = new Map<string, string>(); // flowStep.id -> node id
  let externalUsed = false;

  const steps = [...job.steps].sort((a, b) => a.order - b.order);
  let sends = 0,
    approvals = 0,
    returns = 0;

  steps.forEach((s, i) => {
    const nid = `s-${s.id}`;
    stepNodeId.set(s.id, nid);
    const approver =
      s.approvers.length || s.approverExternal
        ? [...s.approvers.map((a) => dir.positionName(a)), ...(s.approverExternal ? ["ลูกค้า/ภายนอก"] : [])].join(", ")
        : undefined;
    if (approver) approvals++;
    let decisionFail: string | undefined;
    if (s.decision) {
      const d = s.decision;
      decisionFail = d.failReason ? `ไม่ผ่าน (${d.failReason})` : "ไม่ผ่าน";
    }
    nodes.push({
      id: nid,
      kind: s.decision ? "decision" : "step",
      lane: owner,
      col: i,
      index: i + 1,
      label: s.action,
      approver,
      decisionFail,
    });
    if (i > 0) links.push({ id: `seq-${i}`, from: stepNodeId.get(steps[i - 1].id)!, to: nid, kind: "seq" });

    // sends (right) — targets are positions; `external` is a separate flag
    const emitSend = (eid: string, lane: string, label: string, targetPos: string | undefined, external: boolean, sd: { what: string; conditional: boolean; condition: string }) => {
      sends++;
      if (external) externalUsed = true;
      nodes.push({ id: eid, kind: "endpoint", lane, col: i + 0.5, label, targetPos, external });
      links.push({ id: `l-${eid}`, from: nid, to: eid, kind: "send", status: external ? "matched" : statusOf(owner, targetPos!), what: sd.what, conditional: sd.conditional ? sd.condition : undefined });
    };
    s.sends.forEach((sd, si) => {
      sd.targets.forEach((t, ti) => {
        laneSet.add(t);
        emitSend(`snd-${s.id}-${si}-${ti}`, t, sd.what || dir.positionName(t), t, false, sd);
      });
      if (sd.external) emitSend(`snd-${s.id}-${si}-x`, EXTERNAL_LANE, sd.what || "ส่งงาน", undefined, true, sd);
    });

    // waits (left)
    const emitWait = (eid: string, lane: string, label: string, targetPos: string | undefined, external: boolean, what: string) => {
      if (external) externalUsed = true;
      nodes.push({ id: eid, kind: "endpoint", lane, col: i - 0.5, label, targetPos, external });
      links.push({ id: `l-${eid}`, from: eid, to: nid, kind: "wait", status: external ? "matched" : statusOf(targetPos!, owner), what });
    };
    s.waits.forEach((w, wi) => {
      w.targets.forEach((t, ti) => {
        laneSet.add(t);
        emitWait(`wt-${s.id}-${wi}-${ti}`, t, w.what || dir.positionName(t), t, false, w.what);
      });
      if (w.external) emitWait(`wt-${s.id}-${wi}-x`, EXTERNAL_LANE, w.what || "รับงาน", undefined, true, w.what);
    });
  });

  // decision fail edges
  steps.forEach((s) => {
    const d = s.decision;
    if (!d) return;
    const from = stepNodeId.get(s.id)!;
    if (d.failStepId && stepNodeId.has(d.failStepId)) {
      returns++;
      links.push({ id: `fail-${s.id}`, from, to: stepNodeId.get(d.failStepId)!, kind: "fail", backEdge: true, what: d.failReason });
    } else if (d.failExternal) {
      returns++;
      externalUsed = true;
      const eid = `failx-${s.id}`;
      const col = (nodes.find((n) => n.id === from)?.col ?? 0) + 0.5;
      nodes.push({ id: eid, kind: "endpoint", lane: EXTERNAL_LANE, col, label: "ตีกลับ ลูกค้า/ภายนอก", external: true });
      links.push({ id: `fail-${s.id}`, from, to: eid, kind: "fail", what: d.failReason });
    } else if (d.failPosition) {
      returns++;
      laneSet.add(d.failPosition);
      const eid = `failp-${s.id}`;
      const col = (nodes.find((n) => n.id === from)?.col ?? 0) + 0.5;
      nodes.push({ id: eid, kind: "endpoint", lane: d.failPosition, col, label: `ตีกลับ ${dir.positionName(d.failPosition)}`, targetPos: d.failPosition });
      links.push({ id: `fail-${s.id}`, from, to: eid, kind: "fail", what: d.failReason });
    }
  });

  // lane order: by first (min) column appearance -> senders sit near targets.
  const laneMinCol = new Map<string, number>();
  for (const n of nodes) {
    const cur = laneMinCol.get(n.lane);
    if (cur == null || n.col < cur) laneMinCol.set(n.lane, n.col);
  }
  const laneIds = [...laneSet, ...(externalUsed ? [EXTERNAL_LANE] : [])].filter((v, i, a) => a.indexOf(v) === i);
  laneIds.sort((a, b) => {
    if (a === owner) return -1;
    if (b === owner) return 1;
    if (a === EXTERNAL_LANE) return 1;
    if (b === EXTERNAL_LANE) return -1;
    return (laneMinCol.get(a) ?? 99) - (laneMinCol.get(b) ?? 99);
  });
  const lanes: SwimLane[] = laneIds.map((id) => ({
    id,
    name: id === EXTERNAL_LANE ? "ลูกค้า/ภายนอก" : dir.positionName(id),
    members: id === EXTERNAL_LANE ? [] : dir.positionMembers(id),
    hasSteps: id === owner,
  }));

  // cross-job inbound: source positions that own their own job(s)
  const crossJob: { pos: string; jobId: string | null; label: string }[] = [];
  for (const id of laneIds) {
    if (id === owner || id === EXTERNAL_LANE) continue;
    const fp = structure.find((p) => p.positionId === id);
    const firstJob = fp?.jobs[0];
    crossJob.push({ pos: id, jobId: firstJob?.id ?? null, label: dir.positionName(id) });
  }

  return {
    job: { jobId, owner, name: job.name, label: jobLabel },
    lanes,
    nodes,
    links,
    stats: { steps: steps.length, sends, approvals, returns },
    crossJob,
  };
}
