import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const supabase = createServiceClient();
  const { result, dir } = await loadAndReconcile(supabase);
  const positionName = (id: string) => dir.positionName(id);

  const header = [
    "from_id",
    "from_name",
    "to_id",
    "to_name",
    "status",
    "sender_asserted",
    "receiver_asserted",
  ];

  const rows = result.edges.map((e) => [
    e.from,
    positionName(e.from),
    e.to,
    positionName(e.to),
    e.status,
    e.senderAsserted ? "yes" : "no",
    e.receiverAsserted ? "yes" : "no",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  // Prepend UTF-8 BOM so Excel opens Thai text correctly
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="workflow-truecj-links.csv"`,
    },
  });
}
