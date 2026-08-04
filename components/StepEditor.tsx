"use client";

import { useEffect, useState } from "react";
import { PositionSelect, PositionCombobox } from "./PositionSelect";
import {
  Step,
  WaitsGroup,
  SendsGroup,
  ApproverGroup,
  Decision,
  ParallelGroup,
  ParallelItem,
  WaitItem,
  SendItem,
  emptyWaitItem,
  emptySendItem,
  emptyParallelItem,
  emptyWaits,
  emptySends,
  emptyApprover,
  emptyDecision,
  emptyParallel,
  isSpecialToken,
} from "@/lib/types";

const EXTERNAL: ["external"] = ["external"];

type StepOption = { stepId: string; label: string };
type CacheState = Record<string, StepOption[] | "loading">;

function GroupHeader({
  checked,
  onToggle,
  label,
  color,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  color: string;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-[var(--ink)] cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </label>
  );
}

const fieldCls =
  "w-full text-[13.5px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[8px] px-2.5 py-2 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]";

function ItemCard({ onRemove, children }: { onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="relative border border-[var(--line)] rounded-[10px] bg-[var(--surface)] p-2.5 flex flex-col gap-2">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="ลบรายการ"
          className="absolute top-1.5 right-2 text-[var(--faint)] hover:text-[var(--danger)] text-base leading-none"
        >
          ×
        </button>
      )}
      {children}
    </div>
  );
}

function addBtn(label: string, onClick: () => void) {
  return (
    <button type="button" onClick={onClick} className="self-start text-[12.5px] font-semibold text-[var(--accent)]">
      {label}
    </button>
  );
}

// ---- waits ----
function WaitsEditor({ group, onChange }: { group: WaitsGroup; onChange: (g: WaitsGroup) => void }) {
  const items = group.items ?? [];
  const setItem = (i: number, item: WaitItem) => {
    const next = items.slice();
    next[i] = item;
    onChange({ ...group, items: next });
  };
  const toggle = (v: boolean) => onChange({ enabled: v, items: v && items.length === 0 ? [emptyWaitItem()] : items });
  return (
    <div>
      <GroupHeader checked={group.enabled} onToggle={toggle} label="ต้องรอของจากตำแหน่งอื่นก่อน" color="#B65418" />
      {group.enabled && (
        <div className="mt-2 ml-6 flex flex-col gap-2">
          {items.map((item, i) => (
            <ItemCard key={i} onRemove={items.length > 1 ? () => onChange({ ...group, items: items.filter((_, j) => j !== i) }) : undefined}>
              <input
                type="text"
                value={item.what}
                placeholder="รออะไร เช่น ไฟล์กราฟิก, บทที่อนุมัติ"
                onChange={(e) => setItem(i, { ...item, what: e.target.value })}
                className={fieldCls}
              />
              <PositionSelect
                value={item.positions}
                onChange={(positions) => setItem(i, { ...item, positions })}
                specials={EXTERNAL}
                placeholder="รอของจากตำแหน่งไหน…"
              />
            </ItemCard>
          ))}
          {addBtn("+ เพิ่มของที่ต้องรออีกอย่าง", () => onChange({ ...group, items: [...items, emptyWaitItem()] }))}
        </div>
      )}
    </div>
  );
}

