import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";
import { getStaff, staffNick } from "@/lib/staff";
import { JobRow, StepRow, StepLinkRow, LinkKind } from "@/lib/types";

function linkLabel(l: StepLinkRow): string {
  if (l.external) return "ลูกค้า/ภายนอก";
  return l.person_id ? staffNick(l.person_id) : "";
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
    return { people: rows.map(linkLabel), what: rows.find((r) => r.what)?.what ?? undefined };
  };

  const people = data.responses.map((r) => {
    const staff = getStaff(r.person_id);
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
    return { person_id: r.person_id, nick: staff?.nick ?? r.person_id, title: staff?.title, group: staff?.group, blockers: r.blockers, submitted_at: r.updated_at, jobs };
  });

  const payload = {
    generated_at: new Date().toISOString(),
    summary: {
      submitted: result.submittedIds.length,
      missing: result.missingIds.map(staffNick),
      matched: result.matched.length,
      one_sided: result.oneSided.length,
    },
    people,
    edges: result.edges.map((e) => ({
      from: e.from,
      from_nick: staffNick(e.from),
      to: e.to,
      to_nick: staffNick(e.to),
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
