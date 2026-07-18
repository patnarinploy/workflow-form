import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { loadDirectorySnapshot } from "@/lib/directory";

export const dynamic = "force-dynamic";

// Public: active positions + staff in one call, for the client directory cache.
export async function GET() {
  const supabase = createServiceClient();
  const snapshot = await loadDirectorySnapshot(supabase, { activeOnly: true });
  return NextResponse.json(snapshot);
}
