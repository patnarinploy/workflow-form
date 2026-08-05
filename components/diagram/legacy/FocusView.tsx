"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FlowPosition, FlowStep, PairEdge, EdgeStatus } from "@/lib/reconcile";
import { useDirectory } from "@/components/DirectoryProvider";
import { SPECIAL_LABEL } from "@/lib/positions";
import { isSpecialToken } from "@/lib/types";

// WHY THIS READS EASILY (do not "fix" it back into a swimlane):
// Every cross-position handoff is rendered as a CHIP on the left/right edge —
// never a line dragged across the screen. The only real connectors are the
// vertical step sequence and the single back-edge curve, both confined to the
// middle column of ONE position, so lines can never tangle.

type Row =
  | { kind: "job"; jobId: string; name: string; meta: string }
  | { kind: "step"; jobId: string; step: FlowStep; index: number };

const chipBase =
  "inline-flex items-center gap-1 text-[11.5px] rounded-full px-2 py-0.5 max-w-full border transition-colors";

function statusClass(status: EdgeStatus | null): string {
  if (status === "matched") return "bg-[var(--accent-soft)] border-[var(--accent-line)] text-[#0F5F47]";
  if (status === "mismatch") return "bg-[#FBEEE1] border-[#B65418] text-[#8A4A16]";
  if (status === "pending") return "bg-transparent border-dashed border-[var(--field-bd)] text-[var(--faint)]";
  return "bg-[#EFE7DE] border-[#D9C2A6] text-[#8A5A1C]"; // external
}

