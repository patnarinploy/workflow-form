"use client";

import { useRef, useState } from "react";
import { StepRow, emptyStep } from "@/lib/types";

const COLS: { key: keyof StepRow; label: string; placeholder?: string }[] = [
  { key: "action", label: "ขั้นตอน (ทำอะไร)", placeholder: "เช่น รับ Budget มาตั้งต้นทุนรายหมวด" },
  { key: "actor", label: "ใครทำ (ตำแหน่ง)", placeholder: "Cost Control Officer" },
  { key: "output", label: "ได้ผลลัพธ์อะไรออกมา", placeholder: "ตารางต้นทุนตั้งต้น" },
  { key: "handoffTo", label: "ส่งต่อให้ใคร", placeholder: "Senior Cost Control" },
  { key: "approver", label: "ใครอนุมัติ", placeholder: "Head of Operation" },
];

export function StepsSection({
  steps,
  onChange,
}: {
  steps: StepRow[];
  onChange: (steps: StepRow[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function updateCell(idx: number, key: keyof StepRow, value: string) {
    const next = steps.slice();
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  }

  function addRow() {
    onChange([...steps, emptyStep()]);
  }

  function removeRow(idx: number) {
    const next = steps.slice();
    next.splice(idx, 1);
    onChange(next.length ? next : [emptyStep()]);
  }

  function handleDrop(idx: number) {
    if (dragIndex.current === null || dragIndex.current === idx) {
      setOverIndex(null);
      dragIndex.current = null;
      return;
    }
    const next = steps.slice();
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    dragIndex.current = null;
    setOverIndex(null);
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px] mt-1">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th className="w-7"></th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className="text-[11.5px] font-semibold text-[var(--faint)] text-left pb-[7px] px-2"
                  style={{ minWidth: c.key === "action" ? 200 : c.key === "output" ? 150 : 130 }}
                >
                  {c.label}
                </th>
              ))}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, idx) => (
              <tr
                key={idx}
                draggable
                onDragStart={() => (dragIndex.current = idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(idx);
                }}
                onDrop={() => handleDrop(idx)}
                className={overIndex === idx ? "bg-[var(--accent-soft)]" : ""}
              >
                <td className="pt-4 pb-2 text-center cursor-grab select-none text-[var(--faint)]" title="ลากเพื่อสลับลำดับ">
                  ⠿
                </td>
                <td className="font-disp font-semibold text-[var(--faint)] text-[13px] pt-4 pb-2 text-center w-[26px]">
                  {idx + 1}
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="pb-2 px-2 align-top">
                    <input
                      type="text"
                      value={step[c.key]}
                      placeholder={c.placeholder}
                      onChange={(e) => updateCell(idx, c.key, e.target.value)}
                      className="w-full text-[13.5px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-2.5 py-2 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
                    />
                  </td>
                ))}
                <td className="pb-2 text-center pt-4">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    aria-label="ลบขั้นตอนนี้"
                    className="text-[var(--faint)] hover:text-[var(--danger)] text-lg leading-none"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-col gap-3 mt-1">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="border border-[var(--line)] rounded-[14px] p-3.5 bg-[var(--field)]"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-disp font-semibold text-[13px] text-[var(--accent)]">
                ขั้นตอนที่ {idx + 1}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleDropMobile(idx, idx - 1)}
                  className="text-[var(--faint)] disabled:opacity-30"
                  aria-label="เลื่อนขึ้น"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={idx === steps.length - 1}
                  onClick={() => handleDropMobile(idx, idx + 1)}
                  className="text-[var(--faint)] disabled:opacity-30"
                  aria-label="เลื่อนลง"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="text-[var(--faint)] text-lg leading-none"
                  aria-label="ลบขั้นตอนนี้"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {COLS.map((c) => (
                <div key={c.key}>
                  <label className="block text-[11.5px] font-semibold text-[var(--muted)] mb-1">
                    {c.label}
                  </label>
                  <input
                    type="text"
                    value={step[c.key]}
                    placeholder={c.placeholder}
                    onChange={(e) => updateCell(idx, c.key, e.target.value)}
                    className="w-full text-[13.5px] bg-white border border-[var(--field-bd)] rounded-[10px] px-2.5 py-2 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={addRow}
          className="text-[12.5px] font-semibold px-3.5 py-1.5 text-[var(--accent)] bg-transparent hover:bg-[var(--accent-soft)] rounded-[8px]"
        >
          + เพิ่มขั้นตอน
        </button>
      </div>

      <div className="bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-xl px-4 py-3 text-[13px] text-[#0F5F47] mt-3.5">
        <b className="font-semibold">เคล็ดลับ:</b> ถ้าขั้นตอนไหนไม่ต้องอนุมัติ ใส่ขีด – ไปเลย
        ช่องที่มีชื่อคนอนุมัติจะถูกไฮไลต์ในผัง เพราะเป็นจุดที่งานมักติด
      </div>
    </div>
  );

  function handleDropMobile(from: number, to: number) {
    if (to < 0 || to >= steps.length) return;
    const next = steps.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }
}
