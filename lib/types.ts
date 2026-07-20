import { SpecialValue } from "./positions";

// Relationship fields hold "tokens": a POSITION id (e.g. "producer") or a special
// option prefixed with "@" (e.g. "@external"). Position ids never start with "@".
export const SPECIAL_PREFIX = "@";

export function specialToken(v: SpecialValue): string {
  return SPECIAL_PREFIX + v;
}
export function isSpecialToken(token: string): boolean {
  return token.startsWith(SPECIAL_PREFIX);
}
export function specialOf(token: string): SpecialValue {
  return token.slice(SPECIAL_PREFIX.length) as SpecialValue;
}

// Stable client id for a step: temp on the client, remapped to a real uuid on save.
// Steps loaded from the DB already carry their real uuid here. Back-references
// (fail targets) point at this id so reordering steps never breaks them.
export function newId(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// v4 model: position -> job -> step, with optional per-step links.
// Each handoff is a LINE ITEM (not a single multi-select) because one step can
// send different things to different positions, sometimes conditionally.
export type LinkKind = "waits_for" | "sends_to" | "approver" | "parallel";

// "positions" holds tokens: position ids + "@external"
export type WaitItem = { what: string; positions: string[] };
export type SendItem = { what: string; positions: string[]; conditional: boolean; condition: string };

// Parallel work: one row happens AT THE SAME TIME as (possibly several) other
// positions. Each target position is pinned to ITS OWN step independently.
// position = token (position id or "@external"); stepId = target step uuid, or
// "" when not yet pinned. External targets have no step.
export type ParallelTarget = { position: string; stepId: string };
export type ParallelItem = { what: string; targets: ParallelTarget[] };

export type WaitsGroup = { enabled: boolean; items: WaitItem[] };
export type SendsGroup = { enabled: boolean; items: SendItem[] };
export type ApproverGroup = { enabled: boolean; positions: string[] };
export type ParallelGroup = { enabled: boolean; items: ParallelItem[] };

// Pass/fail decision point. "decider" is a token (position id or "@external"),
// defaulting to the step owner's own position. If it fails, exactly one target:
// a step in the same job (failStepId), another position (failPosition), else nothing set.
export type Decision = {
  enabled: boolean;
  decider: string; // token; default = own position
  failKind: "" | "step" | "position";
  failStepId: string; // step id when failKind === "step"
  failPosition: string; // token when failKind === "position"
  failReason: string;
};

export type Step = {
  id: string; // client id / real uuid; used as back-reference target
  action: string; // required
  waitsFor: WaitsGroup;
  sendsTo: SendsGroup;
  approver: ApproverGroup;
  decision: Decision;
  parallel: ParallelGroup;
};

export type Job = {
  name: string; // required
  trigger: string; // optional
  frequency: string; // optional
  steps: Step[]; // >= 1, each action required
};

export type FormState = {
  positionId: string;
  filledBy: string;
  jobs: Job[];
  blockers: string;
};

export const FREQUENCY_OPTIONS = ["ทุกโปรเจกต์", "รายสัปดาห์", "รายเดือน", "นานๆ ครั้ง"];

export const emptyWaitItem = (): WaitItem => ({ what: "", positions: [] });
export const emptySendItem = (): SendItem => ({ what: "", positions: [], conditional: false, condition: "" });

export const emptyWaits = (): WaitsGroup => ({ enabled: false, items: [] });
export const emptySends = (): SendsGroup => ({ enabled: false, items: [] });
export const emptyApprover = (): ApproverGroup => ({ enabled: false, positions: [] });
export const emptyDecision = (): Decision => ({ enabled: false, decider: "", failKind: "", failStepId: "", failPosition: "", failReason: "" });
export const emptyParallelItem = (): ParallelItem => ({ what: "", targets: [] });
export const emptyParallel = (): ParallelGroup => ({ enabled: false, items: [] });

export const emptyStep = (): Step => ({
  id: newId(),
  action: "",
  waitsFor: emptyWaits(),
  sendsTo: emptySends(),
  approver: emptyApprover(),
  decision: emptyDecision(),
  parallel: emptyParallel(),
});

export const emptyJob = (): Job => ({
  name: "",
  trigger: "",
  frequency: "",
  steps: [emptyStep()],
});

export const emptyForm = (positionId: string, filledBy = ""): FormState => ({
  positionId,
  filledBy,
  jobs: [emptyJob()],
  blockers: "",
});

// ---- DB row shapes (read back through the service role) ----

export type ResponseRow = {
  id: string;
  position_id: string;
  filled_by: string | null;
  blockers: string | null;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  response_id: string;
  job_order: number;
  name: string;
  trigger: string | null;
  frequency: string | null;
};

export type StepRow = {
  id: string;
  job_id: string;
  step_order: number;
  action: string;
};

// One row = one send/wait line item (or one approver group). Targets live in step_link_targets.
export type StepLinkRow = {
  id: string;
  step_id: string;
  kind: LinkKind;
  link_order: number;
  what: string | null;
  conditional: boolean;
  condition: string | null;
  parallel_step_id: string | null; // kind='parallel' only; target step uuid or null
};

export type StepLinkTargetRow = {
  id: string;
  link_id: string;
  position_id: string | null;
  external: boolean;
  parallel_step_id: string | null; // per-target pinned step (kind='parallel' only)
};

export type StepDecisionRow = {
  id: string;
  step_id: string;
  decider_position_id: string | null;
  decider_external: boolean;
  fail_step_id: string | null;
  fail_position_id: string | null;
  fail_external: boolean;
  fail_reason: string | null;
};