// ---- sends ----
function SendsEditor({ group, onChange }: { group: SendsGroup; onChange: (g: SendsGroup) => void }) {
  const items = group.items ?? [];
  const setItem = (i: number, item: SendItem) => {
    const next = items.slice();
    next[i] = item;
    onChange({ ...group, items: next });
  };
  const toggle = (v: boolean) => onChange({ enabled: v, items: v && items.length === 0 ? [emptySendItem()] : items });
  return (
    <div>
      <GroupHeader checked={group.enabled} onToggle={toggle} label="ส่งให้ตำแหน่งอื่นต่อ" color="#128A64" />
      {group.enabled && (
        <div className="mt-2 ml-6 flex flex-col gap-2">
          {items.map((item, i) => (
            <ItemCard key={i} onRemove={items.length > 1 ? () => onChange({ ...group, items: items.filter((_, j) => j !== i) }) : undefined}>
              <input
                type="text"
                value={item.what}
                placeholder="ส่งอะไร เช่น รายชื่อนักแสดง, ไฟล์ตัดต่อ *"
                onChange={(e) => setItem(i, { ...item, what: e.target.value })}
                className={fieldCls}
              />
              <PositionSelect
                value={item.positions}
                onChange={(positions) => setItem(i, { ...item, positions })}
                specials={EXTERNAL}
                placeholder="ส่งให้ตำแหน่งไหน…"
              />
              <label className="flex items-center gap-2 text-[12.5px] text-[var(--muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={item.conditional}
                  onChange={(e) => setItem(i, { ...item, conditional: e.target.checked, condition: e.target.checked ? item.condition : "" })}
                  className="w-3.5 h-3.5 accent-[var(--accent)]"
                />
                ส่งแบบมีเงื่อนไข
              </label>
              {item.conditional && (
                <input
                  type="text"
                  value={item.condition}
                  placeholder="เงื่อนไขคืออะไร เช่น ถ้า QC ผ่าน"
                  onChange={(e) => setItem(i, { ...item, condition: e.target.value })}
                  className={fieldCls}
                />
              )}
            </ItemCard>
          ))}
          {addBtn("+ เพิ่มการส่งอีกอย่าง", () => onChange({ ...group, items: [...items, emptySendItem()] }))}
        </div>
      )}
    </div>
  );
}

// ---- approver ----
function ApproverEditor({ group, onChange }: { group: ApproverGroup; onChange: (g: ApproverGroup) => void }) {
  return (
    <div>
      <GroupHeader checked={group.enabled} onToggle={(v) => onChange({ ...group, enabled: v })} label="ต้องขออนุมัติ" color="#6C7A73" />
      {group.enabled && (
        <div className="mt-2 ml-6">
          <PositionSelect value={group.positions} onChange={(positions) => onChange({ ...group, positions })} specials={EXTERNAL} placeholder="ตำแหน่งไหนอนุมัติ…" />
        </div>
      )}
    </div>
  );
}

