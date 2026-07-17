import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Project, ProjectStatus, STATUS_ORDER } from "@/lib/projects";

const STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "done"];

type Body = {
  id?: string;
  name?: string;
  code?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
};

function fields(b: Body) {
  return {
    name: b.name?.trim() || "",
    code: b.code?.trim() || null,
    status: STATUSES.includes(b.status as ProjectStatus) ? (b.status as ProjectStatus) : "active",
    start_date: b.startDate || null,
    end_date: b.endDate || null,
    note: b.note?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("projects").select("*");
  if (error) return NextResponse.json({ error: "โหลดโปรเจกต์ไม่สำเร็จ" }, { status: 500 });
  const projects = ((data as Project[] | null) ?? []).sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "th")
  );
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const f = fields(body);
  if (!f.name) return NextResponse.json({ error: "กรุณาใส่ชื่อโปรเจกต์" }, { status: 400 });
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("projects").insert(f).select("*").single();
  if (error) return NextResponse.json({ error: "สร้างไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.id) return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 400 });
  const f = fields(body);
  if (!f.name) return NextResponse.json({ error: "กรุณาใส่ชื่อโปรเจกต์" }, { status: 400 });
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("projects").update(f).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ error: "แก้ไขไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "ไม่พบโปรเจกต์" }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "ลบไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
