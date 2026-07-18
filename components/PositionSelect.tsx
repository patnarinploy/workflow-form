"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SpecialValue, SPECIAL_LABEL } from "@/lib/positions";
import { useDirectory } from "./DirectoryProvider";
import { specialToken, isSpecialToken, specialOf } from "@/lib/types";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  specials?: SpecialValue[];
  placeholder?: string;
  error?: boolean;
};

export function PositionSelect({
  value,
  onChange,
  multiple = true,
  specials = [],
  placeholder = "เลือกตำแหน่ง…",
  error,
}: Props) {
  const { dir } = useDirectory();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tokenChip = (token: string): string =>
    isSpecialToken(token) ? SPECIAL_LABEL[specialOf(token)] : dir.positionName(token);

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
    const out: { group: string; items: { id: string; name: string; members: string[] }[] }[] = [];
    for (const g of dir.groups) {
      const items = dir
        .positionsInGroup(g)
        .map((p) => ({ id: p.id, name: p.name, members: dir.positionMembers(p.id) }))
        .filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.members.some((m) => m.toLowerCase().includes(q))
        );
      if (items.length) out.push({ group: g, items });
    }
    return out;
  }, [dir, q]);

  const isSelected = (token: string) => value.includes(token);

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

  const hasValue = value.length > 0;

  return (
    <div ref={wrapRef} className="relative">
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
              className={`inline-flex items-center gap-1 text-[12.5px] rounded-full pl-2.5 pr-1 py-0.5 max-w-full ${
                isSpecialToken(token) ? "bg-[#EFE7DE] text-[#8A5A1C]" : "bg-[var(--accent-soft)] text-[#0F5F47]"
              }`}
            >
              <span className="truncate">{tokenChip(token)}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(value.filter((t) => t !== token));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(value.filter((t) => t !== token));
                  }
                }}
                aria-label={`เอา ${tokenChip(token)} ออก`}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 leading-none shrink-0"
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
        <div className="absolute z-30 mt-1 w-full bg-[var(--surface)] border border-[var(--line)] rounded-[12px] shadow-lg max-h-[340px] overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--line)]">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="พิมพ์ค้นหาตำแหน่ง / ชื่อสมาชิก…"
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
                      className="w-full text-left px-3 py-2 text-[13.5px] flex items-center gap-2 hover:bg-[var(--accent-soft)] text-[#8A5A1C]"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${sel ? "bg-[#B65418] border-[#B65418] text-white" : "border-[var(--field-bd)]"}`}>
                        {sel ? "✓" : ""}
                      </span>
                      {SPECIAL_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            )}
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide bg-[var(--bg)]/60 sticky top-0">
                  {group}
                </div>
                {items.map((p) => {
                  const sel = isSelected(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-[var(--accent-soft)] ${sel ? "bg-[var(--accent-soft)]" : ""}`}
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${sel ? "bg-[var(--accent)] border-[var(--accent)] text-white" : "border-[var(--field-bd)]"}`}>
                        {sel ? "✓" : ""}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium leading-tight">{p.name}</span>
                        <span className="block text-[11.5px] text-[var(--faint)] truncate">{p.members.join(", ")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {specialMatches.length === 0 && grouped.length === 0 && (
              <div className="px-3 py-4 text-center text-[13px] text-[var(--faint)]">ไม่พบตำแหน่งที่ค้นหา</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Single-select convenience wrapper.
export function PositionCombobox({
  value,
  onChange,
  placeholder,
  error,
  specials = [],
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  error?: boolean;
  specials?: SpecialValue[];
}) {
  return (
    <PositionSelect
      multiple={false}
      value={value ? [value] : []}
      onChange={(next) => onChange(next[0] ?? "")}
      placeholder={placeholder}
      error={error}
      specials={specials}
    />
  );
}
