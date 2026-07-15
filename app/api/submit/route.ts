import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { FormData } from "@/lib/types";

const REQUIRED_FIELDS: (keyof FormData)[] = [
  "teamName",
  "submittedBy",
  "triggerEvent",
  "endCondition",
  "processName",
  "roles",
];

export async function POST(req: Request) {
  let body: FormData;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  for (const key of REQUIRED_FIELDS) {
    if (!String(body[key] ?? "").trim()) {
      return NextResponse.json({ error: `กรุณากรอกข้อมูลให้ครบ (ขาด ${key})` }, { status: 400 });
    }
  }

  const steps = Array.isArray(body.steps) ? body.steps : [];
  const filledSteps = steps.filter((s) =>
    [s.action, s.actor, s.output, s.handoffTo, s.approver].some((v) => String(v ?? "").trim())
  );

  const supabase = createServiceClient();

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({
      team_name: body.teamName.trim(),
      submitted_by: body.submittedBy.trim(),
      process_name: body.processName.trim(),
      trigger_event: body.triggerEvent.trim(),
      end_condition: body.endCondition.trim(),
      roles: body.roles.trim(),
      parallel_work: body.parallelWork?.trim() || null,
      rework_notes: body.reworkNotes?.trim() || null,
      input_from: body.inputFrom?.trim() || null,
      output_to: body.outputTo?.trim() || null,
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    return NextResponse.json({ error: "บันทึกข้อมูลไม่สำเร็จ" }, { status: 500 });
  }

  if (filledSteps.length) {
    const { error: stepsError } = await supabase.from("steps").insert(
      filledSteps.map((s, idx) => ({
        submission_id: submission.id,
        step_order: idx + 1,
        action: s.action?.trim() || null,
        actor: s.actor?.trim() || null,
        output: s.output?.trim() || null,
        handoff_to: s.handoffTo?.trim() || null,
        approver: s.approver?.trim() || null,
      }))
    );

    if (stepsError) {
      return NextResponse.json({ error: "บันทึกขั้นตอนไม่สำเร็จ" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, id: submission.id });
}
