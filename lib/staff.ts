import { POSITIONS, GROUP_ORDER, PositionGroup, positionName, getPosition } from "./positions";

// Module 2 (projects) works at the PERSON level (32 people), unlike the workflow
// module which works at the POSITION level (24). Each person points back at a
// POSITION via positionId. Do NOT edit POSITIONS for this module.
export type Staff = {
  id: string;
  nick: string;
  positionId: string;
  unit: string | null;
};

export const STAFF: Staff[] = [
  { id: "mj", nick: "MJ", positionId: "ceo", unit: null },
  { id: "ling", nick: "หลิง", positionId: "ceo", unit: null },
  { id: "mag", nick: "แม็ก", positionId: "head_commercial", unit: null },
  { id: "oil", nick: "ออย", positionId: "snr_commercial", unit: null },
  { id: "bell", nick: "เบล", positionId: "project_mgmt", unit: null },
  { id: "off", nick: "อ๊อฟ", positionId: "head_production", unit: null },
  { id: "oh", nick: "โอ๋", positionId: "chief_producer", unit: null },
  { id: "may", nick: "เมย์", positionId: "chief_producer", unit: null },
  { id: "tuk", nick: "ตุ๊ก", positionId: "producer", unit: "Unit 1" },
  { id: "kae", nick: "เก๋", positionId: "producer", unit: "Unit 1" },
  { id: "dream", nick: "ดรีม", positionId: "producer", unit: "Unit 1" },
  { id: "nokhook", nick: "นกฮูก", positionId: "producer", unit: "Unit 1" },
  { id: "faifai", nick: "ฝ้ายฝ้าย", positionId: "producer", unit: "Unit 2" },
  { id: "noon", nick: "นุ่น", positionId: "producer", unit: "Unit 2" },
  { id: "pa", nick: "พา", positionId: "producer", unit: "Unit 2" },
  { id: "naitan", nick: "นายท่าน", positionId: "script_doctor", unit: null },
  { id: "kwang", nick: "กวาง", positionId: "script_writer", unit: null },
  { id: "chik", nick: "ฉิก", positionId: "casting_mgr", unit: null },
  { id: "ploy_cast", nick: "พลอย", positionId: "casting_officer", unit: null },
  { id: "a", nick: "เอ", positionId: "creative_mgr", unit: null },
  { id: "man", nick: "แมน", positionId: "snr_editor", unit: null },
  { id: "chin", nick: "ชิน", positionId: "vdo_editor", unit: null },
  { id: "new", nick: "นิว", positionId: "graphic_designer", unit: null },
  { id: "fai", nick: "ฝ้าย", positionId: "snr_social", unit: null },
  { id: "gem", nick: "เจม", positionId: "social_creator", unit: null },
  { id: "praew", nick: "แพรว", positionId: "head_operation", unit: null },
  { id: "bangern", nick: "บังเอิญ", positionId: "business_planner", unit: null },
  { id: "yui", nick: "หยุย", positionId: "snr_cost", unit: null },
  { id: "noey", nick: "เนย", positionId: "cost_control", unit: null },
  { id: "aoy", nick: "อ้อย", positionId: "snr_revenue", unit: null },
  { id: "ploy_hr", nick: "พลอย", positionId: "hr_officer", unit: null },
  { id: "hat", nick: "ฮาท", positionId: "legal", unit: null },
];

const STAFF_BY_ID: Record<string, Staff> = Object.fromEntries(STAFF.map((s) => [s.id, s]));
const POS_INDEX: Record<string, number> = Object.fromEntries(POSITIONS.map((p, i) => [p.id, i]));

export function getStaff(id: string): Staff | undefined {
  return STAFF_BY_ID[id];
}

export function staffGroup(id: string): PositionGroup | undefined {
  const s = STAFF_BY_ID[id];
  return s ? getPosition(s.positionId)?.group : undefined;
}

// There are two "พลอย" (casting_officer + hr_officer), so a person is NEVER shown
// without their position. Returns e.g. "พลอย (Casting Officer)" or
// "ตุ๊ก (Producer · Unit 1)".
export function staffLabel(id: string): string {
  const s = STAFF_BY_ID[id];
  if (!s) return id;
  const posName = positionName(s.positionId);
  return s.unit ? `${s.nick} (${posName} · ${s.unit})` : `${s.nick} (${posName})`;
}

// STAFF sorted by group, then by position order, preserving array order within.
export const STAFF_ORDERED: Staff[] = [...STAFF].sort((a, b) => {
  const ga = GROUP_ORDER.indexOf(getPosition(a.positionId)?.group as PositionGroup);
  const gb = GROUP_ORDER.indexOf(getPosition(b.positionId)?.group as PositionGroup);
  if (ga !== gb) return ga - gb;
  const pa = POS_INDEX[a.positionId] ?? 0;
  const pb = POS_INDEX[b.positionId] ?? 0;
  if (pa !== pb) return pa - pb;
  return STAFF.indexOf(a) - STAFF.indexOf(b);
});
