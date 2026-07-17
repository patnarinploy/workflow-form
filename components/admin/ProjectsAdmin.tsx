"use client";

import { useState } from "react";
import { Project, ProjectStatus, STATUS_LABEL, STATUS_ORDER } from "@/lib/projects";

type Form = { id?: string; name: string; code: string; status: ProjectStatus; startDate: string; endDate: string; note: string };

const emptyForm = (): Form => ({ name: "", code: "", status: "active", startDate: "", endDate: "", note: "" });

const inputCls =
  "w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]";

export function ProjectsAdmin({ initial }: { initial: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initial);
  const [form, setForm] = useState<Form>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = !!form.id;

  function startEdit(p: Project) {
    setForm({
      id: p.id,
      name: p.name,
      code: p.code ?? "",
      status: p.status,
      startDate: p.start_date ?? "",
      endDate: p.end_date ?? "",
      note: p.note ?? "",
    });
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!form.name.trim()) {
      setError("กรุณาใส่ชื่อโปรเจกต์");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/projects", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "บันทึกไม่สำเร็จ");
      const p = body.project as Project;
      setProjects((prev) => (editing ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p]));
      setForm(emptyForm());
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Project) {
    if (!window.confirm(`ลบโปรเจกต์ "${p.name}"? การมอบหมายทั้งหมดของโปรเจกต์นี้จะถูกลบด้วย`)) return;
    const res = await fetch(`/api/admin/projects?id=${p.id}`, { method: "DELETE" });
    if (res.ok) setProjects((prev) => prev.filter((x) => x.id !== p.id));
  }

  const sorted = [...projects].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.name.localeCompare(b.name, "th")
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5 shadow-sm">
        <div className="font-semibold text-[15px] mb-3">{editing ? "แก้ไขโปรเจกต์" : "เพิ่มโปรเจกต์ใหม่"}</div>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">ชื่อโปรเจกต์ *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="เช่น แคมเปญปีใหม่ 2026" />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">ชื่อย่อ</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} placeholder="PRJ-A" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">สถานะ</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })} className={inputCls}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">เริ่ม</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">สิ้นสุด</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">หมายเหตุ</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={`${inputCls} resize-y`} />
          </div>
          {error && <div className="text-[13px] text-[var(--danger)]">{error}</div>}
          <div className="flex items-center gap-2">
            <button onClick={submit} disabled={busy} className="text-sm font-semibold px-5 py-2.5 rounded-[10px] bg-[var(--accent)] text-white disabled:opacity-60">
              {busy ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "เพิ่มโปรเจกต์"}
            </button>
            {editing && (
              <button onClick={() => setForm(emptyForm())} className="text-sm text-[var(--muted)] px-3 py-2.5">
                ยกเลิก
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[12.5px] font-semibold text-[var(--muted)] mb-2">โปรเจกต์ทั้งหมด ({projects.length})</div>
        {sorted.length === 0 ? (
          <div className="text-[13.5px] text-[var(--faint)] py-6 text-center border border-[var(--line)] rounded-[14px]">ยังไม่มีโปรเจกต์</div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((p) => (
              <div key={p.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-[12px] px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-[14.5px] truncate">
                    {p.name} {p.code && <span className="text-[12px] text-[var(--faint)]">· {p.code}</span>}
                  </div>
                  <div className="text-[12px] text-[var(--faint)] mt-0.5">
                    {STATUS_LABEL[p.status]}
                    {p.start_date && ` · ${p.start_date}`}
                    {p.end_date && ` → ${p.end_date}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(p)} className="text-[12.5px] text-[var(--accent)] font-semibold">แก้ไข</button>
                  <button onClick={() => remove(p)} className="text-[12.5px] text-[var(--faint)] hover:text-[var(--danger)]">ลบ</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
