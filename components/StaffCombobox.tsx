"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDirectory } from "./DirectoryProvider";

export function StaffCombobox({
  value,
  onChange,
  placeholder = "พิมพ์ค้นหาชื่อ / ตำแหน่ง…",
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const { dir } = useDirectory();
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
  const grouped = useMemo(() => {
    const out: { group: string; items: { id: string; nick: string }[] }[] = [];
    for (const g of dir.groups) {
      const items = dir.staffOrdered
        .filter((s) => dir.staffGroup(s.id) === g)
        .filter((s) => !q || dir.staffLabel(s.id).toLowerCase().includes(q) || s.nick.toLowerCase().includes(q))
        .map((s) => ({ id: s.id, nick: s.nick }));
      if (items.length) out.push({ group: g, items });
    }
    return out;
  }, [dir, q]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[44px] flex items-center text-left bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
      >
        <span className={value ? "text-sm text-[var(--ink)]" : "text-[13.5px] text-[var(--faint)]"}>
          {value && dir.getStaff(value) ? dir.staffLabel(value) : placeholder}
        </span>
        <span className="ml-auto text-[var(--faint)] text-xs pl-2">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-[var(--surface)] border border-[var(--line)] rounded-[12px] shadow-lg max-h-[360px] overflow-hidden flex flex-col">
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
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide bg-[var(--bg)]/60 sticky top-0">
                  {group}
                </div>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full text-left px-3 py-2 text-[13.5px] hover:bg-[var(--accent-soft)] ${value === s.id ? "bg-[var(--accent-soft)]" : ""}`}
                  >
                    {dir.staffLabel(s.id)}
                  </button>
                ))}
              </div>
            ))}
            {grouped.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-[var(--faint)]">ไม่พบชื่อที่ค้นหา</div>}
          </div>
        </div>
      )}
    </div>
  );
}
