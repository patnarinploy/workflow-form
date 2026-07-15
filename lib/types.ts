import { SpecialValue } from "./staff";

// Person/relationship fields hold "tokens": a STAFF id (e.g. "tuk") or a special
// option prefixed with "@" (e.g. "@external"). Person ids never start with "@".
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

// v3 model: person -> job -> step, with optional per-step links.
export type LinkKind = "waits_for" | "sends_to" | "approver";

// A revealed (checkbox-enabled) section on a step.
export type Reveal = {
  enabled: boolean;
  people: string[]; // tokens: staff ids + "@external"
  what: string; // used by waits_for / sends_to only
};

export type Step = {
  action: string; // required
  waitsFor: Reveal;
  sendsTo: Reveal;
  approver: Reveal; // "what" unused
};

export type Job = {
  name: string; // required
  trigger: string; // optional
  frequency: string; // optional
  steps: Step[]; // >= 1, each action required
};

export type FormState = {
  personId: string;
  jobs: Job[];
  blockers: string;
};

export const FREQUENCY_OPTIONS = ["ทุกโปรเจกต์", "รายสัปดาห์", "รายเดือน", "นานๆ ครั้ง"];

export const emptyReveal = (): Reveal => ({ enabled: false, people: [], what: "" });

export const emptyStep = (): Step => ({
  action: "",
  waitsFor: emptyReveal(),
  sendsTo: emptyReveal(),
  approver: emptyReveal(),
});

export const emptyJob = (): Job => ({
  name: "",
  trigger: "",
  frequency: "",
  steps: [emptyStep()],
});

export const emptyForm = (personId: string): FormState => ({
  personId,
  jobs: [emptyJob()],
  blockers: "",
});

// ---- DB row shapes (read back through the service role) ----

export type ResponseRow = {
  id: string;
  person_id: string;
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

export type StepLinkRow = {
  id: string;
  step_id: string;
  kind: LinkKind;
  person_id: string | null;
  external: boolean;
  what: string | null;
};
