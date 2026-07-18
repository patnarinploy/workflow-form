import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadDirectory } from "@/lib/directory";
import { Job, LinkKind, isSpecialToken } from "@/lib/types";

type Payload = { positionId: string; filledBy?: string; jobs: Job[]; blockers?: string };

function jobsValid(jobs: Job[]): boolean {
  if (jobs.length === 0) return false;
  return jobs.every(
    (j) => !!j.name?.trim() && Array.isArray(j.steps) && j.steps.length > 0 && j.steps.every((s) => !!s.action?.trim())
  );
}

// A link to be inserted, tagged with a natural key so we can attach targets after insert.
type LinkDraft = {
  step_id: string;
  kind: LinkKind;
  link_order: number;
  what: string | null;
  conditional: boolean;
  condition: string | null;
  tokens: string[]; // position tokens for this item
};

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const dir = await loadDirectory(supabase);
  const getPosition = (id: string) => dir.getPosition(id);

  if (!body.positionId || !getPosition(body.positionId)) {
    return NextResponse.json({ error: "ไม่พบตำแหน่งนี้" }, { status: 400 });
  }
  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  if (!jobsValid(jobs)) {
    return NextResponse.json({ error: "กรุณากรอกชื่องานและขั้นตอนให้ครบ" }, { status: 400 });
  }

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

  // Replace-all: clearing jobs cascades to steps -> step_links -> step_link_targets -> step_decisions.
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

  // Map each step's client id -> the real uuid it was assigned, so fail-target
  // back-references (which point at client ids) can be remapped on save.
  const realStepIdByClient = new Map<string, string>();
  jobs.forEach((job, ji) => {
    const jobId = jobIdByOrder.get(ji + 1);
    if (!jobId) return;
    job.steps.forEach((s, si) => {
      const realId = stepIdByKey.get(`${jobId}:${si + 1}`);
      if (realId && s.id) realStepIdByClient.set(s.id, realId);
    });
  });

  const cleanTokens = (tokens: string[]) =>
    (tokens ?? []).filter((t) => isSpecialToken(t) || !!getPosition(t));

  // Build link drafts (one per line item / approver group) with their target tokens.
  const drafts: LinkDraft[] = [];
  jobs.forEach((job, ji) => {
    const jobId = jobIdByOrder.get(ji + 1);
    if (!jobId) return;
    job.steps.forEach((s, si) => {
      const stepId = stepIdByKey.get(`${jobId}:${si + 1}`);
      if (!stepId) return;

      if (s.waitsFor?.enabled) {
        s.waitsFor.items.forEach((item, k) => {
          const tokens = cleanTokens(item.positions);
          if (tokens.length === 0) return;
          drafts.push({ step_id: stepId, kind: "waits_for", link_order: k, what: item.what?.trim() || null, conditional: false, condition: null, tokens });
        });
      }
      if (s.sendsTo?.enabled) {
        s.sendsTo.items.forEach((item, k) => {
          const tokens = cleanTokens(item.positions);
          if (tokens.length === 0) return;
          drafts.push({
            step_id: stepId,
            kind: "sends_to",
            link_order: k,
            what: item.what?.trim() || null,
            conditional: !!item.conditional,
            condition: item.conditional ? item.condition?.trim() || null : null,
            tokens,
          });
        });
      }
      if (s.approver?.enabled) {
        const tokens = cleanTokens(s.approver.positions);
        if (tokens.length > 0) {
          drafts.push({ step_id: stepId, kind: "approver", link_order: 0, what: null, conditional: false, condition: null, tokens });
        }
      }
    });
  });

  if (drafts.length) {
    const { data: insertedLinks, error: linkErr } = await supabase
      .from("step_links")
      .insert(
        drafts.map((d) => ({
          step_id: d.step_id,
          kind: d.kind,
          link_order: d.link_order,
          what: d.what,
          conditional: d.conditional,
          condition: d.condition,
        }))
      )
      .select("id, step_id, kind, link_order");
    if (linkErr || !insertedLinks) {
      return NextResponse.json({ error: "บันทึกจุดเชื่อมไม่สำเร็จ" }, { status: 500 });
    }
    const linkIdByKey = new Map<string, string>();
    for (const l of insertedLinks as { id: string; step_id: string; kind: string; link_order: number }[]) {
      linkIdByKey.set(`${l.step_id}:${l.kind}:${l.link_order}`, l.id);
    }

    const targetRows: { link_id: string; position_id: string | null; external: boolean }[] = [];
    for (const d of drafts) {
      const linkId = linkIdByKey.get(`${d.step_id}:${d.kind}:${d.link_order}`);
      if (!linkId) continue;
      for (const token of d.tokens) {
        if (isSpecialToken(token)) targetRows.push({ link_id: linkId, position_id: null, external: true });
        else targetRows.push({ link_id: linkId, position_id: token, external: false });
      }
    }
    if (targetRows.length) {
      const { error: tErr } = await supabase.from("step_link_targets").insert(targetRows);
      if (tErr) {
        return NextResponse.json({ error: "บันทึกปลายทางไม่สำเร็จ" }, { status: 500 });
      }
    }
  }

  // step_decisions (pass/fail). The DB requires exactly one fail target per row.
  const decisionRows: {
    step_id: string;
    decider_position_id: string | null;
    decider_external: boolean;
    fail_step_id: string | null;
    fail_position_id: string | null;
    fail_external: boolean;
    fail_reason: string | null;
  }[] = [];
  jobs.forEach((job, ji) => {
    const jobId = jobIdByOrder.get(ji + 1);
    if (!jobId) return;
    job.steps.forEach((s, si) => {
      const d = s.decision;
      if (!d?.enabled) return;
      const stepId = stepIdByKey.get(`${jobId}:${si + 1}`);
      if (!stepId) return;

      // decider: null = own position
      let decider_position_id: string | null = null;
      let decider_external = false;
      if (d.decider) {
        if (isSpecialToken(d.decider)) decider_external = true;
        else if (getPosition(d.decider) && d.decider !== body.positionId) decider_position_id = d.decider;
      }

      // fail target: exactly one of the three
      let fail_step_id: string | null = null;
      let fail_position_id: string | null = null;
      let fail_external = false;
      if (d.failKind === "step" && d.failStepId) {
        fail_step_id = realStepIdByClient.get(d.failStepId) ?? null;
      } else if (d.failKind === "position" && d.failPosition) {
        if (isSpecialToken(d.failPosition)) fail_external = true;
        else if (getPosition(d.failPosition)) fail_position_id = d.failPosition;
      }
      const targetCount = (fail_step_id ? 1 : 0) + (fail_position_id ? 1 : 0) + (fail_external ? 1 : 0);
      if (targetCount !== 1) return; // skip incomplete decisions (constraint requires exactly one)

      decisionRows.push({
        step_id: stepId,
        decider_position_id,
        decider_external,
        fail_step_id,
        fail_position_id,
        fail_external,
        fail_reason: d.failReason?.trim() || null,
      });
    });
  });
  if (decisionRows.length) {
    const { error: decErr } = await supabase.from("step_decisions").insert(decisionRows);
    if (decErr) {
      return NextResponse.json({ error: "บันทึกจุดตัดสินใจไม่สำเร็จ" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: response.id });
}
