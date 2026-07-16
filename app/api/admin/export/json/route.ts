import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";
import { getPosition, positionName } from "@/lib/positions";
import { JobRow, StepRow, StepLinkRow, StepLinkTargetRow } from "@/lib/types";

export async function GET() {
  const supabase = createServiceClient();
  const { data, result } = await loadAndReconcile(supabase);

  const targetsByLink = new Map<string, StepLinkTargetRow[]>();
  for (const t of data.targets) {
    const arr = targetsByLink.get(t.link_id) ?? [];
    arr.push(t);
    targetsByLink.set(t.link_id, arr);
  }
  const targetLabels = (linkId: string): string[] =>
    (targetsByLink.get(linkId) ?? []).map((t) => (t.external ? "ลูกค้า/ภายนอก" : t.position_id ? positionName(t.position_id) : "")).filter(Boolean);

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

  const stepPayload = (s: StepRow) => {
    const ls = (linksByStep.get(s.id) ?? []).slice().sort((a, b) => a.link_order - b.link_order);
    const waits_for = ls
      .filter((l) => l.kind === "waits_for")
      .map((l) => ({ what: l.what ?? null, from: targetLabels(l.id) }));
    const sends_to = ls
      .filter((l) => l.kind === "sends_to")
      .map((l) => ({ what: l.what ?? null, conditional: !!l.conditional, condition: l.condition ?? null, to: targetLabels(l.id) }));
    const approver = ls.filter((l) => l.kind === "approver").flatMap((l) => targetLabels(l.id));
    return {
      order: s.step_order,
      action: s.action,
      waits_for: waits_for.length ? waits_for : undefined,
      sends_to: sends_to.length ? sends_to : undefined,
      approver: approver.length ? approver : undefined,
    };
  };

  const positions = data.responses.map((r) => {
    const p = getPosition(r.position_id);
    const jobs = (jobsByResponse.get(r.id) ?? [])
      .sort((a, b) => a.job_order - b.job_order)
      .map((j) => ({
        name: j.name,
        trigger: j.trigger,
        frequency: j.frequency,
        steps: (stepsByJob.get(j.id) ?? []).sort((a, b) => a.step_order - b.step_order).map(stepPayload),
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
      sender_context: e.senderContext,
      receiver_context: e.receiverContext,
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="workflow-truecj.json"`,
    },
  });
}
