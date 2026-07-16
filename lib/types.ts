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

// v4 model: position -> job -> step, with optional per-step links.
// Each handoff is a LINE ITEM (not a single multi-select) because one step can
// send different things to different positions, sometimes conditionally.
export type LinkKind = "waits_for" | "sends_to" | "approver";

// "positions" holds tokens: position ids + "@external"
export type WaitItem = { what: string; positions: string[] };
export type SendItem = { what: string; positions: string[]; conditional: boolean; condition: string };

export type WaitsGroup = { enabled: boolean; items: WaitItem[] };
export type SendsGroup = { enabled: boolean; items: SendItem[] };
export type ApproverGroup = { enabled: boolean; positions: string[] };

export type Step = {
  action: string; // required
  waitsFor: WaitsGroup;
  sendsTo: SendsGroup;
  approver: ApproverGroup;
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

export const emptyStep = (): Step => ({
  action: "",
  waitsFor: emptyWaits(),
  sendsTo: emptySends(),
  approver: emptyApprover(),
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
};

export type StepLinkTargetRow = {
  id: string;
  link_id: string;
  position_id: string | null;
  external: boolean;
};
