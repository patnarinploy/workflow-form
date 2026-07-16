import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getPosition } from "@/lib/positions";
import { Job, Reveal, LinkKind, isSpecialToken } from "@/lib/types";

type Payload = { positionId: string; filledBy?: string; jobs: Job[]; blockers?: string };

function jobsValid(jobs: Job[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every(
    (j) => !!j.name?.trim() && Array.isArray(j.steps) && j.steps.length > 0 && j.steps.every((s) => !!s.action?.trim())
  );
}

type LinkInsert = { step_id: string; kind: LinkKind; position_id: string | null; external: boolean; what: string | null };

function revealRows(stepId: string, kind: LinkKind, reveal: Reveal | undefined): LinkInsert[] {
  if (!reveal || !reveal.enabled) return [];
  const rows: LinkInsert[] = [];
  const what = kind === "approver" ? null : reveal.what?.trim() || null;
  for (const token of reveal.positions ?? []) {
    if (isSpecialToken(token)) {
      rows.push({ step_id: stepId, kind, position_id: null, external: true, what });
    } else if (getPosition(token)) {
      rows.push({ step_id: stepId, kind, position_id: token, external: false, what });
    }
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

  if (!body.positionId || !getPosition(body.positionId)) {
    return NextResponse.json({ error: "ไม่พบตำแหน่งนี้" }, { status: 400 });
  }
  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  if (!jobsValid(jobs)) {
    return NextResponse.json({ error: "กรุณากรอกชื่องานและขั้นตอนให้ครบ" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: response, error: respErr } = await supabase
    .from("responses")
    .upsert(
      {
        position_id: body.positionId,
        filled_by: body.filledBy?.trim() || null,
        blockers: body.blockers?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "position_id" }
    )
    .select("id")
    .single();
  if (respErr || !response) {
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }

  const { error: delErr } = await supabase.from("jobs").delete().eq("response_id", response.id);
  if (delErr) {
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ (clear)" }, { status: 500 });
  }

  const { data: insertedJobs, error: jobErr } = await supabase
    .from("jobs")
    .insert(
      jobs.map((j, i) => ({
        response_id: response.id,
        job_order: i + 1,
        name: j.name.trim(),
        trigger: j.trigger?.trim() || null,
        frequency: j.frequency?.trim() || null,
      }))
    )
    .select("id, job_order");
  if (jobErr || !insertedJobs) {
    return NextResponse.json({ error: "บันทึกงานไม่สำเร็จ" }, { status: 500 });
  }
  const jobIdByOrder = new Map<number, string>();
  for (const j of insertedJobs as { id: string; job_order: number }[]) jobIdByOrder.set(j.job_order, j.id);

  const stepInsert: { job_id: string; step_order: number; action: string }[] = [];
  jobs.forEach((job, ji) => {
    const jobId = jobIdByOrder.get(ji + 1);
    if (!jobId) return;
    job.steps.forEach((s, si) => {
      stepInsert.push({ job_id: jobId, step_order: si + 1, action: s.action.trim() });
    });
  });
  const { data: insertedSteps, error: stepErr } = await supabase
    .from("steps")
    .insert(stepInsert)
    .select("id, job_id, step_order");
  if (stepErr || !insertedSteps) {
    return NextResponse.json({ error: "บันทึกขั้นตอนไม่สำเร็จ" }, { status: 500 });
  }
  const stepIdByKey = new Map<string, string>();
  for (const s of insertedSteps as { id: string; job_id: string; step_order: number }[]) {
    stepIdByKey.set(`${s.job_id}:${s.step_order}`, s.id);
  }

  const linkRows: LinkInsert[] = [];
  jobs.forEach((job, ji) => {
    const jobId = jobIdByOrder.get(ji + 1);
    if (!jobId) return;
    job.steps.forEach((s, si) => {
      const stepId = stepIdByKey.get(`${jobId}:${si + 1}`);
      if (!stepId) return;
      linkRows.push(...revealRows(stepId, "waits_for", s.waitsFor));
      linkRows.push(...revealRows(stepId, "sends_to", s.sendsTo));
      linkRows.push(...revealRows(stepId, "approver", s.approver));
    });
  });

  if (linkRows.length) {
    const { error: linkErr } = await supabase.from("step_links").insert(linkRows);
    if (linkErr) {
      return NextResponse.json({ error: "บันทึกจุดเชื่อมไม่สำเร็จ" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: response.id });
}
