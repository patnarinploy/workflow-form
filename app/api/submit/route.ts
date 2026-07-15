import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/staff";
import { Task, LinkKind, isSpecialToken, specialOf } from "@/lib/types";

type Payload = { personId: string; tasks: Task[]; blockers?: string };

function taskValid(t: Task): boolean {
  return (
    !!t.action?.trim() &&
    !!t.inputDesc?.trim() &&
    Array.isArray(t.from) &&
    t.from.length > 0 &&
    !!t.outputDesc?.trim() &&
    Array.isArray(t.to) &&
    t.to.length > 0
  );
}

// Build task_links rows for one task. Person tokens must map to a real staff id.
function buildLinks(taskId: string, kind: LinkKind, tokens: string[]) {
  const rows: { task_id: string; kind: LinkKind; person_id: string | null; special: string | null }[] = [];
  for (const token of tokens ?? []) {
    if (isSpecialToken(token)) {
      rows.push({ task_id: taskId, kind, person_id: null, special: specialOf(token) });
    } else if (getStaff(token)) {
      rows.push({ task_id: taskId, kind, person_id: token, special: null });
    }
    // unknown tokens are dropped — the UI only ever emits valid ids/specials
  }
  return rows;
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  if (!body.personId || !getStaff(body.personId)) {
    return NextResponse.json({ error: "ไม่พบชื่อพนักงานนี้" }, { status: 400 });
  }
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  if (tasks.length === 0 || !tasks.every(taskValid)) {
    return NextResponse.json({ error: "กรุณากรอกงานให้ครบทุกช่องที่จำเป็น" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Upsert the response by person_id (unique) so re-submitting edits in place.
  const { data: response, error: respErr } = await supabase
    .from("responses")
    .upsert(
      {
        person_id: body.personId,
        blockers: body.blockers?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "person_id" }
    )
    .select("id")
    .single();

  if (respErr || !response) {
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }

  // Replace-all semantics: clear previous tasks (cascade clears their links).
  const { error: delErr } = await supabase.from("tasks").delete().eq("response_id", response.id);
  if (delErr) {
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ (clear)" }, { status: 500 });
  }

  // Insert tasks.
  const taskInsert = tasks.map((t, i) => ({
    response_id: response.id,
    task_order: i + 1,
    action: t.action.trim(),
    input_desc: t.inputDesc.trim(),
    output_desc: t.outputDesc.trim(),
    parallel_with: t.parallelWith?.trim() || null,
  }));
  const { data: insertedTasks, error: taskErr } = await supabase
    .from("tasks")
    .insert(taskInsert)
    .select("id, task_order");
  if (taskErr || !insertedTasks) {
    return NextResponse.json({ error: "บันทึกงานไม่สำเร็จ" }, { status: 500 });
  }

  // Map inserted rows back to source tasks by order, then build all links.
  const byOrder = new Map<number, string>();
  for (const row of insertedTasks as { id: string; task_order: number }[]) {
    byOrder.set(row.task_order, row.id);
  }
  const linkRows: ReturnType<typeof buildLinks> = [];
  tasks.forEach((t, i) => {
    const taskId = byOrder.get(i + 1);
    if (!taskId) return;
    linkRows.push(...buildLinks(taskId, "from", t.from));
    linkRows.push(...buildLinks(taskId, "to", t.to));
    linkRows.push(...buildLinks(taskId, "approver", t.approver));
    linkRows.push(...buildLinks(taskId, "rework", t.rework));
  });

  if (linkRows.length) {
    const { error: linkErr } = await supabase.from("task_links").insert(linkRows);
    if (linkErr) {
      return NextResponse.json({ error: "บันทึกจุดเชื่อมไม่สำเร็จ" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: response.id });
}
