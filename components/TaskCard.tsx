"use client";

import { useState } from "react";
import { PersonSelect } from "./PersonSelect";
import { Task, FROM_SPECIALS, TO_SPECIALS, APPROVER_SPECIALS } from "@/lib/types";

export type TaskFieldKey = "action" | "inputDesc" | "from" | "outputDesc" | "to";

function Text({
  label,
  value,
  onChange,
  placeholder,
  error,
  refCb,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  refCb?: (el: HTMLInputElement | null) => void;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">{label}</label>
      <input
        ref={refCb}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-sm bg-[var(--field)] border rounded-[10px] px-3 py-2.5 outline-none transition-colors ${
          error
            ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]"
            : "border-[var(--field-bd)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
        }`}
      />
    </div>
  );
}

function PickerField({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
        {label} {optional && <span className="text-[var(--faint)] font-normal">(ถ้ามี)</span>}
      </label>
      {children}
    </div>
  );
}

export function TaskCard({
  task,
  index,
  personId,
  errors,
  onChange,
  onRemove,
  canRemove,
  fieldRef,
}: {
  task: Task;
  index: number;
  personId: string;
  errors: Set<TaskFieldKey>;
  onChange: (t: Task) => void;
  onRemove: () => void;
  canRemove: boolean;
  fieldRef?: (key: TaskFieldKey, el: HTMLElement | null) => void;
}) {
  const [showDetails, setShowDetails] = useState(
    !!(task.parallelWith || task.rework.length)
  );

  function set<K extends keyof Task>(key: K, value: Task[K]) {
    onChange({ ...task, [key]: value });
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-disp font-semibold text-[15px]">
          งานที่ {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[13px] text-[var(--faint)] hover:text-[var(--danger)]"
          >
            ลบงานนี้
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        <div ref={(el) => fieldRef?.("action", el)}>
          <Text
            label="ฉันทำอะไร *"
            value={task.action}
            onChange={(v) => set("action", v)}
            placeholder="เช่น คัดเลือกนักแสดงตามบทที่ได้รับ"
            error={errors.has("action")}
          />
        </div>

        <div ref={(el) => fieldRef?.("inputDesc", el)}>
          <Text
            label="ได้อะไรมาถึงจะเริ่มงานนี้ *"
            value={task.inputDesc}
            onChange={(v) => set("inputDesc", v)}
            placeholder="เช่น บทที่ผ่านการอนุมัติ"
            error={errors.has("inputDesc")}
          />
        </div>

        <div ref={(el) => fieldRef?.("from", el)}>
          <PickerField label="ได้มาจากใคร *">
            <PersonSelect
              value={task.from}
              onChange={(v) => set("from", v)}
              specials={FROM_SPECIALS}
              excludeId={personId}
              placeholder="เลือกคนที่ส่งงานมาให้…"
              error={errors.has("from")}
            />
          </PickerField>
        </div>

        <div ref={(el) => fieldRef?.("outputDesc", el)}>
          <Text
            label="ทำเสร็จได้อะไรออกมา *"
            value={task.outputDesc}
            onChange={(v) => set("outputDesc", v)}
            placeholder="เช่น รายชื่อนักแสดงพร้อมสัญญา"
            error={errors.has("outputDesc")}
          />
        </div>

        <div ref={(el) => fieldRef?.("to", el)}>
          <PickerField label="ส่งให้ใครต่อ *">
            <PersonSelect
              value={task.to}
              onChange={(v) => set("to", v)}
              specials={TO_SPECIALS}
              excludeId={personId}
              placeholder="เลือกคนที่รับงานต่อ…"
              error={errors.has("to")}
            />
          </PickerField>
        </div>

        <PickerField label="ใครอนุมัติงานนี้" optional>
          <PersonSelect
            value={task.approver}
            onChange={(v) => set("approver", v)}
            specials={APPROVER_SPECIALS}
            placeholder="เลือกผู้อนุมัติ…"
          />
        </PickerField>

        {!showDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="self-start text-[13px] font-semibold text-[var(--accent)]"
          >
            + เพิ่มรายละเอียด (งานคู่ขนาน / จุดตีกลับ)
          </button>
        ) : (
          <div className="flex flex-col gap-3.5 pt-1 border-t border-[var(--line)] mt-1">
            <Text
              label="งานนี้ทำพร้อมกับงานอะไรอยู่"
              value={task.parallelWith}
              onChange={(v) => set("parallelWith", v)}
              placeholder="เช่น ถ่าย Behind the Scenes พร้อมกับทีมถ่ายทำ"
            />
            <PickerField label="ถ้างานไม่ผ่านต้องกลับไปแก้กับใคร" optional>
              <PersonSelect
                value={task.rework}
                onChange={(v) => set("rework", v)}
                excludeId={personId}
                placeholder="เลือกคนที่ต้องกลับไปแก้ด้วย…"
              />
            </PickerField>
          </div>
        )}
      </div>
    </div>
  );
}
