import type { SupabaseClient } from "@supabase/supabase-js";
import { ResponseRow, TaskRow, TaskLinkRow } from "./types";
import { STAFF } from "./staff";

export type RawData = {
  responses: ResponseRow[];
  tasks: TaskRow[];
  links: TaskLinkRow[];
};

export type EdgeStatus = "matched" | "mismatch" | "pending";

export type Edge = {
  from: string; // sender person id
  to: string; // receiver person id
  status: EdgeStatus;
  senderAsserted: boolean; // sender said "I send to receiver"
  receiverAsserted: boolean; // receiver said "I receive from sender"
  senderTasks: string[]; // sender's task actions that mention this handoff
  receiverTasks: string[]; // receiver's task actions that mention this handoff
};

export type Orphan = {
  personId: string;
  taskCount: number;
};

export type Workload = {
  personId: string;
  taskCount: number;
  inbound: number; // distinct edges pointing into this person
  outbound: number; // distinct edges leaving this person
  approverCount: number; // times cited as approver across all tasks
};

export type Reconciliation = {
  submittedIds: string[];
  missingIds: string[];
  edges: Edge[];
  matched: Edge[];
  oneSided: Edge[]; // mismatch + pending
  orphans: Orphan[];
  workload: Workload[];
};

type EdgeAccum = {
  senderAsserted: boolean;
  receiverAsserted: boolean;
  senderTasks: Set<string>;
  receiverTasks: Set<string>;
};

export function reconcile(data: RawData): Reconciliation {
  const ownerByResponse = new Map<string, string>();
  for (const r of data.responses) ownerByResponse.set(r.id, r.person_id);

  const ownerByTask = new Map<string, string>(); // task_id -> person_id
  const actionByTask = new Map<string, string>();
  const taskCount = new Map<string, number>(); // person -> #tasks
  for (const t of data.tasks) {
    const owner = ownerByResponse.get(t.response_id);
    if (!owner) continue;
    ownerByTask.set(t.id, owner);
    actionByTask.set(t.id, t.action);
    taskCount.set(owner, (taskCount.get(owner) ?? 0) + 1);
  }

  const submittedIds = data.responses.map((r) => r.person_id);
  const submittedSet = new Set(submittedIds);

  const edges = new Map<string, EdgeAccum>();
  const targetedByTo = new Set<string>(); // persons that appear in someone's "to"
  const declaredOrigin = new Set<string>(); // persons who used self_start/external in a from
  const approverCount = new Map<string, number>();

  const edgeKey = (a: string, b: string) => `${a} ${b}`;
  const getEdge = (a: string, b: string): EdgeAccum => {
    const k = edgeKey(a, b);
    let e = edges.get(k);
    if (!e) {
      e = { senderAsserted: false, receiverAsserted: false, senderTasks: new Set(), receiverTasks: new Set() };
      edges.set(k, e);
    }
    return e;
  };

  for (const link of data.links) {
    const owner = ownerByTask.get(link.task_id);
    if (!owner) continue;
    const action = actionByTask.get(link.task_id) ?? "";

    if (link.kind === "to") {
      if (link.person_id) {
        // owner sends to person_id  => edge owner -> person_id, asserted by sender
        const e = getEdge(owner, link.person_id);
        e.senderAsserted = true;
        if (action) e.senderTasks.add(action);
        targetedByTo.add(link.person_id);
      }
      // special "ends_here"/"external" create no person edge
    } else if (link.kind === "from") {
      if (link.person_id) {
        // owner receives from person_id => edge person_id -> owner, asserted by receiver
        const e = getEdge(link.person_id, owner);
        e.receiverAsserted = true;
        if (action) e.receiverTasks.add(action);
      } else if (link.special === "self_start" || link.special === "external") {
        declaredOrigin.add(owner);
      }
    } else if (link.kind === "approver") {
      if (link.person_id) {
        approverCount.set(link.person_id, (approverCount.get(link.person_id) ?? 0) + 1);
      }
    }
    // "rework" links are not part of the flow reconciliation
  }

  const allEdges: Edge[] = [];
  for (const [key, acc] of edges) {
    const [from, to] = key.split(" ");
    let status: EdgeStatus;
    if (acc.senderAsserted && acc.receiverAsserted) {
      status = "matched";
    } else {
      // one-sided: the party who did NOT assert — have they submitted?
      const missingParty = acc.senderAsserted ? to : from;
      status = submittedSet.has(missingParty) ? "mismatch" : "pending";
    }
    allEdges.push({
      from,
      to,
      status,
      senderAsserted: acc.senderAsserted,
      receiverAsserted: acc.receiverAsserted,
      senderTasks: [...acc.senderTasks],
      receiverTasks: [...acc.receiverTasks],
    });
  }

  // Orphans: submitted person with >=1 task, not targeted by anyone's "to",
  // and did not declare a self_start / external origin on any task.
  const orphans: Orphan[] = [];
  for (const pid of submittedIds) {
    const tc = taskCount.get(pid) ?? 0;
    if (tc === 0) continue;
    if (targetedByTo.has(pid)) continue;
    if (declaredOrigin.has(pid)) continue;
    orphans.push({ personId: pid, taskCount: tc });
  }

  // Workload — computed over everyone who is either submitted or referenced.
  const inbound = new Map<string, number>();
  const outbound = new Map<string, number>();
  for (const e of allEdges) {
    outbound.set(e.from, (outbound.get(e.from) ?? 0) + 1);
    inbound.set(e.to, (inbound.get(e.to) ?? 0) + 1);
  }
  const involved = new Set<string>([
    ...submittedIds,
    ...inbound.keys(),
    ...outbound.keys(),
    ...approverCount.keys(),
  ]);
  const workload: Workload[] = [...involved]
    .filter((id) => STAFF.some((s) => s.id === id))
    .map((id) => ({
      personId: id,
      taskCount: taskCount.get(id) ?? 0,
      inbound: inbound.get(id) ?? 0,
      outbound: outbound.get(id) ?? 0,
      approverCount: approverCount.get(id) ?? 0,
    }))
    .sort((a, b) => b.taskCount - a.taskCount || b.inbound - a.inbound);

  const missingIds = STAFF.filter((s) => !submittedSet.has(s.id)).map((s) => s.id);

  return {
    submittedIds,
    missingIds,
    edges: allEdges,
    matched: allEdges.filter((e) => e.status === "matched"),
    oneSided: allEdges.filter((e) => e.status !== "matched"),
    orphans,
    workload,
  };
}

// Shared server-side loader: fetch everything and reconcile.
export async function loadAndReconcile(
  supabase: SupabaseClient
): Promise<{ data: RawData; result: Reconciliation }> {
  const [{ data: responses }, { data: tasks }, { data: links }] = await Promise.all([
    supabase.from("responses").select("*"),
    supabase.from("tasks").select("*"),
    supabase.from("task_links").select("*"),
  ]);
  const raw: RawData = {
    responses: (responses as ResponseRow[] | null) ?? [],
    tasks: (tasks as TaskRow[] | null) ?? [],
    links: (links as TaskLinkRow[] | null) ?? [],
  };
  return { data: raw, result: reconcile(raw) };
}
