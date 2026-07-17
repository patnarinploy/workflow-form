"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StaffCombobox } from "./StaffCombobox";
import { getStaff } from "@/lib/staff";
import { positionName } from "@/lib/positions";
import {
  Project,
  Assignment,
  Involvement,
  INVOLVEMENT_ORDER,
  INVOLVEMENT_LABEL,
  INVOLVEMENT_HINT,
  INVOLVEMENT_COLOR,
  STATUS_LABEL,
} from "@/lib/projects";

const PERSON_KEY = "wf-project-person";

type Local = { involvement: Involvement | ""; isOwner: boolean; roleNote: string };

export function MyProjectsClient() {
  const [person, setPerson] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [byProject, setByProject] = useState<Record<string, Local>>({});
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const roleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // remember who I am
  useEffect(() => {
    const saved = localStorage.getItem(PERSON_KEY);
    if (saved && getStaff(saved)) setPerson(saved);
  }, []);

  const load = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const [pr, ar] = await Promise.all([fetch("/api/projects"), fetch(`/api/assignments?person=${pid}`)]);
      const pj = (await pr.json())?.projects ?? [];
      const asg: Assignment[] = (await ar.json())?.assignments ?? [];
      setProjects(pj);
      const map: Record<string, Local> = {};
      for (const a of asg) map[a.project_id] = { involvement: a.involvement, isOwner: a.is_owner, roleNote: a.role_note ?? "" };
      setByProject(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (person && getStaff(person)) load(person);
  }, [person, load]);

  function pickPerson(id: string) {
    localStorage.setItem(PERSON_KEY, id);
    setPerson(id);
  }

  const stamp = () => {
    const n = new Date();
    setSavedAt(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`);
  };

  const save = useCallback(
    async (projectId: string, local: Local) => {
      if (!local.involvement) return; // required before persisting
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          personId: person,
          involvement: local.involvement,
          isOwner: local.isOwner,
          roleNote: local.roleNote,
        }),
      });
      if (res.ok) stamp();
    },
    [person]
  );

  function update(projectId: string, patch: Partial<Local>, opts: { debounceRole?: boolean } = {}) {
    setByProject((prev) => {
      const cur = prev[projectId] ?? { involvement: "", isOwner: false, roleNote: "" };
      const next = { ...cur, ...patch };
      const merged = { ...prev, [projectId]: next };
      if (opts.debounceRole) {
        clearTimeout(roleTimers.current[projectId]);
        roleTimers.current[projectId] = setTimeout(() => save(projectId, next), 600);
      } else {
        save(projectId, next);
      }
      return merged;
    });
  }

  function toggleOn(projectId: string) {
    setByProject((prev) => ({ ...prev, [projectId]: { involvement: "", isOwner: false, roleNote: "" } }));
  }

  async function toggleOff(projectId: string) {
    if (!window.confirm("เอาโปรเจกต์นี้ออกจากรายการของคุณ? ข้อมูลที่กรอกไว้จะถูกลบ")) return;
    await fetch(`/api/assignments?project=${projectId}&person=${person}`, { method: "DELETE" });
    setByProject((prev) => {
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
    stamp();
  }

  const staff = person ? getStaff(person) : undefined;
  const assigned = Object.entries(byProject).filter(([, v]) => v.involvement);
  const counts = { high: 0, medium: 0, low: 0 } as Record<Involvement, number>;
  for (const [, v] of assigned) if (v.involvement) counts[v.involvement]++;

  return (
    <div className="max-w-[720px] mx-auto px-5 py-8">
      <div className="eyebrow text-[13px] font-semibold tracking-[.14em] uppercase text-[var(--accent)] mb-2.5 flex items-center gap-2.5">
        <span className="w-[26px] h-0.5 bg-[var(--accent)] rounded-full" />
        True CJ Creations · โปรเจกต์
      </div>
      <h1 className="font-disp font-bold text-[26px] leading-tight mb-1">โปรเจกต์ที่คุณดูแลอยู่</h1>
      <p className="text-[14px] text-[var(--muted)] mb-5">อัปเดตได้เรื่อยๆ เมื่อรับหรือปล่อยโปรเจกต์ ระบบบันทึกให้อัตโนมัติ</p>

      <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">คุณคือใคร</label>
      <StaffCombobox value={person} onChange={pickPerson} />

      {staff && (
        <>
          <div className="mt-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[13.5px] text-[var(--ink)]">
              คุณอยู่ <b>{assigned.length}</b> โปรเจกต์
              {assigned.length > 0 && (
                <span className="text-[var(--muted)]">
                  {" · "}สูง {counts.high} · กลาง {counts.medium} · ต่ำ {counts.low}
                </span>
              )}
            </div>
            <span className="text-[12px] text-[var(--faint)]">{savedAt ? `บันทึกแล้ว ${savedAt}` : "ระบบบันทึกให้อัตโนมัติ"}</span>
          </div>

          {loading ? (
            <div className="text-[13.5px] text-[var(--faint)] py-8 text-center">กำลังโหลด…</div>
          ) : projects.length === 0 ? (
            <div className="text-[13.5px] text-[var(--faint)] py-8 text-center border border-[var(--line)] rounded-[14px]">
              ยังไม่มีโปรเจกต์ให้เลือก — หัวหน้าต้องสร้างรายการโปรเจกต์ก่อน
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((p) => {
                const local = byProject[p.id];
                const on = !!local;
                return (
                  <div key={p.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[15px]">{p.name}</div>
                        <div className="text-[12px] text-[var(--faint)] mt-0.5">
                          {p.code ? `${p.code} · ` : ""}
                          {STATUS_LABEL[p.status]}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                        <span className="text-[12.5px] text-[var(--muted)]">ฉันทำ</span>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => (e.target.checked ? toggleOn(p.id) : toggleOff(p.id))}
                          className="w-5 h-5 accent-[var(--accent)]"
                        />
                      </label>
                    </div>

                    {on && local && (
                      <div className="mt-3 pt-3 border-t border-[var(--line)] flex flex-col gap-3">
                        <div>
                          <div className="text-[12.5px] font-semibold text-[var(--muted)] mb-1.5">ระดับความเกี่ยวข้อง *</div>
                          <div className="grid grid-cols-3 gap-2">
                            {INVOLVEMENT_ORDER.map((lv) => {
                              const sel = local.involvement === lv;
                              return (
                                <button
                                  key={lv}
                                  type="button"
                                  onClick={() => update(p.id, { involvement: lv })}
                                  className={`rounded-[10px] border px-2 py-2 text-left transition-colors ${
                                    sel ? "border-transparent text-[#0F3D2E]" : "border-[var(--field-bd)] bg-[var(--field)] hover:border-[var(--accent-line)]"
                                  }`}
                                  style={sel ? { background: INVOLVEMENT_COLOR[lv] } : undefined}
                                >
                                  <div className="text-[13px] font-semibold">{INVOLVEMENT_LABEL[lv]}</div>
                                  <div className="text-[10.5px] leading-tight mt-0.5 opacity-80">{INVOLVEMENT_HINT[lv]}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-[13px] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={local.isOwner}
                            onChange={(e) => update(p.id, { isOwner: e.target.checked })}
                            className="w-4 h-4 accent-[var(--accent)]"
                          />
                          ฉันเป็นเจ้าของงานหลักของโปรเจกต์นี้
                        </label>

                        <div>
                          <label className="block text-[12.5px] font-semibold text-[var(--muted)] mb-1">
                            บทบาทในโปรเจกต์นี้ <span className="text-[var(--faint)] font-normal">(ใส่เฉพาะเมื่อต่างจากปกติ)</span>
                          </label>
                          <input
                            type="text"
                            value={local.roleNote}
                            onChange={(e) => update(p.id, { roleNote: e.target.value }, { debounceRole: true })}
                            placeholder={positionName(staff.positionId)}
                            className="w-full text-sm bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2 outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