// ---- parallel (happens at the same time as OTHER positions' steps) ----
// One row = one parallel set; can target many positions, each pinned to its own step.
function ParallelEditor({ group, onChange, positionId }: { group: ParallelGroup; onChange: (g: ParallelGroup) => void; positionId: string }) {
  const items = group.items ?? [];
  const [cache, setCache] = useState<CacheState>({});

  // fetch steps for every real (non-external) target position across all rows
  useEffect(() => {
    const wanted = Array.from(
      new Set(items.flatMap((it) => (it.targets ?? []).map((t) => t.position)).filter((p) => p && !isSpecialToken(p)))
    );
    for (const pos of wanted) {
      if (cache[pos] !== undefined) continue;
      setCache((c) => ({ ...c, [pos]: "loading" }));
      fetch(`/api/position-steps?position=${encodeURIComponent(pos)}`)
        .then((r) => (r.ok ? r.json() : { steps: [] }))
        .then((d) => setCache((c) => ({ ...c, [pos]: (d.steps as StepOption[]) ?? [] })))
        .catch(() => setCache((c) => ({ ...c, [pos]: [] })));
    }
  }, [items, cache]);

  const setItem = (i: number, item: ParallelItem) => {
    const next = items.slice();
    next[i] = item;
    onChange({ ...group, items: next });
  };
  const toggle = (v: boolean) => onChange({ enabled: v, items: v && items.length === 0 ? [emptyParallelItem()] : items });

  // reconcile the multi-position select -> targets (keep pinned steps for kept positions)
  const setPositions = (i: number, item: ParallelItem, tokens: string[]) => {
    const targets = tokens.map((tok) => item.targets.find((t) => t.position === tok) ?? { position: tok, stepId: "" });
    setItem(i, { ...item, targets });
  };
  const setTargetStep = (i: number, item: ParallelItem, pos: string, stepId: string) => {
    setItem(i, { ...item, targets: item.targets.map((t) => (t.position === pos ? { ...t, stepId } : t)) });
  };

  return (
    <div>
      <GroupHeader checked={group.enabled} onToggle={toggle} label="ทำควบคู่กับตำแหน่งอื่น (เกิดพร้อมกัน)" color="#7C5CBF" />
      {group.enabled && (
        <div className="mt-2 ml-6 flex flex-col gap-2">
          {items.map((item, i) => (
            <ItemCard key={i} onRemove={items.length > 1 ? () => onChange({ ...group, items: items.filter((_, j) => j !== i) }) : undefined}>
              <input
                type="text"
                value={item.what}
                placeholder="ทำอะไรควบคู่ (ถ้ามี) เช่น ถ่าย Behind the Scenes"
                onChange={(e) => setItem(i, { ...item, what: e.target.value })}
                className={fieldCls}
              />
              <div>
                <label className="block text-[12px] text-[var(--muted)] mb-1">ควบคู่กับตำแหน่งไหนบ้าง *</label>
                <PositionSelect
                  value={item.targets.map((t) => t.position)}
                  onChange={(tokens) => setPositions(i, item, tokens)}
                  specials={EXTERNAL}
                  exclude={[positionId]}
                  placeholder="เลือกตำแหน่งที่ทำพร้อมกัน (เลือกได้หลายตำแหน่ง)…"
                />
              </div>

              {/* per-position step picker */}
              {item.targets.filter((t) => !isSpecialToken(t.position)).length > 0 && (
                <div className="flex flex-col gap-2 pl-1 border-l-2 border-[#E0D6F2]">
                  {item.targets
                    .filter((t) => !isSpecialToken(t.position))
                    .map((t) => {
                      const opts = cache[t.position];
                      const notFilled = Array.isArray(opts) && opts.length === 0;
                      const waiting = !t.stepId;
                      return (
                        <div key={t.position} className="pl-2">
                          <label className="block text-[11.5px] text-[var(--muted)] mb-0.5">ควบคู่กับขั้นตอนไหนของตำแหน่งนี้</label>
                          {opts === "loading" ? (
                            <div className="text-[12px] text-[var(--faint)]">กำลังโหลดขั้นตอน…</div>
                          ) : (
                            <>
                              <select value={t.stepId} onChange={(e) => setTargetStep(i, item, t.position, e.target.value)} className={fieldCls}>
                                <option value="">ยังไม่ระบุขั้นตอน (ผูกกับตำแหน่งไว้ก่อน)</option>
                                {Array.isArray(opts) &&
                                  opts.map((o) => (
                                    <option key={o.stepId} value={o.stepId}>{o.label}</option>
                                  ))}
                              </select>
                              {notFilled && <div className="text-[11px] text-[var(--faint)] mt-0.5">ตำแหน่งนี้ยังไม่ได้กรอกงาน — เลือกได้ภายหลัง</div>}
                              {waiting && notFilled && (
                                <span className="inline-block mt-0.5 text-[10.5px] rounded-full bg-[#EFE9F6] text-[#5B3E9B] px-2 py-0.5">รอผูกขั้นตอนคู่ขนาน</span>
                              )}
                              {waiting && !notFilled && Array.isArray(opts) && (
                                <span className="inline-block mt-0.5 text-[10.5px] rounded-full bg-[var(--accent-soft)] text-[#0F5F47] px-2 py-0.5">กรอกงานแล้ว — เลือกขั้นตอนได้เลย</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </ItemCard>
          ))}
          {addBtn("+ เพิ่มงานคู่ขนานอีก", () => onChange({ ...group, items: [...items, emptyParallelItem()] }))}
        </div>
      )}
    </div>
  );
}

// ---- decision (pass/fail) ----
type Sibling = { id: string; action: string };

function DecisionEditor({
  decision,
  onChange,
  positionId,
  siblings,
  selfId,
}: {
  decision: Decision;
  onChange: (d: Decision) => void;
  positionId: string;
  siblings: Sibling[];
  selfId: string;
}) {
  const toggle = (v: boolean) =>
    onChange({ ...decision, enabled: v, deciders: v && decision.deciders.length === 0 ? [positionId] : decision.deciders });

  const selectValue = decision.failKind === "step" ? `step:${decision.failStepId}` : decision.failKind === "position" ? "position" : "";
  const onSelect = (v: string) => {
    if (v === "") onChange({ ...decision, failKind: "", failStepId: "", failPosition: "" });
    else if (v === "position") onChange({ ...decision, failKind: "position", failStepId: "" });
    else onChange({ ...decision, failKind: "step", failStepId: v.slice(5), failPosition: "" });
  };

  const others = siblings.filter((s) => s.id !== selfId);

  return (
    <div>
      <GroupHeader checked={decision.enabled} onToggle={toggle} label="ขั้นตอนนี้มีการตัดสินใจ ผ่าน/ไม่ผ่าน" color="#2E7CD6" />
      {decision.enabled && (
        <div className="mt-2 ml-6 flex flex-col gap-2">
          <div>
            <label className="block text-[12px] text-[var(--muted)] mb-1">ใครเป็นคนตัดสิน <span className="text-[var(--faint)] font-normal">(เลือกได้หลายคน)</span></label>
            <PositionSelect
              value={decision.deciders}
              onChange={(deciders) => onChange({ ...decision, deciders })}
              specials={EXTERNAL}
              placeholder="เลือกผู้ตัดสิน…"
            />
          </div>
          <div>
            <label className="block text-[12px] text-[var(--muted)] mb-1">ถ้าไม่ผ่าน ไปไหนต่อ</label>
            <select value={selectValue} onChange={(e) => onSelect(e.target.value)} className={fieldCls}>
              <option value="">— เลือกปลายทางถ้าไม่ผ่าน —</option>
              <optgroup label="ย้อนกลับไปขั้นตอนใน job นี้">
                {others.map((s) => {
                  const idx = siblings.findIndex((x) => x.id === s.id);
                  return (
                    <option key={s.id} value={`step:${s.id}`}>
                      {idx + 1}. {s.action.trim() || "(ยังไม่ใส่ชื่อ)"}
                    </option>
                  );
                })}
              </optgroup>
              <optgroup label="ส่งกลับให้ตำแหน่งอื่น">
                <option value="position">ส่งกลับให้ตำแหน่งอื่น…</option>
              </optgroup>
            </select>
          </div>
          {decision.failKind === "position" && (
            <PositionCombobox
              value={decision.failPosition}
              onChange={(failPosition) => onChange({ ...decision, failPosition })}
              specials={EXTERNAL}
              placeholder="ส่งกลับให้ตำแหน่งไหน…"
            />
          )}
          <input
            type="text"
            value={decision.failReason}
            placeholder="ไม่ผ่านเพราะอะไรได้บ้าง (ถ้ามี) เช่น ภาพไม่ตรง Direction"
            onChange={(e) => onChange({ ...decision, failReason: e.target.value })}
            className={fieldCls}
          />
        </div>
      )}
    </div>
  );
}

export function StepEditor({
  step,
  number,
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
  positionId,
  siblings,
}: {
  step: Step;
  number: number;
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
  positionId: string;
  siblings: Sibling[];
}) {
  return (
    <div className="border border-[var(--line)] rounded-[12px] bg-[var(--bg)]/40 p-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center pt-1.5 gap-0.5">
          <span {...dragProps} className="cursor-grab select-none text-[var(--faint)] leading-none text-[13px] hidden md:block" title="ลากเพื่อสลับลำดับ">
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
            <WaitsEditor group={step.waitsFor ?? emptyWaits()} onChange={(waitsFor) => onChange({ ...step, waitsFor })} />
            <SendsEditor group={step.sendsTo ?? emptySends()} onChange={(sendsTo) => onChange({ ...step, sendsTo })} />
            <ApproverEditor group={step.approver ?? emptyApprover()} onChange={(approver) => onChange({ ...step, approver })} />
            <DecisionEditor
              decision={step.decision ?? emptyDecision()}
              onChange={(decision) => onChange({ ...step, decision })}
              positionId={positionId}
              siblings={siblings}
              selfId={step.id}
            />
            <ParallelEditor
              group={step.parallel ?? emptyParallel()}
              onChange={(parallel) => onChange({ ...step, parallel })}
              positionId={positionId}
            />
          </div>

          <div className="flex items-center gap-3 mt-2 md:hidden">
            <button type="button" onClick={onMoveUp} disabled={!canMoveUp} className="text-[var(--faint)] disabled:opacity-30 text-sm">↑ ขึ้น</button>
            <button type="button" onClick={onMoveDown} disabled={!canMoveDown} className="text-[var(--faint)] disabled:opacity-30 text-sm">↓ ลง</button>
          </div>
        </div>

        {canRemove && (
          <button type="button" onClick={onRemove} aria-label="ลบขั้นตอน" className="text-[var(--faint)] hover:text-[var(--danger)] text-lg leading-none pt-1">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
