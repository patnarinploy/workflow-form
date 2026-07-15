"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Block } from "./Block";
import { Field } from "./Field";
import { StepsSection } from "./StepsSection";
import { FormData, emptyForm } from "@/lib/types";

const STORAGE_KEY = "workflow-form-draft-v1";

type RequiredKey =
  | "teamName"
  | "submittedBy"
  | "triggerEvent"
  | "endCondition"
  | "processName"
  | "roles";

const REQUIRED_ORDER: RequiredKey[] = [
  "teamName",
  "submittedBy",
  "triggerEvent",
  "endCondition",
  "processName",
  "roles",
];

function calcProgress(form: FormData) {
  let filled = 0;
  let total = 0;

  const requiredVals: string[] = [
    form.teamName,
    form.submittedBy,
    form.triggerEvent,
    form.endCondition,
    form.processName,
    form.roles,
  ];
  total += requiredVals.length;
  filled += requiredVals.filter((v) => v.trim()).length;

  for (const step of form.steps) {
    const cells = [step.action, step.actor, step.output, step.handoffTo, step.approver];
    total += cells.length;
    filled += cells.filter((v) => v.trim()).length;
  }

  const optionalVals = [form.parallelWork, form.reworkNotes, form.inputFrom, form.outputTo];
  total += optionalVals.length;
  filled += optionalVals.filter((v) => v.trim()).length;

  return total === 0 ? 0 : Math.round((filled / total) * 100);
}

