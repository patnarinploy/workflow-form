"use client";

import { PersonSelect } from "./PersonSelect";
import { Step, Reveal } from "@/lib/types";

const EXTERNAL: ["external"] = ["external"];

function RevealRow({
  reveal,
  onChange,
  personId,
  label,
  color,
  whatLabel,
  whatPlaceholder,
  personPlaceholder,
}: {
  reveal: Reveal;
  onChange: (r: Reveal) => void;
  personId: string;
  label: string;
  color: string;
  whatLabel?: string;
  whatPlaceholder?: string;
  personPlaceholder: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-[13px] text-[var(--ink)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={reveal.enabled}
          onChange={(e) => onChange({ ...reveal, enabled: e.target.checked })}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </label>
      {reveal.enabled && (
        <div className="mt-2 ml-6 flex flex-col gap-2">
          <PersonSelect
            value={reveal.people}
            onChange={(people) => onChange({ ...reveal, people })}
            specials={EXTERNAL}
            excludeId={personId}
            placeholder={personPlaceholder}
          />
          {whatLabel && (
            <input
              type="text"
              value={reveal.what}
              placeholder={whatPlaceholder}
              onChange={(e) => onChange({ ...reveal, what: e.target.value })}
              className="w-full text-[13.5px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[8px] px-2.5 py-2 outline-none focus:border-[var(--accent)]"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function StepEditor({
  step,
  number,
  personId,
  actionError,
  onChange,
  onRemove,
  canRemove,
  actionRef,
  dragProps,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  step: Step;
  number: number;
  personId: string;
  actionError?: boolean;
  onChange: (s: Step) => void;
  onRemove: () => void;
  canRemove: boolean;
  actionRef?: (el: HTMLElement | null) => void;
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  return (
    <div className="border border-[var(--line)] rounded-[12px] bg-[var(--bg)]/40 p-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center pt-1.5 gap-0.5">
          <span
            {...dragProps}
            className="cursor-grab select-none text-[var(--faint)] leading-none text-[13px] hidden md:block"
            title="ลากเพื่อสลับลำดับ"
          >
            ⣿
          </span>
          <span className="font-disp font-semibold text-[13px] text-[var(--faint)]">{number}</span>
        </div>

        <div className="flex-1" ref={actionRef}>
          <input
            type="text"
            value={step.action}
            placeholder="เช่น อ่าน resume คัดกรองผู้สมัคร"
            onChange={(e) => onChange({ ...step, action: e.target.value })}
            className={`w-full text-sm bg-[var(--field)] border rounded-[10px] px-3 py-2.5 outline-none transition-colors ${
              actionError
                ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]"
                : "border-[var(--field-bd)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
            }`}
          />

          <div className="flex flex-col gap-2 mt-2.5">
            <RevealRow
              reveal={step.waitsFor}
              onChange={(r) => onChange({ ...step, waitsFor: r })}
              personId={personId}
              label="ต้องรอของจากคนอื่นก่อน"
              color="#B65418"
              whatLabel="รออะไร"
              whatPlaceholder="รออะไร เช่น ไฟล์กราฟิก, บทที่อนุมัติ"
              personPlaceholder="รอของจากใคร…"
            />
            <RevealRow
              reveal={step.sendsTo}
              onChange={(r) => onChange({ ...step, sendsTo: r })}
              personId={personId}
              label="ส่งให้คนอื่นต่อ"
              color="#128A64"
              whatLabel="ส่งอะไร"
              whatPlaceholder="ส่งอะไร เช่น รายชื่อนักแสดง, ไฟล์ตัดต่อ"
              personPlaceholder="ส่งให้ใคร…"
            />
            <RevealRow
              reveal={step.approver}
              onChange={(r) => onChange({ ...step, approver: r })}
              personId={personId}
              label="ต้องขออนุมัติ"
              color="#6C7A73"
              personPlaceholder="ใครอนุมัติ…"
            />
          </div>

          <div className="flex items-center gap-3 mt-2 md:hidden">
            <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="text-[var(--faint)] disabled:opacity-30 text-sm">↑ ขึ้น</button>
            <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="text-[var(--faint)] disabled:opacity-30 text-sm">↓ ลง</button>
          </div>
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="ลบขั้นตอน"
            className="text-[var(--faint)] hover:text-[var(--danger)] text-lg leading-none pt-1"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
