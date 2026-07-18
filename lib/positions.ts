// POSITIONS and STAFF moved to the DB in Module 3 — see lib/directory.ts.
// This module now only holds the "special" (non-position) relationship option,
// which is a constant unrelated to who works here.

export type SpecialValue = "external";

export const SPECIAL_LABEL: Record<SpecialValue, string> = {
  external: "ลูกค้า/ภายนอก",
};
