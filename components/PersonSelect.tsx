"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { STAFF, GROUP_ORDER, GROUP_LABEL, staffLabel, staffNick, getStaff, SpecialValue, SPECIAL_LABEL, StaffGroup } from "@/lib/staff";
import { specialToken, isSpecialToken, specialOf } from "@/lib/types";

function tokenLabel(token: string): string {
  return isSpecialToken(token) ? SPECIAL_LABEL[specialOf(token)] : staffLabel(token);
}

function tokenChipText(token: string): string {
  return isSpecialToken(token) ? SPECIAL_LABEL[specialOf(token)] : staffNick(token);
}

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  specials?: SpecialValue[];
  placeholder?: string;
  excludeId?: string; // e.g. hide "self" so a person can't pick themselves
  error?: boolean;
  id?: string;
};

export function PersonSelect({
  value,
  onChange,
  multiple = true,
  specials = [],
  placeholder = "เลือกคน…",
  excludeId,
  error,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();

  const specialMatches = useMemo(
    () => specials.filter((s) => !q || SPECIAL_LABEL[s].toLowerCase().includes(q)),
    [specials, q]
  );

  const grouped = useMemo(() => {
    const out: { group: StaffGroup; people: typeof STAFF }[] = [];
    for (const g of GROUP_ORDER) {
      const people = STAFF.filter(
        (s) =>
          s.group === g &&
          s.id !== excludeId &&
          (!q || s.nick.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.dept.toLowerCase().includes(q))
      );
      if (people.length) out.push({ group: g, people });
    }
    return out;
  }, [q, excludeId]);

  function isSelected(token: string) {
    return value.includes(token);
  }

  function toggle(token: string) {
    if (multiple) {
      onChange(isSelected(token) ? value.filter((t) => t !== token) : [...value, token]);
      setQuery("");
      inputRef.current?.focus();
    } else {
      onChange([token]);
      setOpen(false);
      setQuery("");
    }
  }

  function removeChip(token: string) {
    onChange(value.filter((t) => t !== token));
  }

  const hasValue = value.length > 0;

  return (
    <div ref={wrapRef} className="relative" id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-h-[42px] flex flex-wrap gap-1.5 items-center text-left bg-[var(--field)] border rounded-[10px] px-2.5 py-2 outline-none transition-colors ${
          error ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]" : "border-[var(--field-bd)] focus:border-[var(--accent)]"
        }`}
      >
        {hasValue ? (
          value.map((token) => (
            <span
              key={token}
              className={`inline-flex items-center gap-1 text-[13px] rounded-full pl-2.5 pr-1 py-0.5 ${
                isSpecialToken(token)
                  ? "bg-[#EFE7DE] text-[#8A5A1C]"
                  : "bg-[var(--accent-soft)] text-[#0F5F47]"
              }`}
            >
              {tokenChipText(token)}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  removeChip(token);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    removeChip(token);
                  }
                }}
                aria-label={`เอา ${tokenChipText(token)} ออก`}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 leading-none"
              >
                ×
              </span>
            </span>
          ))
        ) : (
          <span className="text-[13.5px] text-[var(--faint)] px-1">{placeholder}</span>
        )}
        <span className="ml-auto text-[var(--faint)] text-xs pr-1">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-[var(--surface)] border border-[var(--line)] rounded-[12px] shadow-lg max-h-[320px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--line)]">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิมพ์ค้นหาชื่อ / ตำแหน่ง…"
              className="w-full text-[13.5px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[8px] px-2.5 py-2 outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="overflow-y-auto">
            {specialMatches.length > 0 && (
              <div className="py-1">
                {specialMatches.map((s) => {
                  const token = specialToken(s);
                  const sel = isSelected(token);
                  return (
                    <button
                      key={token}
                      type="button"
                      onClick={() => toggle(token)}
                      className={`w-full text-left px-3 py-2 text-[13.5px] flex items-center gap-2 hover:bg-[var(--accent-soft)] ${
                        sel ? "text-[#8A5A1C] font-semibold" : "text-[#8A5A1C]"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${sel ? "bg-[#B65418] border-[#B65418] text-white" : "border-[var(--field-bd)]"}`}>
                        {sel ? "✓" : ""}
                      </span>
                      {SPECIAL_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            )}
            {grouped.map(({ group, people }) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide bg-[var(--bg)]/60 sticky top-0">
                  {GROUP_LABEL[group]}
                </div>
                {people.map((s) => {
                  const sel = isSelected(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`w-full text-left px-3 py-2 text-[13.5px] flex items-center gap-2 hover:bg-[var(--accent-soft)] ${sel ? "bg-[var(--accent-soft)]" : ""}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${sel ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--field-bd)]"}`}>
                        {sel ? "✓" : ""}
                      </span>
                      <span className="font-medium">{s.nick}</span>
                      <span className="text-[var(--faint)] text-[12px] truncate">— {s.title}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {specialMatches.length === 0 && grouped.length === 0 && (
              <div className="px-3 py-4 text-center text-[13px] text-[var(--faint)]">ไม่พบชื่อที่ค้นหา</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Single-select convenience wrapper: value is a single id ("" = none).
export function PersonCombobox({
  value,
  onChange,
  placeholder,
  error,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  error?: boolean;
  id?: string;
}) {
  return (
    <PersonSelect
      multiple={false}
      value={value ? [value] : []}
      onChange={(next) => onChange(next[0] ?? "")}
      placeholder={placeholder}
      error={error}
      id={id}
    />
  );
}

export { tokenLabel };