export function FormClient() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>(emptyForm());
  const [loaded, setLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [errors, setErrors] = useState<Set<RequiredKey>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fieldRefs = useRef<Partial<Record<RequiredKey, HTMLElement | null>>>({});

  // load draft on mount
  useEffect(() => {
    // one-time sync from localStorage on mount; SSR has no access to it
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.form) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setForm({ ...emptyForm(), ...parsed.form });
        }
        if (parsed?.savedAt) setLastSaved(parsed.savedAt);
      }
    } catch {
      // ignore corrupt draft
    }
    setLoaded(true);
  }, []);

  // autosave every 2s
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const stamp = `${hh}:${mm}`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, savedAt: stamp }));
      setLastSaved(stamp);
    }, 2000);
    return () => clearInterval(timer);
  }, [form, loaded]);

  const progress = useMemo(() => calcProgress(form), [form]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors.has(key as unknown as RequiredKey) && String(value).trim()) {
      setErrors((prev) => {
        const next = new Set(prev);
        next.delete(key as unknown as RequiredKey);
        return next;
      });
    }
  }

  function validate(): RequiredKey[] {
    const missing: RequiredKey[] = [];
    for (const key of REQUIRED_ORDER) {
      if (!String(form[key]).trim()) missing.push(key);
    }
    return missing;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const missing = validate();
    if (missing.length) {
      setErrors(new Set(missing));
      const el = fieldRefs.current[missing[0]];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement)?.focus?.();
      return;
    }
    setErrors(new Set());
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "ส่งข้อมูลไม่สำเร็จ");
      }
      localStorage.removeItem(STORAGE_KEY);
      router.push("/thanks");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page max-w-[940px] mx-auto px-5 py-10">
      {/* progress bar, sticky */}
      <div className="sticky top-0 z-10 -mx-5 px-5 py-2 bg-[var(--bg)]/95 backdrop-blur no-print">
        <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[11px] text-[var(--faint)]">กรอกแล้ว {progress}%</span>
          {lastSaved && (
            <span className="text-[11px] text-[var(--faint)]">บันทึกร่างอัตโนมัติเมื่อ {lastSaved}</span>
          )}
        </div>
      </div>

      <div className="eyebrow text-[13px] font-semibold tracking-[.14em] uppercase text-[var(--accent)] mb-2.5 flex items-center gap-2.5 mt-4">
        <span className="w-[26px] h-0.5 bg-[var(--accent)] rounded-full" />
        แบบฟอร์มเก็บข้อมูล · Workflow Mapping
      </div>
      <h1 className="font-disp font-bold text-[27px] sm:text-[34px] leading-[1.14] mb-3">
        ข้อมูลที่ต้องใช้ เพื่อทำผังงานของทีมคุณ
      </h1>
      <p className="text-base text-[var(--muted)] max-w-[62ch]">
        กรอกฟอร์มนี้ให้ครบ แล้วผังจะออกมาหน้าตาเหมือนผัง Production คือมีช่องแยกตามตำแหน่ง
        มีลูกศรบอกว่างานส่งต่อไปใคร และเห็นจุดที่ต้องรออนุมัติ
      </p>

      <form onSubmit={handleSubmit}>
        <Block num="0" title="ข้อมูลทีม">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="ชื่อทีม / แผนก *"
              placeholder="เช่น Operation, Commercial"
              value={form.teamName}
              error={errors.has("teamName")}
              ref={(el) => { fieldRefs.current.teamName = el; }}
              onChange={(e) => set("teamName", e.target.value)}
            />
            <Field
              label="คนกรอก (หัวหน้าทีม) *"
              placeholder="ชื่อเล่น"
              value={form.submittedBy}
              error={errors.has("submittedBy")}
              ref={(el) => { fieldRefs.current.submittedBy = el; }}
              onChange={(e) => set("submittedBy", e.target.value)}
            />
          </div>
        </Block>

        <Block
          num="1"
          title="ขอบเขต: งานเริ่มตอนไหน จบตอนไหน"
          why={
            <>
              ในผัง Production คือกล่อง <em>Start</em> กับ <em>End</em> ถ้าไม่กำหนดชัด
              ผังจะลากยาวไม่รู้จบ
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <Field
              label="อะไรเป็นตัวจุดชนวนให้งานเริ่ม *"
              placeholder="เช่น ได้รับ Budget ที่อนุมัติแล้วจาก Production"
              value={form.triggerEvent}
              error={errors.has("triggerEvent")}
              ref={(el) => { fieldRefs.current.triggerEvent = el; }}
              onChange={(e) => set("triggerEvent", e.target.value)}
            />
            <Field
              label="ถือว่างานจบเมื่อไหร่ *"
              placeholder="เช่น ปิดงบโปรเจกต์และออกรายงานเสร็จ"
              value={form.endCondition}
              error={errors.has("endCondition")}
              ref={(el) => { fieldRefs.current.endCondition = el; }}
              onChange={(e) => set("endCondition", e.target.value)}
            />
          </div>
          <Field
            label="ชื่อกระบวนการนี้ *"
            placeholder="เช่น กระบวนการควบคุมต้นทุนโปรเจกต์"
            value={form.processName}
            error={errors.has("processName")}
            ref={(el) => { fieldRefs.current.processName = el; }}
            onChange={(e) => set("processName", e.target.value)}
          />
        </Block>

        <Block
          num="2"
          title="ตำแหน่งที่เกี่ยวข้อง (ช่องแนวตั้งในผัง)"
          why={
            <>
              ผัง Production มี 6 ช่อง ได้แก่ Chief Producer, Script Writer, Producer, Casting,
              Senior Editor, Senior Social Media <em>ใส่เฉพาะตำแหน่ง ไม่ต้องใส่ชื่อคน</em>{" "}
              และรวมตำแหน่งจากทีมอื่นที่ต้องมายุ่งด้วย
            </>
          }
        >
          <Field
            as="textarea"
            rows={6}
            label="รายชื่อตำแหน่ง (บรรทัดละ 1 ตำแหน่ง เรียงตามลำดับที่งานไหลผ่าน) *"
            placeholder={"Head of Operation\nCost Control Officer\nSenior Cost Control Officer\nProducer (ทีม Production)\nHead of Commercial"}
            hint="ถ้าตำแหน่งไหนมาจากทีมอื่น วงเล็บบอกทีมไว้ด้วย"
            value={form.roles}
            error={errors.has("roles")}
            ref={(el) => { fieldRefs.current.roles = el; }}
            onChange={(e) => set("roles", e.target.value)}
          />
        </Block>

        <Block
          num="3"
          title="ขั้นตอนการทำงาน เรียงลำดับ"
          why={
            <>
              ส่วนนี้คือหัวใจ แต่ละแถวจะกลายเป็นกล่อง 1 กล่องในผัง ช่อง <em>ส่งต่อให้ใคร</em>{" "}
              คือตัวที่ทำให้เกิดลูกศร
            </>
          }
        >
          <StepsSection steps={form.steps} onChange={(steps) => set("steps", steps)} />
        </Block>

        <Block
          num="4"
          title="งานที่ทำคู่ขนาน"
          why={
            <>
              ในผัง Production คือเส้นม่วงที่เขียนว่า <em>ทำควบคู่</em> เช่น Social ถ่าย Behind
              the Scenes ไปพร้อมกับที่ Producer ถ่ายทำอยู่
            </>
          }
        >
          <Field
            as="textarea"
            rows={3}
            label="มีขั้นตอนไหนที่เกิดขึ้นพร้อมกันบ้าง (ถ้าไม่มี ข้ามได้)"
            placeholder="เช่น ขั้นตอนที่ 3 ทำพร้อมกับขั้นตอนที่ 5 เพราะ..."
            value={form.parallelWork}
            onChange={(e) => set("parallelWork", e.target.value)}
          />
        </Block>

        <Block
          num="5"
          title="จุดที่ต้องย้อนกลับไปแก้"
          why={
            <>
              คือเส้นแดงในผัง Production เช่น ตรวจเทปแล้วไม่ผ่าน ต้องวนกลับไปแก้
              ส่วนนี้ทำให้เห็นว่างานมักวนอยู่ตรงไหน
            </>
          }
        >
          <Field
            as="textarea"
            rows={3}
            label="ถ้างานไม่ผ่าน ต้องย้อนกลับไปขั้นตอนไหน และใครเป็นคนตีกลับ"
            placeholder="เช่น ถ้า Head of Operation ไม่อนุมัติต้นทุน ตีกลับไปขั้นตอนที่ 2 ให้ Cost Control แก้"
            value={form.reworkNotes}
            onChange={(e) => set("reworkNotes", e.target.value)}
          />
        </Block>

        <Block
          num="6"
          title="จุดเชื่อมกับทีมอื่น"
          why={
            <>
              คือเส้นประในผัง Production ส่วนนี้สำคัญที่สุดถ้าอยากเอาผังของทุกทีมมาต่อกันเป็นภาพใหญ่ภาพเดียว
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              as="textarea"
              rows={3}
              label="รับงาน/ข้อมูล มาจากทีมไหน ตอนไหน"
              placeholder="เช่น รับ Budget จาก Chief Producer ที่ขั้นตอนที่ 1"
              value={form.inputFrom}
              onChange={(e) => set("inputFrom", e.target.value)}
            />
            <Field
              as="textarea"
              rows={3}
              label="ส่งงาน/ข้อมูล ให้ทีมไหน ตอนไหน"
              placeholder="เช่น ส่งรายงานต้นทุนให้ Producer ทุกสิ้นสัปดาห์"
              value={form.outputTo}
              onChange={(e) => set("outputTo", e.target.value)}
            />
          </div>
        </Block>

        <div className="bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-2xl px-5 py-4 mt-6 text-sm text-[#0F5F47]">
          <b className="font-semibold">ข้อ 1, 2, 3 ขาดไม่ได้</b> — ถ้ามีแค่สามข้อนี้ก็พอเขียนผังได้แล้ว
          ส่วนข้อ 4, 5, 6 คือตัวที่ทำให้ผังสมจริงและเอาไปต่อกับทีมอื่นได้
        </div>

        {submitError && (
          <div className="bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)] rounded-2xl px-5 py-3 mt-4 text-sm">
            {submitError}
          </div>
        )}

        <div className="flex gap-2.5 flex-wrap mt-6 mb-10">
          <button
            type="submit"
            disabled={submitting}
            className="text-sm font-semibold px-6 py-3 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-60"
          >
            {submitting ? "กำลังส่ง..." : "ส่งคำตอบ"}
          </button>
        </div>
      </form>
    </div>
  );
}
