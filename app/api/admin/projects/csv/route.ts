import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { STAFF_ORDERED, staffLabel } from "@/lib/staff";
import { Assignment, Project, INVOLVEMENT_LABEL, STATUS_ORDER, isActive, summarizePeople } from "@/lib/projects";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const supabase = createServiceClient();
  const [{ data: projRows }, { data: asgRows }] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("assignments").select("*"),
  ]);
  const projects = ((projRows as Project[] | null) ?? [])
    .filter(isActive)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "th"));
  const assignments = (asgRows as Assignment[] | null) ?? [];

  const cell = new Map<string, Assignment>();
  for (const a of assignments) cell.set(`${a.person_id}:${a.project_id}`, a);

  const activeIds = new Set(projects.map((p) => p.id));
  const summaries = summarizePeople(activeIds, assignments);
  const scoreById = new Map(summaries.map((s) => [s.staffId, s.score]));

  const header = ["คน", ...projects.map((p) => p.name), "คะแนนภาระ"];
  const rows = STAFF_ORDERED.map((s) => {
    const cells = projects.map((p) => {
      const a = cell.get(`${s.id}:${p.id}`);
      if (!a) return "–";
      return INVOLVEMENT_LABEL[a.involvement] + (a.is_owner ? " (เจ้าของ)" : "");
    });
    return [staffLabel(s.id), ...cells, String(scoreById.get(s.id) ?? 0)];
  });

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workflow-truecj-projects.csv"`,
    },
  });
}
