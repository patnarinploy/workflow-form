import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Project, STATUS_ORDER } from "@/lib/projects";

// Public: the list of projects an employee can pick from on /my-projects.
// Only non-done projects are selectable.
export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("projects").select("*").neq("status", "done");
  if (error) return NextResponse.json({ error: "โหลดโปรเจกต์ไม่สำเร็จ" }, { status: 500 });
  const projects = ((data as Project[] | null) ?? []).sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "th")
  );
  return NextResponse.json({ projects });
}
