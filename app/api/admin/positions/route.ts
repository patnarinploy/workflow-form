import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PositionRow, rowToPosition } from "@/lib/directory";

// All mutations here are admin-only: the middleware guards /api/admin/* against
// ADMIN_COOKIE. There is intentionally NO delete — positions can only be
// deactivated (is_active=false), and never while active staff remain in them.

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "position";
}

async function uniqueId(supabase: ReturnType<typeof createServiceClient>, base: string): Promise<string> {
  const { data } = await supabase.from("positions").select("id");
  const taken = new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export async function POST(req: Request) {
  let body: { name?: string; group?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const name = body.name?.trim();
  const group = body.group?.trim();
  if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อตำแหน่ง" }, { status: 400 });
  if (!group) return NextResponse.json({ error: "กรุณาเลือกหรือใส่กลุ่ม" }, { status: 400 });

  const supabase = createServiceClient();
  const id = await uniqueId(supabase, slugify(name));
  const { data: maxRow } = await supabase.from("positions").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sortOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("positions")
    .insert({ id, name, grp: group, sort_order: sortOrder })
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: "เพิ่มตำแหน่งไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ position: rowToPosition(data as PositionRow) });
}

export async function PATCH(req: Request) {
  let body: {
    id?: string;
    name?: string;
    group?: string;
    isActive?: boolean;
    order?: string[]; // full ordered list of ids -> sets sort_order by index
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  const supabase = createServiceClient();

  // Bulk reorder
  if (Array.isArray(body.order)) {
    await Promise.all(
      body.order.map((id, i) =>
        supabase.from("positions").update({ sort_order: i, updated_at: new Date().toISOString() }).eq("id", id)
      )
    );
    return NextResponse.json({ ok: true });
  }

  if (!body.id) return NextResponse.json({ error: "ไม่พบตำแหน่ง" }, { status: 400 });

  // Deactivation guard: block if active staff still hold this position.
  if (body.isActive === false) {
    const { count } = await supabase
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("position_id", body.id)
      .eq("is_active", true);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: `ยังมีพนักงานที่เปิดใช้งานอยู่ ${count} คนในตำแหน่งนี้ ต้องย้ายออกหรือปิดคนเหล่านั้นก่อน` },
        { status: 409 }
      );
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.group === "string" && body.group.trim()) patch.grp = body.group.trim();
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;

  const { data, error } = await supabase.from("positions").update(patch).eq("id", body.id).select("*").single();
  if (error || !data) return NextResponse.json({ error: "บันทึกไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({ position: rowToPosition(data as PositionRow) });
}
