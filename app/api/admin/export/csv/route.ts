import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("steps")
    .select("step_order, action, actor, output, handoff_to, approver, submissions(team_name, submitted_by)")
    .order("submission_id", { ascending: true })
    .order("step_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const header = [
    "team_name",
    "submitted_by",
    "step_order",
    "action",
    "actor",
    "output",
    "handoff_to",
    "approver",
  ];

  type StepJoinRow = {
    step_order: number;
    action: string | null;
    actor: string | null;
    output: string | null;
    handoff_to: string | null;
    approver: string | null;
    submissions: { team_name: string; submitted_by: string } | { team_name: string; submitted_by: string }[] | null;
  };

  const rows = ((data as StepJoinRow[] | null) ?? []).map((s) => {
    const sub = Array.isArray(s.submissions) ? s.submissions[0] : s.submissions;
    return [
      sub?.team_name ?? "",
      sub?.submitted_by ?? "",
      s.step_order,
      s.action ?? "",
      s.actor ?? "",
      s.output ?? "",
      s.handoff_to ?? "",
      s.approver ?? "",
    ];
  });

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  // Prepend UTF-8 BOM so Excel opens Thai text correctly
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workflow-steps.csv"`,
    },
  });
}
