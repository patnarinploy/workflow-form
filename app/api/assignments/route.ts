import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadDirectory } from "@/lib/directory";
import { Assignment, Involvement } from "@/lib/projects";

const INVOLVEMENTS: Involvement[] = ["high", "medium", "low"];

// GET /api/assignments?person=<id> — that person's assignments (for /my-projects).
export async function GET(req: Request) {
  const person = new URL(req.url).searchParams.get("person") ?? "";
  const supabase = createServiceClient();
  const dir = await loadDirectory(supabase);
  if (!dir.getStaff(person)) return NextResponse.json({ error: "ไม่พบพนักงานคนนี้" }, { status: 400 });
  const { data, error } = await supabase.from("assignments").select("*").eq("person_id", person);
  if (error) return NextResponse.json({ error: "โหลดข้อมูลไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ assignments: (data as Assignment[] | null) ?? [] });
}

// POST — create/update the current person's assignment on a project.
export async function POST(req: Request) {
  let body: { projectId?: string; personId?: string; involvement?: string; isOwner?: boolean; roleNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body.projectId) return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 400 });
  if (!body.involvement || !INVOLVEMENTS.includes(body.involvement as Involvement)) {
    return NextResponse.json({ error: "กรุณาเลือกระดับความเกี่ยวข้อง" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const dir = await loadDirectory(supabase);
  if (!body.personId || !dir.getStaff(body.personId)) return NextResponse.json({ error: "ไม่พบพนักงานคนนี้" }, { status: 400 });
  const { data: project } = await supabase.from("projects").select("id").eq("id", body.projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "ไม่พบโปรเจกต์นี้" }, { status: 400 });

  const { error } = await supabase.from("assignments").upsert(
    {
      project_id: body.projectId,
      person_id: body.personId,
      involvement: body.involvement,
      is_owner: !!body.isOwner,
      role_note: body.roleNote?.trim() || null,
      source: "self",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,person_id" }
  );
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/assignments?project=<id>&person=<id> — remove an assignment (toggle off).
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get("project") ?? "";
  const person = url.searchParams.get("person") ?? "";
  const supabase = createServiceClient();
  const dir = await loadDirectory(supabase);
  if (!dir.getStaff(person) || !project) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  const { error } = await supabase.from("assignments").delete().eq("project_id", project).eq("person_id", person);
  if (error) return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
