"use client";

import { useEffect, useRef, useState } from "react";
import { Position } from "@/lib/positions";
import { FormState, Job, emptyJob } from "@/lib/types";
import { JobCard } from "./JobCard";

function draftKey(positionId: string) {
  // v41: line-item send/wait shape. Bumped so older drafts (different step shape) are ignored.
  return `wf-form-v41-${positionId}`;
}

type JobErrors = { name: boolean; steps: Set<number> };

export function FormClient({
  position,
  initial,
  existing,
}: {
  position: Position;
  initial: FormState;
  existing: { filledBy: string | null; updatedAt: string } | null;
}) {
  const [jobs, setJobs] = useState<Job[]>(initial.jobs);
  const [blockers, setBlockers] = useState(initial.blockers);
  const [filledBy] = useState(initial.filledBy);
  const [loaded, setLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<number, JobErrors>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const refs = useRef<Record<string, HTMLElement | null>>({});
  const nameKey = (ji: number) => `${ji}:name`;
  const stepKey = (ji: number, si: number) => `${ji}:step:${si}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(position.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.jobs) && parsed.jobs.length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setJobs(parsed.jobs);
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
      // ignore
    }
    setLoaded(true);
  }, [position.id]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => {
      const now = new Date();
      const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      localStorage.setItem(draftKey(position.id), JSON.stringify({ jobs, blockers, savedAt: stamp }));
      setLastSaved(stamp);
    }, 2000);
    return () => clearInterval(timer);
  }, [jobs, blockers, loaded, position.id]);

  function setJob(i: number, j: Job) {
    setJobs((prev) => prev.map((x, idx) => (idx === i ? j : x)));
  }
  function addJob() {
    setJobs((prev) => [...prev, emptyJob()]);
  }
  function removeJob(i: number) {
    setJobs((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors: Record<number, JobErrors> = {};
    let firstKey: string | null = null;
    jobs.forEach((job, ji) => {
      const je: JobErrors = { name: false, steps: new Set() };
      if (!job.name.trim()) {
        je.name = true;
        if (!firstKey) firstKey = nameKey(ji);
      }
      job.steps.forEach((s, si) => {
        if (!s.action.trim()) {
          je.steps.add(si);
          if (!firstKey) firstKey = stepKey(ji, si);
        }
      });
      if (je.name || je.steps.size) nextErrors[ji] = je;
    });

    if (firstKey) {
      setErrors(nextErrors);
      const el = refs.current[firstKey];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el?.querySelector("input,select") as HTMLElement | null)?.focus?.();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: position.id, filledBy, jobs, blockers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "ส่งข้อมูลไม่สำเร็จ");
      }
      localStorage.removeItem(draftKey(position.id));
      const stepTotal = jobs.reduce((n, j) => n + j.steps.length, 0);
      window.location.href = `/thanks?pos=${position.id}&jobs=${jobs.length}&steps=${stepTotal}`;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[760px] mx-auto px-5 py-8">
      <a href="/" className="text-[13px] text-[var(--muted)] hover:text-[var(--ink)]">← เปลี่ยนตำแหน่ง</a>

      <div className="mt-3 mb-1 flex items-baseline gap-2 flex-wrap">
        <h1 className="font-disp font-bold text-[24px] leading-tight">{position.name}</h1>
        <span className="text-[13px] text-[var(--faint)]">{position.group}</span>
      </div>
      <div className="text-[13px] text-[var(--muted)] mb-4">สมาชิก: {position.members.join(", ")}</div>

      {existing && (
        <div className="bg-[#FBF3E9] border border-[#E9CFA0] rounded-[12px] px-4 py-2.5 text-[13px] text-[#8A5A1C] mb-4">
          ตำแหน่งนี้ {existing.filledBy ? `(${existing.filledBy}) ` : ""}กรอกไว้เมื่อ {new Date(existing.updatedAt).toLocaleString("th-TH")} — คุณกำลังแก้ของเดิม
        </div>
      )}

      <div className="bg-[#F0F4F2] border border-[var(--line)] rounded-[12px] px-4 py-3 text-[13.5px] text-[var(--muted)] mb-5 leading-relaxed">
        กรอก<b className="text-[var(--ink)] font-semibold">ในนามตำแหน่งนี้</b> ไม่ใช่ในนามตัวคุณเอง ถ้าตำแหน่งนี้มีหลายคน ให้กรอกงานที่ทุกคนในตำแหน่งทำเหมือนกัน
        <br />เอาเฉพาะงานประจำที่ทำทุกโปรเจกต์ ไม่ต้องเอางานจรที่นานๆ ทำที ระบบจะต่อผังให้เอง (ช่องส่งต่อ/อนุมัติติ๊กเปิดเฉพาะที่มีจริง)
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4">
          {jobs.map((job, ji) => (
            <JobCard
              key={ji}
              job={job}
              number={ji + 1}
              positionId={position.id}
              nameError={errors[ji]?.name}
              stepErrors={errors[ji]?.steps ?? new Set()}
              onChange={(j) => setJob(ji, j)}
              onRemove={() => removeJob(ji)}
              canRemove={jobs.length > 1}
              fieldRef={(kind, si, el) => {
                refs.current[kind === "name" ? nameKey(ji) : stepKey(ji, si)] = el;
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addJob}
          className="mt-4 w-full text-sm font-semibold px-4 py-3 rounded-[12px] border border-dashed border-[var(--accent-line)] text-[var(--accent)] bg-[var(--accent-soft)]/40 hover:bg-[var(--accent-soft)]"
        >
          + เพิ่มงาน (job) อีกชุด
        </button>

        <div className="mt-6">
          <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">
            มีอะไรที่ติดขัดประจำในงานตำแหน่งนี้ไหม <span className="text-[var(--faint)] font-normal">(ถ้ามี)</span>
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
