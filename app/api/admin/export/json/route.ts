import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAndReconcile } from "@/lib/reconcile";
import { getStaff, staffNick, SPECIAL_LABEL } from "@/lib/staff";
import { TaskRow, TaskLinkRow, LinkKind } from "@/lib/types";

function labelLink(l: TaskLinkRow): string {
  if (l.special) return SPECIAL_LABEL[l.special];
  return l.person_id ? staffNick(l.person_id) : "";
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, result } = await loadAndReconcile(supabase);

  const linksByTask = new Map<string, TaskLinkRow[]>();
  for (const l of data.links) {
    const arr = linksByTask.get(l.task_id) ?? [];
    arr.push(l);
    linksByTask.set(l.task_id, arr);
  }
  const tasksByResponse = new Map<string, TaskRow[]>();
  for (const t of data.tasks) {
    const arr = tasksByResponse.get(t.response_id) ?? [];
    arr.push(t);
    tasksByResponse.set(t.response_id, arr);
  }
  const kindLabels = (taskId: string, kind: LinkKind) =>
    (linksByTask.get(taskId) ?? []).filter((l) => l.kind === kind).map(labelLink);

  const people = data.responses.map((r) => {
    const staff = getStaff(r.person_id);
    const tasks = (tasksByResponse.get(r.id) ?? [])
      .sort((a, b) => a.task_order - b.task_order)
      .map((t) => ({
        order: t.task_order,
        action: t.action,
        input_desc: t.input_desc,
        output_desc: t.output_desc,
        parallel_with: t.parallel_with,
        from: kindLabels(t.id, "from"),
        to: kindLabels(t.id, "to"),
        approver: kindLabels(t.id, "approver"),
        rework: kindLabels(t.id, "rework"),
      }));
    return {
      person_id: r.person_id,
      nick: staff?.nick ?? r.person_id,
      title: staff?.title,
      group: staff?.group,
      blockers: r.blockers,
      submitted_at: r.updated_at,
      tasks,
    };
  });

  const payload = {
    generated_at: new Date().toISOString(),
    summary: {
      submitted: result.submittedIds.length,
      missing: result.missingIds.map(staffNick),
      matched: result.matched.length,
      one_sided: result.oneSided.length,
      orphans: result.orphans.map((o) => staffNick(o.personId)),
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
