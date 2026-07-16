"use client";

import { useRef } from "react";
import { StepEditor } from "./StepEditor";
import { Job, Step, emptyStep, FREQUENCY_OPTIONS } from "@/lib/types";

export type JobFieldRef = (kind: "name" | "step", stepIndex: number, el: HTMLElement | null) => void;

export function JobCard({
  job,
  number,
  positionId,
  nameError,
  stepErrors,
  onChange,
  onRemove,
  canRemove,
  fieldRef,
}: {
  job: Job;
  number: number;
  positionId: string;
  nameError?: boolean;
  stepErrors: Set<number>;
  onChange: (j: Job) => void;
  onRemove: () => void;
  canRemove: boolean;
  fieldRef?: JobFieldRef;
}) {
  const dragIndex = useRef<number | null>(null);

  function setStep(i: number, s: Step) {
    onChange({ ...job, steps: job.steps.map((x, idx) => (idx === i ? s : x)) });
  }
  function addStep() {
    onChange({ ...job, steps: [...job.steps, emptyStep()] });
  }
  function removeStep(i: number) {
    if (job.steps.length <= 1) return;
    const removed = job.steps[i];
    // If another step's fail-target points at this step, warn and clear it (never leave a dangling id).
    const referenced = job.steps.some(
      (s, idx) => idx !== i && s.decision.enabled && s.decision.failKind === "step" && s.decision.failStepId === removed.id
    );
    if (referenced && !window.confirm("มีขั้นตอนอื่นตั้งค่า “ถ้าไม่ผ่านให้ย้อนกลับมาขั้นตอนนี้” อยู่ ถ้าลบ ระบบจะล้างปลายทางนั้นทิ้ง ยืนยันลบไหม?")) {
      return;
    }
    const next = job.steps
      .filter((_, idx) => idx !== i)
      .map((s) =>
        s.decision.enabled && s.decision.failKind === "step" && s.decision.failStepId === removed.id
          ? { ...s, decision: { ...s.decision, failKind: "" as const, failStepId: "" } }
          : s
      );
    onChange({ ...job, steps: next });
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= job.steps.length) return;
    const next = job.steps.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange({ ...job, steps: next });
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[18px] p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <span className="font-disp font-bold text-[13px] text-white bg-[var(--accent)] w-6 h-6 rounded-[7px] flex items-center justify-center">
          {number}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-[13px] text-[var(--faint)] hover:text-[var(--danger)]">
            ลบงานนี้
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div ref={(el) => fieldRef?.("name", -1, el)}>
          <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">ชื่องาน *</label>
          <input
            type="text"
            value={job.name}
            placeholder="เช่น งานสรรหาคน"
            onChange={(e) => onChange({ ...job, name: e.target.value })}
            className={`w-full text-sm bg-[var(--field)] border rounded-[10px] px-3 py-2.5 outline-none transition-colors ${
              nameError
                ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]"
                : "border-[var(--field-bd)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
            }`}
          />
          <p className="text-[11.5px] text-[var(--faint)] mt-1">
            เช่น งานสรรหาคน, งานปิดงบโปรเจกต์, งานคัดเลือกนักแสดง (งานหนึ่งชุดที่มีจุดเริ่มจุดจบ ไม่ใช่ขั้นตอนย่อย)
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
              งานนี้เริ่มเมื่อไหร่ <span className="text-[var(--faint)] font-normal">(ถ้ามี)</span>
            </label>
            <input
              type="text"
              value={job.trigger}
              placeholder="เช่น ได้รับใบขออัตรากำลัง"
              onChange={(e) => onChange({ ...job, trigger: e.target.value })}
              className="w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]"
            />
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
              ความถี่ <span className="text-[var(--faint)] font-normal">(ถ้ามี)</span>
            </label>
            <select
              value={job.frequency}
              onChange={(e) => onChange({ ...job, frequency: e.target.value })}
              className="w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            >
              <option value="">— เลือก —</option>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-1">
          <div className="text-[12.5px] font-semibold text-[var(--muted)] mb-2">ขั้นตอนการทำงาน (เรียงตามลำดับ)</div>
          <div className="flex flex-col gap-2">
            {job.steps.map((s, i) => (
              <StepEditor
                key={s.id}
                step={s}
                number={i + 1}
                positionId={positionId}
                siblings={job.steps.map((x) => ({ id: x.id, action: x.action }))}
                actionError={stepErrors.has(i)}
                onChange={(ns) => setStep(i, ns)}
                onRemove={() => removeStep(i)}
                canRemove={job.steps.length > 1}
                actionRef={(el) => fieldRef?.("step", i, el)}
                onMoveUp={() => move(i, i - 1)}
                onMoveDown={() => move(i, i + 1)}
                canMoveUp={i > 0}
                canMoveDown={i < job.steps.length - 1}
                dragProps={{
                  draggable: true,
                  onDragStart: () => (dragIndex.current = i),
                  onDragOver: (e) => e.preventDefault(),
                  onDrop: () => {
                    if (dragIndex.current !== null && dragIndex.current !== i) move(dragIndex.current, i);
                    dragIndex.current = null;
                  },
                }}
              />
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-2 text-[13px] font-semibold text-[var(--accent)]">
            + เพิ่มขั้นตอน
          </button>
        </div>
      </div>
    </div>
  );
}
