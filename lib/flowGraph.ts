import { FlowPosition, PairEdge, EdgeStatus } from "./reconcile";
import { Directory } from "./directory";

// Shared graph model for the two flow views (Overview map + Focus view).
// Built ONCE from the reconcile output (structure + edges) plus the directory,
// so both modes render the same confirmed/unconfirmed state. No schema change.

export type FlowGraphNode = {
  id: string;
  name: string;
  group: string;
  members: string[];
  stepCount: number;
  jobCount: number;
  hasData: boolean; // submitted a response with at least one job
};

export type FlowHandoff = {
  from: string;
  to: string;
  count: number; // number of send/receive line items behind this edge
  status: EdgeStatus; // matched | mismatch | pending
  whats: string[]; // what is handed off (for tooltips)
};

export type FlowFail = { from: string; to: string; reason: string };

export type FlowGraph = {
  nodes: FlowGraphNode[];
  handoffs: FlowHandoff[];
  fails: FlowFail[];
  edgeStatus: Map<string, EdgeStatus>; // `${from}|${to}` -> status (for chips)
};

const key = (a: string, b: string) => `${a}|${b}`;

export function buildFlowGraph(structure: FlowPosition[], edges: PairEdge[], dir: Directory): FlowGraph {
  const structByPos = new Map(structure.map((s) => [s.positionId, s]));

  const nodes: FlowGraphNode[] = dir.activePositions.map((p) => {
    const st = structByPos.get(p.id);
    const jobs = st?.jobs ?? [];
    const stepCount = jobs.reduce((n, j) => n + j.steps.length, 0);
    return {
      id: p.id,
      name: p.name,
      group: p.group,
      members: dir.positionMembers(p.id),
      stepCount,
      jobCount: jobs.length,
      hasData: jobs.length > 0,
    };
  });

  // Handoffs come straight from the reconciled edges (covers both confirmed and
  // one-sided). Thickness = how many line items are behind the edge.
  const edgeStatus = new Map<string, EdgeStatus>();
  const handoffs: FlowHandoff[] = edges.map((e) => {
    edgeStatus.set(key(e.from, e.to), e.status);
    const whats = Array.from(new Set([...e.senderContext, ...e.receiverContext]));
    const count = Math.max(e.senderContext.length, e.receiverContext.length, 1);
    return { from: e.from, to: e.to, count, status: e.status, whats };
  });

  // Fail/return edges from decision points that bounce to a DIFFERENT position.
  const fails: FlowFail[] = [];
  for (const pos of structure) {
    for (const job of pos.jobs) {
      for (const step of job.steps) {
        const d = step.decision;
        if (d && d.failPosition && d.failPosition !== pos.positionId) {
          fails.push({ from: pos.positionId, to: d.failPosition, reason: d.failReason });
        }
      }
    }
  }

  return { nodes, handoffs, fails, edgeStatus };
}

// Group palette for overview nodes (extends the four known groups).
export const GROUP_PALETTE: Record<string, string> = {
  Executive: "#7C5CBF",
  Commercial: "#128A64",
  Production: "#2E7CD6",
  Operation: "#B6841C",
};
const EXTRA = ["#C2508A", "#3AA6A6", "#8A6D3B", "#5C6BC0"];
export function groupColor(group: string, groups: string[]): string {
  if (GROUP_PALETTE[group]) return GROUP_PALETTE[group];
  const i = groups.indexOf(group);
  return EXTRA[Math.max(0, i) % EXTRA.length];
}
