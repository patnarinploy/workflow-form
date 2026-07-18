import type { SupabaseClient } from "@supabase/supabase-js";

// Module 3: POSITIONS and STAFF now live in the DB (tables `positions` + `staff`)
// so admins can manage them without a code change. This module holds the shared
// types plus a pure `makeDirectory()` that turns DB rows into the same lookup
// helpers the app used to import as constants (getPosition, staffLabel, …).
//
// Nothing here imports a server-only module, so it is safe in client bundles.
// The server loader `loadDirectory(supabase)` just takes a client and queries.

export type Group = string;

// The four groups the workflow shipped with. Any group typed later by an admin
// is appended after these, in first-seen order.
export const KNOWN_GROUPS: string[] = ["Executive", "Commercial", "Production", "Operation"];

export type Position = {
  id: string;
  name: string;
  group: string;
  sortOrder: number;
  isActive: boolean;
};

export type Staff = {
  id: string;
  nick: string;
  fullName: string | null;
  positionId: string;
  unit: string | null;
  isActive: boolean;
  sortOrder: number;
};

// ---- DB row shapes (read through the service role) ----
export type PositionRow = {
  id: string;
  name: string;
  grp: string;
  sort_order: number;
  is_active: boolean;
};

export type StaffRow = {
  id: string;
  nick: string;
  full_name: string | null;
  position_id: string;
  unit: string | null;
  is_active: boolean;
  sort_order: number;
};

export const rowToPosition = (r: PositionRow): Position => ({
  id: r.id,
  name: r.name,
  group: r.grp,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

export const rowToStaff = (r: StaffRow): Staff => ({
  id: r.id,
  nick: r.nick,
  fullName: r.full_name,
  positionId: r.position_id,
  unit: r.unit,
  isActive: r.is_active,
  sortOrder: r.sort_order,
});

// Ordered unique groups: the known four first (in canonical order), then any
// extra groups in the order their first position appears (by sort_order).
export function groupsInOrder(positions: Position[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of KNOWN_GROUPS) {
    if (positions.some((p) => p.group === g)) {
      seen.add(g);
      out.push(g);
    }
  }
  for (const p of [...positions].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!seen.has(p.group)) {
      seen.add(p.group);
      out.push(p.group);
    }
  }
  return out;
}

export type Directory = {
  // full sets (as given to makeDirectory — may or may not include inactive)
  positions: Position[];
  staff: Staff[];
  activePositions: Position[];
  activeStaff: Staff[];
  // ordered active staff, grouped by group -> position order -> staff order
  staffOrdered: Staff[];
  // ALL given staff (active + inactive) in the same ordering — for admin views
  // (matrix / insights) that show inactive people dimmed.
  staffOrderedAll: Staff[];
  // ordered unique groups present among active positions
  groups: string[];

  getPosition(id: string): Position | undefined;
  positionName(id: string): string;
  getStaff(id: string): Staff | undefined;
  staffLabel(id: string): string;
  staffGroup(id: string): string | undefined;

  // active positions within a group, sorted (for pickers)
  positionsInGroup(group: string): Position[];
  // active staff nicknames in a position, in order (display only)
  positionMembers(id: string): string[];
  positionMembersLabel(id: string): string;
  memberCount(id: string): number;
};

export function makeDirectory(positions: Position[], staff: Staff[]): Directory {
  const posById = new Map(positions.map((p) => [p.id, p]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const posIndex = new Map(
    [...positions].sort((a, b) => a.sortOrder - b.sortOrder).map((p, i) => [p.id, i])
  );

  const activePositions = positions
    .filter((p) => p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const activeStaff = staff.filter((s) => s.isActive);

  const groups = groupsInOrder(activePositions);

  const groupOf = (positionId: string): string | undefined => posById.get(positionId)?.group;
  const groupRank = (g: string | undefined): number => {
    const i = groups.indexOf(g ?? "");
    return i === -1 ? groups.length : i;
  };

  const orderStaff = (list: Staff[]): Staff[] =>
    [...list].sort((a, b) => {
      const ga = groupRank(groupOf(a.positionId));
      const gb = groupRank(groupOf(b.positionId));
      if (ga !== gb) return ga - gb;
      const pa = posIndex.get(a.positionId) ?? 0;
      const pb = posIndex.get(b.positionId) ?? 0;
      if (pa !== pb) return pa - pb;
      return a.sortOrder - b.sortOrder;
    });

  const staffOrdered = orderStaff(activeStaff);
  const staffOrderedAll = orderStaff(staff);

  const positionName = (id: string): string => posById.get(id)?.name ?? id;

  const positionMembers = (id: string): string[] =>
    activeStaff
      .filter((s) => s.positionId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.nick);

  const staffLabel = (id: string): string => {
    const s = staffById.get(id);
    if (!s) return id;
    const pos = positionName(s.positionId);
    return s.unit ? `${s.nick} (${pos} · ${s.unit})` : `${s.nick} (${pos})`;
  };

  return {
    positions,
    staff,
    activePositions,
    activeStaff,
    staffOrdered,
    staffOrderedAll,
    groups,
    getPosition: (id) => posById.get(id),
    positionName,
    getStaff: (id) => staffById.get(id),
    staffLabel,
    staffGroup: (id) => groupOf(staffById.get(id)?.positionId ?? ""),
    positionsInGroup: (group) => activePositions.filter((p) => p.group === group),
    positionMembers,
    positionMembersLabel: (id) => positionMembers(id).join(", "),
    memberCount: (id) => activeStaff.filter((s) => s.positionId === id).length,
  };
}

// Server loader: builds a Directory from the DB. Uses the service role client so
// it sees every row; pass { activeOnly: true } for the public /api/directory.
export async function loadDirectory(
  supabase: SupabaseClient,
  opts: { activeOnly?: boolean } = {}
): Promise<Directory> {
  const [{ data: pRows }, { data: sRows }] = await Promise.all([
    supabase.from("positions").select("*"),
    supabase.from("staff").select("*"),
  ]);
  let positions = ((pRows as PositionRow[] | null) ?? []).map(rowToPosition);
  let staff = ((sRows as StaffRow[] | null) ?? []).map(rowToStaff);
  if (opts.activeOnly) {
    positions = positions.filter((p) => p.isActive);
    staff = staff.filter((s) => s.isActive);
  }
  return makeDirectory(positions, staff);
}

// Serializable snapshot passed from server components to the client context.
export type DirectorySnapshot = { positions: Position[]; staff: Staff[] };

export async function loadDirectorySnapshot(
  supabase: SupabaseClient,
  opts: { activeOnly?: boolean } = {}
): Promise<DirectorySnapshot> {
  const [{ data: pRows }, { data: sRows }] = await Promise.all([
    supabase.from("positions").select("*"),
    supabase.from("staff").select("*"),
  ]);
  let positions = ((pRows as PositionRow[] | null) ?? []).map(rowToPosition);
  let staff = ((sRows as StaffRow[] | null) ?? []).map(rowToStaff);
  if (opts.activeOnly) {
    positions = positions.filter((p) => p.isActive);
    staff = staff.filter((s) => s.isActive);
  }
  return { positions, staff };
}
