import { SpecialValue } from "./staff";

// In form state, each person/relationship field is an array of "tokens".
// A token is either a STAFF id (e.g. "tuk") or a special option prefixed with "@"
// (e.g. "@self_start"). Person ids never start with "@", so this is unambiguous.

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

export type LinkKind = "from" | "to" | "approver" | "rework";

export type Task = {
  action: string; // ฉันทำอะไร
  inputDesc: string; // ได้อะไรมาถึงจะเริ่ม
  from: string[]; // ได้มาจากใคร (persons + self_start/external)
  outputDesc: string; // ทำเสร็จได้อะไรออกมา
  to: string[]; // ส่งให้ใครต่อ (persons + ends_here/external)
  approver: string[]; // ใครอนุมัติ (persons + no_approval)
  parallelWith: string; // งานนี้ทำพร้อมกับงานอะไร
  rework: string[]; // ถ้าไม่ผ่านกลับไปแก้กับใคร (persons)
};

export type FormState = {
  personId: string;
  tasks: Task[];
  blockers: string;
};

export const emptyTask = (): Task => ({
  action: "",
  inputDesc: "",
  from: [],
  outputDesc: "",
  to: [],
  approver: [],
  parallelWith: "",
  rework: [],
});

export const emptyForm = (personId: string): FormState => ({
  personId,
  tasks: [emptyTask()],
  blockers: "",
});

// Which special options are offered per field.
export const FROM_SPECIALS: SpecialValue[] = ["self_start", "external"];
export const TO_SPECIALS: SpecialValue[] = ["ends_here", "external"];
export const APPROVER_SPECIALS: SpecialValue[] = ["no_approval"];
export const REWORK_SPECIALS: SpecialValue[] = [];

// ---- DB row shapes (as read back through the service role) ----

export type ResponseRow = {
  id: string;
  person_id: string;
  blockers: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  response_id: string;
  task_order: number;
  action: string;
  input_desc: string;
  output_desc: string;
  parallel_with: string | null;
};

export type TaskLinkRow = {
  id: string;
  task_id: string;
  kind: LinkKind;
  person_id: string | null;
  special: SpecialValue | null;
};
