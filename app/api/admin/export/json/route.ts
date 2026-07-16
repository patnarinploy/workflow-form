import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";
import { getPosition, positionName } from "@/lib/positions";
import { JobRow, StepRow, StepLinkRow, LinkKind } from "@/lib/types";

function linkLabel(l: StepLinkRow): string {
  if (l.external) return "ลูกค้า/ภายนอก";
  return l.position_id ? positionName(l.position_id) : "";
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, result } = await loadAndReconcile(supabase);

  const linksByStep = new Map<string, StepLinkRow[]>();
  for (const l of data.links) {
    const arr = linksByStep.get(l.step_id) ?? [];
    arr.push(l);
    linksByStep.set(l.step_id, arr);
  }
  const stepsByJob = new Map<string, StepRow[]>();
  for (const s of data.steps) {
    const arr = stepsByJob.get(s.job_id) ?? [];
    arr.push(s);
    stepsByJob.set(s.job_id, arr);
  }
  const jobsByResponse = new Map<string, JobRow[]>();
  for (const j of data.jobs) {
    const arr = jobsByResponse.get(j.response_id) ?? [];
    arr.push(j);
    jobsByResponse.set(j.response_id, arr);
  }
  const kind = (stepId: string, k: LinkKind) => {
    const rows = (linksByStep.get(stepId) ?? []).filter((l) => l.kind === k);
    if (rows.length === 0) return undefined;
    return { positions: rows.map(linkLabel), what: rows.find((r) => r.what)?.what ?? undefined };
  };

  const positions = data.responses.map((r) => {
    const p = getPosition(r.position_id);
    const jobs = (jobsByResponse.get(r.id) ?? [])
      .sort((a, b) => a.job_order - b.job_order)
      .map((j) => ({
        name: j.name,
        trigger: j.trigger,
        frequency: j.frequency,
        steps: (stepsByJob.get(j.id) ?? [])
          .sort((a, b) => a.step_order - b.step_order)
          .map((s) => ({
            order: s.step_order,
            action: s.action,
            waits_for: kind(s.id, "waits_for"),
            sends_to: kind(s.id, "sends_to"),
            approver: kind(s.id, "approver"),
          })),
      }));
    return {
      position_id: r.position_id,
      name: p?.name ?? r.position_id,
      group: p?.group,
      members: p?.members,
      filled_by: r.filled_by,
      blockers: r.blockers,
      submitted_at: r.updated_at,
      jobs,
    };
  });

  const payload = {
    generated_at: new Date().toISOString(),
    summary: {
      submitted: result.submittedIds.length,
      missing: result.missingIds.map(positionName),
      matched: result.matched.length,
      one_sided: result.oneSided.length,
    },
    positions,
    edges: result.edges.map((e) => ({
      from: e.from,
      from_name: positionName(e.from),
      to: e.to,
      to_name: positionName(e.to),
      status: e.status,
      sender_asserted: e.senderAsserted,
      receiver_asserted: e.receiverAsserted,
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="workflow-truecj.json"`,
    },
  });
}
