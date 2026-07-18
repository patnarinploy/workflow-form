import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { StaffRow, rowToStaff } from "@/lib/directory";

// Admin-only (guarded by middleware). No delete — staff can only be toggled
// is_active. New people get a uuid id (never derived from the nickname, since
// nicknames repeat — there are two "พลอย").

export async function POST(req: Request) {
  let body: { nick?: string; fullName?: string; positionId?: string; unit?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const nick = body.nick?.trim();
  const positionId = body.positionId?.trim();
  if (!nick) return NextResponse.json({ error: "กรุณาใส่ชื่อเล่น" }, { status: 400 });
  if (!positionId) return NextResponse.json({ error: "กรุณาเลือกตำแหน่ง" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: pos } = await supabase.from("positions").select("id").eq("id", positionId).maybeSingle();
  if (!pos) return NextResponse.json({ error: "ไม่พบตำแหน่งนี้" }, { status: 400 });

  const { data: maxRow } = await supabase.from("staff").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("staff")
    .insert({
      id: crypto.randomUUID(),
      nick,
      full_name: body.fullName?.trim() || null,
      position_id: positionId,
      unit: body.unit?.trim() || null,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: "เพิ่มพนักงานไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ staff: rowToStaff(data as StaffRow) });
}

export async function PATCH(req: Request) {
  let body: { id?: string; nick?: string; fullName?: string; positionId?: string; unit?: string; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 400 });

  const supabase = createServiceClient();

  if (typeof body.positionId === "string" && body.positionId.trim()) {
    const { data: pos } = await supabase.from("positions").select("id").eq("id", body.positionId.trim()).maybeSingle();
    if (!pos) return NextResponse.json({ error: "ไม่พบตำแหน่งนี้" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.nick === "string" && body.nick.trim()) patch.nick = body.nick.trim();
  if (typeof body.fullName === "string") patch.full_name = body.fullName.trim() || null;
  if (typeof body.positionId === "string" && body.positionId.trim()) patch.position_id = body.positionId.trim();
  if (typeof body.unit === "string") patch.unit = body.unit.trim() || null;
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

  const { data, error } = await supabase.from("staff").update(patch).eq("id", body.id).select("*").single();
  if (error || !data) return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ staff: rowToStaff(data as StaffRow) });
}
