"use client";

import { useMemo, useState } from "react";
import { STAFF_ORDERED, staffLabel, getStaff } from "@/lib/staff";
import { GROUP_ORDER, GROUP_LABEL, PositionGroup, getPosition } from "@/lib/positions";
import {
  Project,
  Assignment,
  Involvement,
  INVOLVEMENT_LABEL,
  INVOLVEMENT_COLOR,
  summarizePeople,
  topScoreThreshold,
} from "@/lib/projects";

const groupOfStaff = (id: string): PositionGroup | undefined => getPosition(getStaff(id)?.positionId ?? "")?.group;

export function MatrixClient({ projects, assignments }: { projects: Project[]; assignments: Assignment[] }) {
  const [view, setView] = useState<"people" | "projects">("people");
  const [sortByScore, setSortByScore] = useState(false);
  const [groups, setGroups] = useState<Set<PositionGroup>>(new Set(GROUP_ORDER));

  const toggleGroup = (g: PositionGroup) =>
    setGroups((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  const { activeIds, summaries, summaryById, maxScore, topThreshold, cell } = useMemo(() => {
    const activeIds = new Set(projects.map((p) => p.id));
    const summaries = summarizePeople(activeIds, assignments);
    const summaryById = new Map(summaries.map((s) => [s.staffId, s]));
    const maxScore = Math.max(1, ...summaries.map((s) => s.score));
    const topThreshold = topScoreThreshold(summaries);
    const cell = new Map<string, Assignment>();
    for (const a of assignments) cell.set(`${a.person_id}:${a.project_id}`, a);
    return { activeIds, summaries, summaryById, maxScore, topThreshold, cell };
  }, [projects, assignments]);

  const visibleStaff = useMemo(() => {
    let list = STAFF_ORDERED.filter((s) => {
      const g = groupOfStaff(s.id);
      return g ? groups.has(g) : true;
    });
    if (sortByScore) {
      list = [...list].sort((a, b) => (summaryById.get(b.id)?.score ?? 0) - (summaryById.get(a.id)?.score ?? 0));
    }
    return list;
  }, [groups, sortByScore, summaryById]);

  const isTop = (score: number) => score > 0 && score >= topThreshold;

  function ScoreBar({ score }: { score: number }) {
    const pct = Math.round((score / maxScore) * 100);
    const color = isTop(score) ? "#B65418" : "#128A64";
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-2.5 rounded-full bg-[var(--bg)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color }}>{score}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-full border border-[var(--line)] overflow-hidden">
          <button onClick={() => setView("people")} className={`text-[12.5px] font-semibold px-3 py-1.5 ${view === "people" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>
            รายคน
          </button>
          <button onClick={() => setView("projects")} className={`text-[12.5px] font-semibold px-3 py-1.5 ${view === "projects" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>
            รายโปรเจกต์
          </button>
        </div>
        <span className="text-[12px] text-[var(--faint)] ml-1">กรอง:</span>
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            onClick={() => toggleGroup(g)}
            className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${groups.has(g) ? "bg-[var(--accent-soft)] border-[var(--accent-line)] text-[#0F5F47]" : "text-[var(--faint)] border-[var(--line)]"}`}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
        <a href="/api/admin/projects/csv" className="ml-auto text-[12.5px] font-semibold text-[var(--accent)] border border-[var(--accent-line)] rounded-full px-3 py-1.5">
          ↓ CSV
        </a>
      </div>

      {projects.length === 0 ? (
        <div className="text-[13.5px] text-[var(--faint)] py-8 text-center border border-[var(--line)] rounded-[14px]">
          ยังไม่มีโปรเจกต์ที่กำลังทำอยู่
        </div>
      ) : view === "people" ? (
        <>
          <div className="overflow-x-auto border border-[var(--line)] rounded-[14px] bg-[var(--surface)]">
            <table className="text-[12.5px] border-collapse min-w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="sticky left-0 z-10 bg-[var(--surface)] text-left font-semibold px-3 py-2 min-w-[190px]">คน</th>
                  {projects.map((p) => (
                    <th key={p.id} className="px-2 py-2 font-medium text-[var(--muted)] whitespace-nowrap max-w-[130px] truncate" title={p.name}>
                      {p.code || p.name}
                    </th>
                  ))}
                  <th onClick={() => setSortByScore((v) => !v)} className="px-3 py-2 text-left font-semibold cursor-pointer whitespace-nowrap min-w-[150px]">
                    คะแนนภาระ {sortByScore ? "▾" : "⇅"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(sortByScore ? [{ group: null as PositionGroup | null, items: visibleStaff }] : GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({ group: g, items: visibleStaff.filter((s) => groupOfStaff(s.id) === g) }))).map(
                  (section) =>
                    section.items.length > 0 && (
                      <ByGroup key={section.group ?? "all"} group={section.group}>
                        {section.items.map((s) => {
                          const sum = summaryById.get(s.id)!;
                          return (
                            <tr key={s.id} className="border-b border-[var(--line)] last:border-0">
                              <td className="sticky left-0 z-10 bg-[var(--surface)] px-3 py-1.5 whitespace-nowrap">{staffLabel(s.id)}</td>
                              {projects.map((p) => {
                                const a = cell.get(`${s.id}:${p.id}`);
                                return (
                                  <td key={p.id} className="px-2 py-1.5 text-center" style={{ background: a ? INVOLVEMENT_COLOR[a.involvement] : "var(--bg)" }}>
                                    {a ? (
                                      <span className="inline-flex items-center gap-0.5 text-[11px] text-[#0F3D2E]">
                                        {INVOLVEMENT_LABEL[a.involvement]}
                                        {a.is_owner && <span title="เจ้าของงานหลัก">★</span>}
                                      </span>
                                    ) : (
                                      <span className="text-[var(--faint)]">–</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-1.5">
                                <ScoreBar score={sum.score} />
                              </td>
                            </tr>
                          );
                        })}
                      </ByGroup>
                    )
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-[var(--faint)] mt-3 leading-relaxed">
            คะแนนนี้มาจากที่แต่ละคนประเมินตัวเอง (สูง×3 + กลาง×2 + ต่ำ×1) ใช้เทียบกันในทีม ไม่ใช่ % ของเวลาทำงานจริง · ★ = เจ้าของงานหลัก · สีส้ม = ภาระอยู่ใน 25% บนสุด
          </p>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const people = STAFF_ORDERED.filter((s) => cell.has(`${s.id}:${p.id}`));
            return (
              <div key={p.id} className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-4">
                <div className="font-semibold text-[14.5px] mb-2">
                  {p.name} <span className="text-[12px] text-[var(--faint)]">· {people.length} คน</span>
                </div>
                {people.length === 0 ? (
                  <div className="text-[12.5px] text-[var(--faint)]">ยังไม่มีใครกรอกว่าทำโปรเจกต์นี้</div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {people.map((s) => {
                      const a = cell.get(`${s.id}:${p.id}`)!;
                      return (
                        <li key={s.id} className="flex items-center gap-2 text-[12.5px]">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: INVOLVEMENT_COLOR[a.involvement] }} />
                          <span>{staffLabel(s.id)}</span>
                          <span className="text-[var(--faint)]">· {INVOLVEMENT_LABEL[a.involvement]}</span>
                          {a.is_owner && <span className="text-[#B65418]" title="เจ้าของงานหลัก">★</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ByGroup({ group, children }: { group: PositionGroup | null; children: React.ReactNode }) {
  return (
    <>
      {group && (
        <tr className="bg-[var(--bg)]/60">
          <td className="sticky left-0 z-10 bg-[var(--bg)] px-3 py-1 text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide">{GROUP_LABEL[group]}</td>
          <td className="text-[11px] text-[var(--faint)] px-2 py-1" colSpan={99}></td>
        </tr>
      )}
      {children}
    </>
  );
}
