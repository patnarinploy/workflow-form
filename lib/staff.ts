export type StaffGroup = "Executive" | "Commercial" | "Production" | "Operation";

export type Staff = {
  id: string;
  nick: string;
  title: string;
  dept: string;
  group: StaffGroup;
};

// True CJ Creations — 32 people. Hardcoded, not stored in DB.
// NOTE: there are two "พลอย" — ids ploy_cast and ploy_hr are intentionally distinct.
export const STAFF: Staff[] = [
  { id: "mj", nick: "MJ", title: "Chief Executive Officer (Co)", dept: "True CJ Creations", group: "Executive" },
  { id: "ling", nick: "หลิง", title: "Chief Executive Officer (Co)", dept: "True CJ Creations", group: "Executive" },
  { id: "oil", nick: "ออย", title: "Senior Commercial Officer", dept: "Chief Executive Office", group: "Commercial" },
  { id: "bell", nick: "เบล", title: "Project Management", dept: "Creative Solution", group: "Commercial" },
  { id: "naitan", nick: "นายท่าน", title: "Script Doctor", dept: "Production", group: "Production" },
  { id: "off", nick: "อ๊อฟ", title: "Head of Production", dept: "Production", group: "Production" },
  { id: "chik", nick: "ฉิก", title: "Casting Manager", dept: "Production", group: "Production" },
  { id: "oh", nick: "โอ๋", title: "Chief Producer", dept: "Production", group: "Production" },
  { id: "may", nick: "เมย์", title: "Chief Producer", dept: "Production", group: "Production" },
  { id: "ploy_cast", nick: "พลอย", title: "Casting Officer", dept: "Casting", group: "Production" },
  { id: "tuk", nick: "ตุ๊ก", title: "Producer", dept: "Producer Unit1", group: "Production" },
  { id: "kae", nick: "เก๋", title: "Producer", dept: "Producer Unit1", group: "Production" },
  { id: "dream", nick: "ดรีม", title: "Producer", dept: "Producer Unit1", group: "Production" },
  { id: "nokhook", nick: "นกฮูก", title: "Producer", dept: "Producer Unit1", group: "Production" },
  { id: "faifai", nick: "ฝ้ายฝ้าย", title: "Producer", dept: "Producer Unit2", group: "Production" },
  { id: "noon", nick: "นุ่น", title: "Producer", dept: "Producer Unit2", group: "Production" },
  { id: "pa", nick: "พา", title: "Producer", dept: "Producer Unit2", group: "Production" },
  { id: "a", nick: "เอ", title: "Creative Solution Manager", dept: "Post Production", group: "Production" },
  { id: "man", nick: "แมน", title: "Senior Video Editor", dept: "Post Production", group: "Production" },
  { id: "new", nick: "นิว", title: "Graphic Designer", dept: "Graphic Solution", group: "Production" },
  { id: "chin", nick: "ชิน", title: "VDO Editor", dept: "Graphic Solution", group: "Production" },
  { id: "gem", nick: "เจม", title: "Social Media Content Creator Officer", dept: "Marketing & Social Media", group: "Production" },
  { id: "fai", nick: "ฝ้าย", title: "Senior Social Media Executive", dept: "Marketing & Social Media", group: "Production" },
  { id: "kwang", nick: "กวาง", title: "Junior Script Writer", dept: "Script Writer", group: "Production" },
  { id: "bangern", nick: "บังเอิญ", title: "Business Planner", dept: "Operation", group: "Operation" },
  { id: "praew", nick: "แพรว", title: "Head of Operation", dept: "Financial controller", group: "Operation" },
  { id: "noey", nick: "เนย", title: "Cost Control Officer", dept: "Cost Controlling", group: "Operation" },
  { id: "yui", nick: "หยุย", title: "Senior Cost Control Officer", dept: "Cost Controlling", group: "Operation" },
  { id: "aoy", nick: "อ้อย", title: "Senior Revenue Control Officer", dept: "Revenue controlling", group: "Operation" },
  { id: "ploy_hr", nick: "พลอย", title: "HR Officer", dept: "People and Company Activities Management", group: "Operation" },
  { id: "hat", nick: "ฮาท", title: "Senior Legal Counsel", dept: "Legal Management", group: "Operation" },
  { id: "mag", nick: "แม็ก", title: "Head of Commercial", dept: "Commercial", group: "Commercial" },
];

export const GROUP_ORDER: StaffGroup[] = ["Executive", "Commercial", "Production", "Operation"];

export const GROUP_LABEL: Record<StaffGroup, string> = {
  Executive: "Executive",
  Commercial: "Commercial",
  Production: "Production",
  Operation: "Operation",
};

const STAFF_BY_ID: Record<string, Staff> = Object.fromEntries(STAFF.map((s) => [s.id, s]));

export function getStaff(id: string): Staff | undefined {
  return STAFF_BY_ID[id];
}

// Display label — always include the title so the two "พลอย" are distinguishable.
export function staffLabel(id: string): string {
  const s = STAFF_BY_ID[id];
  return s ? `${s.nick} — ${s.title}` : id;
}

export function staffNick(id: string): string {
  return STAFF_BY_ID[id]?.nick ?? id;
}

// Special (non-person) options for the multi-selects.
export type SpecialValue = "external" | "self_start" | "ends_here" | "no_approval";

export const SPECIAL_LABEL: Record<SpecialValue, string> = {
  self_start: "เริ่มเองไม่ได้รับจากใคร",
  external: "ลูกค้า/ภายนอก",
  ends_here: "จบที่ฉัน",
  no_approval: "ไม่ต้องอนุมัติ",
};
