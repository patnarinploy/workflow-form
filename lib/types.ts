export type StepRow = {
  action: string;
  actor: string;
  output: string;
  handoffTo: string;
  approver: string;
};

export type FormData = {
  teamName: string;
  submittedBy: string;
  triggerEvent: string;
  endCondition: string;
  processName: string;
  roles: string;
  steps: StepRow[];
  parallelWork: string;
  reworkNotes: string;
  inputFrom: string;
  outputTo: string;
};

export const TEAMS = ["Production", "Operation", "Commercial", "Creative Solution"] as const;

export const emptyStep = (): StepRow => ({
  action: "",
  actor: "",
  output: "",
  handoffTo: "",
  approver: "",
});

export const emptyForm = (): FormData => ({
  teamName: "",
  submittedBy: "",
  triggerEvent: "",
  endCondition: "",
  processName: "",
  roles: "",
  steps: Array.from({ length: 8 }, emptyStep),
  parallelWork: "",
  reworkNotes: "",
  inputFrom: "",
  outputTo: "",
});
