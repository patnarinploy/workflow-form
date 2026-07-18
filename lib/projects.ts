export type ProjectStatus = "planning" | "active" | "on_hold" | "done";
export type Involvement = "high" | "medium" | "low";

export type Project = {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Assignment = {
  id: string;
  project_id: string;
  person_id: string;
  involvement: Involvement;
  role_note: string | null;
  is_owner: boolean;
  source: "self" | "manager";
  updated_at: string;
};

export const INVOLVEMENT_WEIGHT: Record<Involvement, number> = { high: 3, medium: 2, low: 1 };
export const INVOLVEMENT_LABEL: Record<Involvement, string> = { high: "สูง", medium: "กลาง", low: "ต่ำ" };
export const INVOLVEMENT_COLOR: Record<Involvement, string> = { high: "#57C79E", medium: "#A6E3CE", low: "#E4F5EE" };
export const INVOLVEMENT_HINT: Record<Involvement, string> = {
  high: "เป็นงานหลัก ทุ่มเวลาให้อันนี้มากที่สุด",
  medium: "ทำสม่ำเสมอ แต่ไม่ใช่งานหลัก",
  low: "แตะเป็นครั้งคราว",
};
export const INVOLVEMENT_ORDER: Involvement[] = ["high", "medium", "low"];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "วางแผน",
  active: "กำลังทำ",
  on_hold: "พัก",
  done: "จบแล้ว",
};
export const STATUS_ORDER: ProjectStatus[] = ["planning", "active", "on_hold", "done"];

export const isActive = (p: Project) => p.status !== "done";

// ---- per-person load summary (over ACTIVE projects only = current load) ----
export type PersonSummary = {
  staffId: string;
  high: number;
  medium: number;
  low: number;
  projectCount: number;
  ownerCount: number;
  score: number; // (high*3) + (medium*2) + (low*1) — RAW score, compare within team only
};

// Summaries are produced for the given staff ids, in that order. Pass the
// ordered staff you want rows for (e.g. all staff for the matrix, active only
// for thresholds). Inactive staff should be excluded from threshold inputs.
export function summarizePeople(
  activeProjectIds: Set<string>,
  assignments: Assignment[],
  staffIds: string[]
): PersonSummary[] {
  const byPerson = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!activeProjectIds.has(a.project_id)) continue;
    const arr = byPerson.get(a.person_id) ?? [];
    arr.push(a);
    byPerson.set(a.person_id, arr);
  }
  return staffIds.map((id) => {
    const as = byPerson.get(id) ?? [];
    const high = as.filter((a) => a.involvement === "high").length;
    const medium = as.filter((a) => a.involvement === "medium").length;
    const low = as.filter((a) => a.involvement === "low").length;
    return {
      staffId: id,
      high,
      medium,
      low,
      projectCount: as.length,
      ownerCount: as.filter((a) => a.is_owner).length,
      score: high * INVOLVEMENT_WEIGHT.high + medium * INVOLVEMENT_WEIGHT.medium + low * INVOLVEMENT_WEIGHT.low,
    };
  });
}

// Score cutoff (inclusive) for the top 25% of people who have any load.
export function topScoreThreshold(summaries: PersonSummary[]): number {
  const scores = summaries.map((s) => s.score).filter((v) => v > 0).sort((a, b) => b - a);
  if (scores.length === 0) return Infinity;
  const idx = Math.max(0, Math.ceil(scores.length * 0.25) - 1);
  return scores[idx];
}

// Score cutoff (inclusive) for the bottom 25% among people who have any load.
export function bottomScoreThreshold(summaries: PersonSummary[]): number {
  const scores = summaries.map((s) => s.score).filter((v) => v > 0).sort((a, b) => a - b);
  if (scores.length === 0) return -Infinity;
  const idx = Math.max(0, Math.ceil(scores.length * 0.25) - 1);
  return scores[idx];
}