export function FocusView({
  structure,
  edges,
  posId,
  onNavigate,
}: {
  structure: FlowPosition[];
  edges: PairEdge[];
  posId: string;
  onNavigate: (id: string, view?: "focus" | "overview") => void;
}) {
  const { dir } = useDirectory();
  const gridRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [paths, setPaths] = useState<{ d: string; key: string }[]>([]);

  const edgeStatus = useMemo(() => {
    const m = new Map<string, EdgeStatus>();
    for (const e of edges) m.set(`${e.from}|${e.to}`, e.status);
    return m;
  }, [edges]);

  const pos = dir.getPosition(posId);
  const flow = structure.find((s) => s.positionId === posId);
  const jobs = useMemo(() => [...(flow?.jobs ?? [])].sort((a, b) => a.order - b.order), [flow]);

  // prev/next within the same group
  const group = pos?.group ?? "";
  const groupPeers = dir.positionsInGroup(group);
  const gi = groupPeers.findIndex((p) => p.id === posId);
  const prev = gi > 0 ? groupPeers[gi - 1] : null;
  const next = gi >= 0 && gi < groupPeers.length - 1 ? groupPeers[gi + 1] : null;

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const job of jobs) {
      out.push({ kind: "job", jobId: job.id, name: job.name, meta: `${job.steps.length} ขั้นตอน` });
      job.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach((step, i) => out.push({ kind: "step", jobId: job.id, step, index: i + 1 }));
    }
    return out;
  }, [jobs]);

  // measure step boxes -> draw same-job back-edge curves in the middle column
  useLayoutEffect(() => {
    function measure() {
      const container = gridRef.current;
      if (!container) return;
      const cRect = container.getBoundingClientRect();
      const stepJob = new Map<string, string>();
      for (const job of jobs) for (const s of job.steps) stepJob.set(s.id, job.id);
      const next: { d: string; key: string }[] = [];
      for (const job of jobs) {
        for (const s of job.steps) {
          const d = s.decision;
          if (!d?.failStepId) continue;
          if (stepJob.get(d.failStepId) !== job.id) continue; // same-job only
          const fromEl = stepRefs.current.get(s.id);
          const toEl = stepRefs.current.get(d.failStepId);
          if (!fromEl || !toEl) continue;
          const fr = fromEl.getBoundingClientRect();
          const tr = toEl.getBoundingClientRect();
          const x = fr.left - cRect.left - 6;
          const y1 = fr.top - cRect.top + fr.height / 2;
          const y2 = tr.top - cRect.top + tr.height / 2;
          const bow = Math.min(48, 18 + Math.abs(y1 - y2) * 0.12);
          next.push({ key: `${s.id}->${d.failStepId}`, d: `M ${x} ${y1} C ${x - bow} ${y1}, ${x - bow} ${y2}, ${x} ${y2}` });
        }
      }
      setPaths(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [rows, jobs]);

  const targetLabel = (token: string) =>
    isSpecialToken(token) ? SPECIAL_LABEL.external : dir.positionName(token);
  // ONE central label helper — members shown under the position everywhere a
  // position appears (disambiguates same-nick people, e.g. two "พลอย").
  const namesOf = (token: string): string =>
    isSpecialToken(token) ? "" : dir.positionLabel(token, { withNames: true }).names;
  const namesOfMany = (ids: string[]): string => ids.map(namesOf).filter(Boolean).join(", ");

  // header counts
  const stepCount = jobs.reduce((n, j) => n + j.steps.length, 0);
  const inboundPos = new Set<string>();
  const outboundPos = new Set<string>();
  for (const j of jobs)
    for (const s of j.steps) {
      s.waits.forEach((w) => w.targets.forEach((t) => inboundPos.add(t)));
      s.sends.forEach((sd) => sd.targets.forEach((t) => outboundPos.add(t)));
    }

  function StatusChip({ token, what, dir: arrow, conditional }: { token: string; what: string; dir: "from" | "to"; conditional?: string }) {
    const special = isSpecialToken(token);
    const status: EdgeStatus | null = special
      ? null
      : arrow === "to"
      ? edgeStatus.get(`${posId}|${token}`) ?? "pending"
      : edgeStatus.get(`${token}|${posId}`) ?? "pending";
    const clickable = !special;
    const names = namesOf(token);
    return (
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onNavigate(token)}
        title={[what, names].filter(Boolean).join(" — ") || undefined}
        className={`${chipBase} ${statusClass(status)} ${clickable ? "hover:brightness-95 cursor-pointer" : "cursor-default"} ${arrow === "to" ? "items-end" : "items-start"} !flex-col !gap-0`}
      >
        <span className="inline-flex items-center gap-1 max-w-full">
          {status === "matched" && <span className="opacity-60">✓</span>}
          {status === "mismatch" && <span title="อีกฝั่งกรอกแล้วแต่ไม่ตรง">⚠</span>}
          <span className="truncate">
            <span className="opacity-70">{arrow === "from" ? "จาก " : "ให้ "}</span>
            {targetLabel(token)}
            {what ? <span className="opacity-80"> : {what}</span> : null}
          </span>
          {conditional ? <span className="text-[10px] bg-white/60 rounded px-1 ml-0.5">ถ้า {conditional}</span> : null}
        </span>
        {names ? <span className="text-[10px] opacity-70 truncate max-w-full leading-tight">{names}</span> : null}
      </button>
    );
  }

  return (
    <div>
      {/* header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">{group}</div>
          <h2 className="font-disp font-bold text-[19px] leading-tight">{pos?.name ?? posId}</h2>
          <div className="text-[12.5px] text-[var(--muted)] mt-0.5">
            {dir.positionMembers(posId).join(", ") || "—"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={!prev}
            onClick={() => prev && onNavigate(prev.id)}
            className="text-[12.5px] px-2.5 py-1.5 rounded-[8px] border border-[var(--line)] disabled:opacity-40"
          >
            ‹ ก่อนหน้า
          </button>
          <button
            disabled={!next}
            onClick={() => next && onNavigate(next.id)}
            className="text-[12.5px] px-2.5 py-1.5 rounded-[8px] border border-[var(--line)] disabled:opacity-40"
          >
            ถัดไป ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-[12px]">
        {[
          ["งาน (job)", jobs.length],
          ["ขั้นตอน", stepCount],
          ["รับเข้าจาก", `${inboundPos.size} ตำแหน่ง`],
          ["ส่งออกไป", `${outboundPos.size} ตำแหน่ง`],
        ].map(([label, v]) => (
          <span key={String(label)} className="bg-[var(--surface)] border border-[var(--line)] rounded-full px-3 py-1 text-[var(--muted)]">
            {label}: <b className="text-[var(--ink)]">{v}</b>
          </span>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="text-[13.5px] text-[var(--faint)] py-10 text-center border border-dashed border-[var(--line)] rounded-[14px]">
          ตำแหน่งนี้ยังไม่ได้กรอกข้อมูลงาน
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[minmax(120px,1fr)_minmax(240px,1.5fr)_minmax(120px,1fr)] gap-x-3 gap-y-2 relative min-w-[720px]" ref={gridRef}>
            {/* back-edge overlay (same-job returns only) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
              <defs>
                <marker id="focusBack" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#B65418" />
                </marker>
              </defs>
              {paths.map((p) => (
                <path key={p.key} d={p.d} fill="none" stroke="#B65418" strokeWidth={1.6} strokeDasharray="4 3" markerEnd="url(#focusBack)" opacity={0.9} />
              ))}
            </svg>

            <div className="col-span-3 grid grid-cols-subgrid text-[11px] font-semibold text-[var(--faint)] uppercase tracking-wide">
              <div>รับเข้ามาจาก</div>
              <div className="text-center">งานของตำแหน่งนี้</div>
              <div className="text-right">ส่งออกไปให้</div>
            </div>

            {rows.map((row) => {
              if (row.kind === "job") {
                return (
                  <div key={`job-${row.jobId}`} className="col-span-3 grid grid-cols-subgrid items-stretch">
                    <div />
                    <div className="bg-[var(--accent-soft)] border border-[var(--accent-line)] rounded-[10px] px-3 py-1.5 text-center">
                      <span className="font-semibold text-[13.5px] text-[#0F5F47]">{row.name}</span>
                      <span className="text-[11px] text-[#3B7A63] ml-1.5">· {row.meta}</span>
                    </div>
                    <div />
                  </div>
                );
              }
              const s = row.step;
              const decision = s.decision;
              const isDecision = !!decision;
              const failStepIndex =
                decision?.failStepId != null
                  ? rows.find((r) => r.kind === "step" && r.step.id === decision.failStepId && r.jobId === row.jobId)
                  : undefined;
              return (
                <div key={`step-${s.id}`} className="col-span-3 grid grid-cols-subgrid items-center">
                  {/* left: waits */}
                  <div className="flex flex-col items-start gap-1 py-0.5">
                    {s.waits.flatMap((w, wi) =>
                      w.targets.map((t, ti) => <StatusChip key={`w-${wi}-${ti}`} token={t} what={w.what} dir="from" />)
                    )}
                  </div>

                  {/* middle: step box */}
                  <div
                    ref={(el) => {
                      if (el) stepRefs.current.set(s.id, el);
                      else stepRefs.current.delete(s.id);
                    }}
                    className={`rounded-[10px] border px-3 py-2 ${
                      isDecision ? "bg-[#FBEEE1] border-[#B65418]" : "bg-[#E4F5EE] border-[#57C79E]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 text-[11px] font-semibold rounded-full w-5 h-5 flex items-center justify-center ${isDecision ? "bg-[#B65418] text-white" : "bg-[#128A64] text-white"}`}>
                        {row.index}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] text-[#1C2A25] leading-snug">{s.action}</div>
                        {(s.approvers.length > 0 || s.approverExternal) && (
                          <div className="mt-1">
                            <div className="inline-flex items-center gap-1 text-[11px] bg-white/70 border border-[var(--line)] rounded-full px-2 py-0.5">
                              อนุมัติโดย {[...s.approvers.map((a) => dir.positionName(a)), ...(s.approverExternal ? ["ลูกค้า/ภายนอก"] : [])].join(", ")}
                            </div>
                            {namesOfMany(s.approvers) && (
                              <div className="text-[10px] text-[var(--faint)] mt-0.5 ml-2">{namesOfMany(s.approvers)}</div>
                            )}
                          </div>
                        )}
                        {isDecision && (
                          <div className="mt-1 text-[11px] text-[#8A4A16]">
                            จุดตัดสินใจ — ถ้าไม่ผ่าน:{" "}
                            {decision!.failStepId ? (
                              failStepIndex && failStepIndex.kind === "step" ? (
                                <button onClick={() => stepRefs.current.get(decision!.failStepId)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="underline font-semibold">
                                  ↑ ย้อนไปขั้นที่ {failStepIndex.index}
                                </button>
                              ) : (
                                "ย้อนไปขั้นก่อนหน้า"
                              )
                            ) : decision!.failExternal ? (
                              "ส่งกลับ ลูกค้า/ภายนอก"
                            ) : decision!.failPosition ? (
                              <button onClick={() => onNavigate(decision!.failPosition)} className="underline font-semibold" title={namesOf(decision!.failPosition) || undefined}>
                                กลับไป {dir.positionName(decision!.failPosition)}
                                {namesOf(decision!.failPosition) ? <span className="font-normal opacity-70"> ({namesOf(decision!.failPosition)})</span> : null}
                              </button>
                            ) : (
                              "—"
                            )}
                            {decision!.failReason ? <span className="opacity-80"> ({decision!.failReason})</span> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* right: sends */}
                  <div className="flex flex-col items-end gap-1 py-0.5">
                    {s.sends.flatMap((sd, si) =>
                      sd.targets.map((t, ti) => (
                        <StatusChip key={`s-${si}-${ti}`} token={t} what={sd.what} dir="to" conditional={sd.conditional ? sd.condition : undefined} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
