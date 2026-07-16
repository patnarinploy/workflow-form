export type PositionGroup = "Executive" | "Commercial" | "Production" | "Operation";

export type Position = {
  id: string;
  name: string;
  group: PositionGroup;
  members: string[]; // nicknames of people holding this position (display only)
};

// True CJ Creations — 24 positions (32 people collapsed). The unit of the app
// is the POSITION, not the person. members[] is shown only to help pick correctly.
export const POSITIONS: Position[] = [
  { id: "ceo", name: "Chief Executive Officer (Co)", group: "Executive", members: ["MJ", "หลิง"] },

  { id: "head_commercial", name: "Head of Commercial", group: "Commercial", members: ["แม็ก"] },
  { id: "snr_commercial", name: "Senior Commercial Officer", group: "Commercial", members: ["ออย"] },
  { id: "project_mgmt", name: "Project Management (Creative Solution)", group: "Commercial", members: ["เบล"] },

  { id: "head_production", name: "Head of Production", group: "Production", members: ["อ๊อฟ"] },
  { id: "chief_producer", name: "Chief Producer", group: "Production", members: ["โอ๋", "เมย์"] },
  { id: "producer", name: "Producer", group: "Production", members: ["ตุ๊ก", "เก๋", "ดรีม", "นกฮูก", "ฝ้ายฝ้าย", "นุ่น", "พา"] },
  { id: "script_doctor", name: "Script Doctor", group: "Production", members: ["นายท่าน"] },
  { id: "script_writer", name: "Junior Script Writer", group: "Production", members: ["กวาง"] },
  { id: "casting_mgr", name: "Casting Manager", group: "Production", members: ["ฉิก"] },
  { id: "casting_officer", name: "Casting Officer", group: "Production", members: ["พลอย"] },
  { id: "creative_mgr", name: "Creative Solution Manager", group: "Production", members: ["เอ"] },
  { id: "snr_editor", name: "Senior Video Editor", group: "Production", members: ["แมน"] },
  { id: "vdo_editor", name: "VDO Editor", group: "Production", members: ["ชิน"] },
  { id: "graphic_designer", name: "Graphic Designer", group: "Production", members: ["นิว"] },
  { id: "snr_social", name: "Senior Social Media Executive", group: "Production", members: ["ฝ้าย"] },
  { id: "social_creator", name: "Social Media Content Creator Officer", group: "Production", members: ["เจม"] },

  { id: "head_operation", name: "Head of Operation", group: "Operation", members: ["แพรว"] },
  { id: "business_planner", name: "Business Planner", group: "Operation", members: ["บังเอิญ"] },
  { id: "snr_cost", name: "Senior Cost Control Officer", group: "Operation", members: ["หยุย"] },
  { id: "cost_control", name: "Cost Control Officer", group: "Operation", members: ["เนย"] },
  { id: "snr_revenue", name: "Senior Revenue Control Officer", group: "Operation", members: ["อ้อย"] },
  { id: "hr_officer", name: "HR Officer", group: "Operation", members: ["พลอย"] },
  { id: "legal", name: "Senior Legal Counsel", group: "Operation", members: ["ฮาท"] },
];

export const GROUP_ORDER: PositionGroup[] = ["Executive", "Commercial", "Production", "Operation"];

export const GROUP_LABEL: Record<PositionGroup, string> = {
  Executive: "Executive",
  Commercial: "Commercial",
  Production: "Production",
  Operation: "Operation",
};

const BY_ID: Record<string, Position> = Object.fromEntries(POSITIONS.map((p) => [p.id, p]));

export function getPosition(id: string): Position | undefined {
  return BY_ID[id];
}

export function positionName(id: string): string {
  return BY_ID[id]?.name ?? id;
}

export function positionMembers(id: string): string[] {
  return BY_ID[id]?.members ?? [];
}

export function positionMembersLabel(id: string): string {
  return positionMembers(id).join(", ");
}

export function memberCount(id: string): number {
  return BY_ID[id]?.members.length ?? 0;
}

// Special (non-position) option.
export type SpecialValue = "external";

export const SPECIAL_LABEL: Record<SpecialValue, string> = {
  external: "ลูกค้า/ภายนอก",
};
