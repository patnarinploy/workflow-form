"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Staff } from "@/lib/staff";
import { FormState, Task, emptyTask } from "@/lib/types";
import { TaskCard, TaskFieldKey } from "./TaskCard";

const REQUIRED_KEYS: TaskFieldKey[] = ["action", "inputDesc", "from", "outputDesc", "to"];

function draftKey(personId: string) {
  return `wf-form-draft-${personId}`;
}

function missingKeys(task: Task): TaskFieldKey[] {
  const out: TaskFieldKey[] = [];
  if (!task.action.trim()) out.push("action");
  if (!task.inputDesc.trim()) out.push("inputDesc");
  if (task.from.length === 0) out.push("from");
  if (!task.outputDesc.trim()) out.push("outputDesc");
  if (task.to.length === 0) out.push("to");
  return out;
}

export function FormClient({
  staff,
  initial,
  alreadySubmitted,
}: {
  staff: Staff;
  initial: FormState;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [blockers, setBlockers] = useState(initial.blockers);
  const [loaded, setLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<number, Set<TaskFieldKey>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const refKey = (i: number, k: TaskFieldKey) => `${i}:${k}`;

  // Load local draft (takes precedence over server data if present).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(staff.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.tasks) && parsed.tasks.length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setTasks(parsed.tasks);
        }
        if (typeof parsed?.blockers === "string") {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBlockers(parsed.blockers);
        }
        if (parsed?.savedAt) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLastSaved(parsed.savedAt);
        }
      }
    } catch {
      // ignore corrupt draft
    }
    setLoaded(true);
  }, [staff.id]);

  // Autosave every 2s.
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => {
      const now = new Date();
      const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      localStorage.setItem(draftKey(staff.id), JSON.stringify({ tasks, blockers, savedAt: stamp }));
      setLastSaved(stamp);
    }, 2000);
    return () => clearInterval(timer);
  }, [tasks, blockers, loaded, staff.id]);

  function updateTask(i: number, t: Task) {
    setTasks((prev) => prev.map((x, idx) => (idx === i ? t : x)));
    setErrors((prev) => {
      if (!prev[i]) return prev;
      const nextSet = new Set(prev[i]);
      for (const k of REQUIRED_KEYS) {
        const filled = k === "from" ? t.from.length > 0 : k === "to" ? t.to.length > 0 : String(t[k]).trim();
        if (filled) nextSet.delete(k);
      }
      return { ...prev, [i]: nextSet };
    });
  }

  function addTask() {
    setTasks((prev) => [...prev, emptyTask()]);
  }

  function removeTask(i: number) {
    setTasks((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors: Record<number, Set<TaskFieldKey>> = {};
    let firstMissing: { i: number; k: TaskFieldKey } | null = null;
    tasks.forEach((t, i) => {
      const miss = missingKeys(t);
      if (miss.length) {
        nextErrors[i] = new Set(miss);
        if (!firstMissing) firstMissing = { i, k: miss[0] };
      }
    });

    if (firstMissing) {
      setErrors(nextErrors);
      const { i, k } = firstMissing;
      const el = fieldRefs.current[refKey(i, k)];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      const focusable = el?.querySelector("input,button,textarea") as HTMLElement | null;
      focusable?.focus?.();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: staff.id, tasks, blockers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "ส่งข้อมูลไม่สำเร็จ");
      }
      localStorage.removeItem(draftKey(staff.id));
      router.push(`/thanks?person=${staff.id}&count=${tasks.length}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[720px] mx-auto px-5 py-8">
      <a href="/" className="text-[13px] text-[var(--muted)] hover:text-[var(--ink)]">← เปลี่ยนคน</a>

      <div className="mt-3 mb-1 flex items-baseline gap-2 flex-wrap">
        <h1 className="font-disp font-bold text-[26px] leading-tight">{staff.nick}</h1>
        <span className="text-[15px] text-[var(--muted)]">{staff.title}</span>
      </div>
      <div className="text-[13px] text-[var(--faint)] mb-4">{staff.dept}</div>

      {alreadySubmitted && (
        <div className="bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-[12px] px-4 py-2.5 text-[13px] text-[#0F5F47] mb-4">
          คุณเคยส่งคำตอบแล้ว — แก้ไขแล้วกดส่งอีกครั้งได้เลย ระบบจะอัปเดตให้ (ไม่สร้างซ้ำ)
        </div>
      )}

      <div className="bg-[#F0F4F2] border border-[var(--line)] rounded-[12px] px-4 py-3 text-[13.5px] text-[var(--muted)] mb-5 leading-relaxed">
        กรอกเฉพาะงานที่คุณทำเอง <b className="text-[var(--ink)] font-semibold">ไม่ต้องรู้ภาพรวมของทีม</b> ระบบจะต่อผังให้เอง
        โดยดูจากช่อง “ได้มาจากใคร” และ “ส่งให้ใครต่อ” ที่คุณเลือก
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          {tasks.map((t, i) => (
            <TaskCard
              key={i}
              task={t}
              index={i}
              personId={staff.id}
              errors={errors[i] ?? new Set()}
              onChange={(nt) => updateTask(i, nt)}
              onRemove={() => removeTask(i)}
              canRemove={tasks.length > 1}
              fieldRef={(k, el) => {
                fieldRefs.current[refKey(i, k)] = el;
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addTask}
          className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-[12px] border border-dashed border-[var(--accent-line)] text-[var(--accent)] bg-[var(--accent-soft)]/40 hover:bg-[var(--accent-soft)]"
        >
          + เพิ่มงานอีกอย่าง
        </button>

        <div className="mt-6">
          <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
            มีอะไรที่ติดขัดประจำในงานคุณไหม <span className="text-[var(--faint)] font-normal">(ถ้ามี)</span>
          </label>
          <textarea
            rows={3}
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            placeholder="เช่น มักรอไฟล์จากทีมกราฟิกนานกว่ากำหนด"
            className="w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)] resize-y leading-relaxed"
          />
        </div>

        {submitError && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)] rounded-[12px] px-4 py-3 mt-4 text-sm">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 mb-10">
          <span className="text-[12px] text-[var(--faint)]">
            {lastSaved ? `บันทึกร่างอัตโนมัติ ${lastSaved}` : "ระบบจะบันทึกร่างให้อัตโนมัติ"}
          </span>
          <button
            type="submit"
            disabled={submitting}
            className="text-sm font-semibold px-7 py-3 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-60"
          >
            {submitting ? "กำลังส่ง…" : "ส่งคำตอบ"}
          </button>
        </div>
      </form>
    </div>
  );
}
