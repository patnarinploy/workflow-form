"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlowPosition, PairEdge, EdgeStatus } from "@/lib/reconcile";
import { useDirectory } from "@/components/DirectoryProvider";
import { buildSwimlane, EXTERNAL_LANE, SwimNode } from "@/lib/swimlane";

// View A renderer. Custom SVG (not React Flow) so we control the swimlane look,
// keep the render pannable/zoomable, and export exactly what is on screen —
// including whatever the lane filter is currently showing. See lib/swimlane.ts
// for why one job at a time + step_order ranking keeps this readable.

const COL_W = 150;
const LANE_H = 92;
const NODE_W = 116;
const NODE_H = 44;
const PAD_X = 150; // left gutter for lane labels
const PAD_TOP = 18;

type HiddenMode = "collapse" | "hide";

export function SwimlaneView({
  structure,
  edges,
  jobId,
  hidden,
  hiddenMode,
  onHiddenChange,
  onModeChange,
  onJump,
}: {
  structure: FlowPosition[];
  edges: PairEdge[];
  jobId: string;
  hidden: string[];
  hiddenMode: HiddenMode;
  onHiddenChange: (next: string[]) => void;
  onModeChange: (m: HiddenMode) => void;
  onJump: (jobId: string) => void;
}) {
  const { dir } = useDirectory();
  const swim = useMemo(() => buildSwimlane(structure, edges, dir, jobId), [structure, edges, dir, jobId]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const [hover, setHover] = useState<string | null>(null);
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 });
  const [highlightLane, setHighlightLane] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const laid = useMemo(() => {
    if (!swim) return null;
    const visibleLanes = swim.lanes.filter((l) => !hiddenSet.has(l.id));
    const laneRow = new Map(visibleLanes.map((l, i) => [l.id, i]));

    // map fractional cols to sequential slots
    const usableNodes = swim.nodes.filter((n) => laneRow.has(n.lane));
    const cols = Array.from(new Set(usableNodes.map((n) => n.col))).sort((a, b) => a - b);
    const colSlot = new Map(cols.map((c, i) => [c, i]));

    // position nodes, stacking collisions within a lane/col
    const slotStack = new Map<string, number>();
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of usableNodes) {
      const row = laneRow.get(n.lane)!;
      const cx = PAD_X + (colSlot.get(n.col) ?? 0) * COL_W;
      const skey = `${n.lane}:${n.col}`;
      const k = slotStack.get(skey) ?? 0;
      slotStack.set(skey, k + 1);
      const cy = PAD_TOP + row * LANE_H + LANE_H / 2 + (k - 0) * 26;
      pos.set(n.id, { x: cx, y: cy });
    }

    // links, with hidden-lane handling
    type Laid = { id: string; d: string; kind: string; status?: EdgeStatus; what?: string; from: string; to: string; faint?: boolean };
    const links: Laid[] = [];
    const floaties: { id: string; x: number; y: number; label: string; targetPos?: string }[] = [];
    const nodeById = new Map(swim.nodes.map((n) => [n.id, n]));

    for (const l of swim.links) {
      const a = nodeById.get(l.from);
      const b = nodeById.get(l.to);
      if (!a || !b) continue;
      const aHidden = !laneRow.has(a.lane);
      const bHidden = !laneRow.has(b.lane);
      if (aHidden && bHidden) continue;
      if (aHidden || bHidden) {
        if (hiddenMode === "hide") continue;
        // collapse: floating chip on the visible node's edge
        const visNode = aHidden ? b : a;
        const hidNode = aHidden ? a : b;
        const vp = pos.get(visNode.id);
        if (!vp) continue;
        floaties.push({
          id: `fl-${l.id}`,
          x: vp.x + (aHidden ? -NODE_W / 2 - 8 : NODE_W / 2 + 8),
          y: vp.y,
          label: `${aHidden ? "←" : "→"} ${dir.positionName(hidNode.lane)} (ซ่อน)`,
          targetPos: hidNode.lane,
        });
        continue;
      }
      const pa = pos.get(a.id)!;
      const pb = pos.get(b.id)!;
      const x1 = pa.x + NODE_W / 2;
      const y1 = pa.y;
      const x2 = pb.x - NODE_W / 2;
      const y2 = pb.y;
      let d: string;
      if (l.kind === "fail" && l.backEdge) {
        const midY = Math.min(y1, y2) - 34;
        d = `M ${pa.x} ${pa.y - NODE_H / 2} C ${pa.x} ${midY}, ${pb.x} ${midY}, ${pb.x} ${pb.y - NODE_H / 2}`;
      } else {
        const mx = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      }
      links.push({ id: l.id, d, kind: l.kind, status: l.status, what: l.what, from: a.id, to: b.id, faint: l.faint });
    }

    const width = PAD_X + cols.length * COL_W + 60;
    const height = PAD_TOP + visibleLanes.length * LANE_H + 20;
    return { visibleLanes, laneRow, pos, links, floaties, width: Math.max(width, 480), height: Math.max(height, 160), nodeById, usableNodes };
  }, [swim, hiddenSet, hiddenMode, dir]);

  if (!swim) return <div className="text-[13.5px] text-[var(--faint)] py-10 text-center">เลือกงานเพื่อดูผัง</div>;
  if (!laid) return null;

  const linkColor = (kind: string, status?: EdgeStatus) => {
    if (kind === "seq") return "#6C7A73";
    if (kind === "fail") return "#C0392B";
    if (kind === "parallel") return "#7C5CBF";
    if (status === "matched") return "#128A64";
    return "#B65418";
  };
  const linkDashed = (kind: string, status?: EdgeStatus) => kind === "fail" || kind === "parallel" || (kind !== "seq" && status !== "matched");
  // parallel = no arrowhead (happens at the same time, no direction)
  const linkMarker = (kind: string, status?: EdgeStatus) =>
    kind === "parallel" ? undefined : `url(#${kind === "seq" ? "a-seq" : kind === "fail" ? "a-fail" : status === "matched" ? "a-ok" : "a-warn"})`;

  const connected = (nid: string): Set<string> => {
    const s = new Set<string>([nid]);
    for (const l of laid.links) {
      if (l.from === nid) s.add(l.to);
      if (l.to === nid) s.add(l.from);
    }
    return s;
  };
  const hoverSet = hover ? connected(hover) : null;
  const nodeDim = (nid: string) => hoverSet != null && !hoverSet.has(nid);
  const linkDim = (l: { from: string; to: string }) => hoverSet != null && !(hoverSet.has(l.from) && hoverSet.has(l.to));

  // Native NON-passive wheel listener so preventDefault actually works — a React
  // onWheel is passive, so its preventDefault is ignored and a trackpad
  // two-finger swipe-right triggers the browser BACK gesture (which then fails to
  // reload the previous RSC page). Wheel pans; ctrl/⌘+wheel (pinch) zooms.
  const svgWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
        setTf((t) => ({ ...t, k: Math.min(2.5, Math.max(0.3, t.k * factor)) }));
      } else {
        setTf((t) => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: tf.x, oy: tf.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setTf((t) => ({ ...t, x: drag.current!.ox + (e.clientX - drag.current!.x), y: drag.current!.oy + (e.clientY - drag.current!.y) }));
  };
  const onPointerUp = () => (drag.current = null);

  function exportSvg() {
    const el = svgRef.current;
    if (!el || !laid || !swim) return;
    const clone = el.cloneNode(true) as SVGSVGElement;
    // reset transform for a clean full export
    const g = clone.querySelector("g[data-pan]");
    if (g) g.setAttribute("transform", "translate(0,0) scale(1)");
    clone.setAttribute("width", String(laid.width));
    clone.setAttribute("height", String(laid.height));
    clone.setAttribute("viewBox", `0 0 ${laid.width} ${laid.height}`);
    const blob = new Blob(['<?xml version="1.0"?>\n', new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swimlane-${swim.job.name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // filter helpers
  const allLaneIds = swim.lanes.map((l) => l.id);
  const shownCount = allLaneIds.filter((id) => !hiddenSet.has(id)).length;
  const setHiddenIds = (ids: string[]) => onHiddenChange(ids);
  const toggleLane = (id: string) => onHiddenChange(hiddenSet.has(id) ? hidden.filter((h) => h !== id) : [...hidden, id]);
  const groupsPresent = Array.from(new Set(swim.lanes.filter((l) => l.id !== EXTERNAL_LANE).map((l) => dir.getPosition(l.id)?.group))).filter(Boolean) as string[];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_250px]">
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--line)] text-[12px] text-[var(--muted)] flex-wrap">
          <span className="font-semibold text-[var(--ink)]">{swim.job.label}</span>
          <span className="text-[var(--faint)]">· {laid.visibleLanes.length} lane</span>
          <button onClick={() => setTf({ x: 0, y: 0, k: 1 })} className="ml-auto text-[12px] border border-[var(--line)] rounded-full px-2.5 py-1">รีเซ็ตมุมมอง</button>
          <button onClick={exportSvg} className="text-[12px] font-semibold text-[var(--accent)] border border-[var(--accent-line)] rounded-full px-2.5 py-1">↓ SVG</button>
        </div>
        <div ref={svgWrapRef} style={{ height: 520, cursor: drag.current ? "grabbing" : "grab", touchAction: "none", overscrollBehavior: "none" }}>
          <svg
            ref={svgRef}
            width="100%"
            height="520"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{ display: "block", background: "#FBFCFB" }}
          >
            <defs>
              <marker id="a-seq" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#6C7A73" /></marker>
              <marker id="a-ok" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#128A64" /></marker>
              <marker id="a-warn" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#B65418" /></marker>
              <marker id="a-fail" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#C0392B" /></marker>
            </defs>
            <g data-pan transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}>
              {/* lane bands */}
              {laid.visibleLanes.map((l, i) => (
                <g key={l.id}>
                  <rect
                    x={0}
                    y={PAD_TOP + i * LANE_H}
                    width={laid.width}
                    height={LANE_H}
                    fill={highlightLane === l.id ? "#EEF5F1" : i % 2 ? "#F7F9F8" : "#FBFCFB"}
                  />
                  <line x1={PAD_X - 12} y1={PAD_TOP + i * LANE_H} x2={PAD_X - 12} y2={PAD_TOP + (i + 1) * LANE_H} stroke="#E3E8E4" />
                  <text x={10} y={PAD_TOP + i * LANE_H + 22} fontSize={12.5} fontWeight={600} fill="#1C2A25">{l.name}</text>
                  {l.members.length > 0 && (
                    <text x={10} y={PAD_TOP + i * LANE_H + 38} fontSize={10.5} fill="#93A099">{l.members.join(", ")}</text>
                  )}
                </g>
              ))}

              {/* links */}
              {laid.links.map((l) => (
                <path
                  key={l.id}
                  d={l.d}
                  fill="none"
                  stroke={linkColor(l.kind, l.status)}
                  strokeWidth={l.kind === "seq" ? 1.6 : 1.8}
                  strokeDasharray={linkDashed(l.kind, l.status) ? "5 4" : undefined}
                  markerEnd={linkMarker(l.kind, l.status)}
                  opacity={linkDim(l) ? 0.12 : l.faint ? 0.45 : 0.9}
                >
                  {l.what || l.kind === "parallel" ? (
                    <title>
                      {l.kind === "parallel" ? "ทำควบคู่กัน" : ""}
                      {l.what ? (l.kind === "parallel" ? `: ${l.what}` : l.what) : ""}
                      {l.status ? ` · ${l.status === "matched" ? "ยืนยันสองฝั่ง" : l.status === "mismatch" ? "ไม่ตรงกัน" : "รออีกฝั่ง"}` : ""}
                    </title>
                  ) : null}
                </path>
              ))}

              {/* floating chips for hidden targets */}
              {laid.floaties.map((f) => (
                <g key={f.id} transform={`translate(${f.x},${f.y})`} style={{ cursor: "pointer" }} onClick={() => f.targetPos && toggleLane(f.targetPos)}>
                  <rect x={-8} y={-11} width={130} height={22} rx={11} fill="#F1EDE6" stroke="#D9C2A6" />
                  <text x={4} y={4} fontSize={10.5} fill="#8A5A1C">{f.label}</text>
                </g>
              ))}

              {/* nodes */}
              {laid.usableNodes.map((n) => {
                const p = laid.pos.get(n.id)!;
                const dim = nodeDim(n.id);
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    opacity={dim ? 0.25 : 1}
                    onMouseEnter={() => setHover(n.id)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: n.targetPos ? "pointer" : "default" }}
                    onClick={() => {
                      if (!n.targetPos) return;
                      const fp = structure.find((s) => s.positionId === n.targetPos);
                      if (fp?.jobs[0]) onJump(fp.jobs[0].id);
                    }}
                  >
                    {renderNode(n)}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* side panel */}
      <div className="flex flex-col gap-3">
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">ตำแหน่งในงานนี้</span>
            <span className="text-[11px] text-[var(--muted)]">โชว์ {shownCount}/{allLaneIds.length}</span>
          </div>
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <button onClick={() => setHiddenIds([])} className="text-[11px] border border-[var(--line)] rounded-full px-2 py-0.5">เลือกทั้งหมด</button>
            <button onClick={() => setHiddenIds(allLaneIds)} className="text-[11px] border border-[var(--line)] rounded-full px-2 py-0.5">เอาออกทั้งหมด</button>
            {groupsPresent.map((g) => (
              <button
                key={g}
                onClick={() => setHiddenIds(allLaneIds.filter((id) => id !== EXTERNAL_LANE && dir.getPosition(id)?.group !== g))}
                className="text-[11px] border border-[var(--line)] rounded-full px-2 py-0.5"
              >
                เฉพาะ {g}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {swim.lanes.map((l) => (
              <label
                key={l.id}
                onMouseEnter={() => setHighlightLane(l.id)}
                onMouseLeave={() => setHighlightLane(null)}
                className="flex items-center gap-2 text-[12.5px] cursor-pointer"
              >
                <input type="checkbox" checked={!hiddenSet.has(l.id)} onChange={() => toggleLane(l.id)} className="w-4 h-4 accent-[var(--accent)]" />
                <span className={l.hasSteps ? "font-semibold" : ""}>{l.name}</span>
                {l.hasSteps && <span className="text-[10px] text-[var(--accent)]">เจ้าของ</span>}
              </label>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-[var(--line)]">
            <label className="text-[11px] text-[var(--muted)] block mb-1">เส้นที่ชี้ไป lane ที่ซ่อน</label>
            <select value={hiddenMode} onChange={(e) => onModeChange(e.target.value as HiddenMode)} className="w-full text-[12px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[8px] px-2 py-1.5">
              <option value="collapse">ยุบเป็นชิปที่ขอบ (ไม่ให้ข้อมูลหาย)</option>
              <option value="hide">ซ่อนทั้งเส้น (ผังสะอาด)</option>
            </select>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-3.5 text-[12.5px]">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)] mb-2">งานนี้มี</div>
          {[
            ["ขั้นตอน", swim.stats.steps],
            ["จุดส่งงาน", swim.stats.sends],
            ["จุดอนุมัติ", swim.stats.approvals],
            ["จุดตีกลับ", swim.stats.returns],
            ["จุดทำควบคู่", swim.stats.parallels],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between py-0.5">
              <span className="text-[var(--muted)]">{k}</span>
              <b>{v}</b>
            </div>
          ))}
          {swim.stats.parallelsUnpinned > 0 && (
            <div className="flex justify-between py-0.5 mt-1 pt-1 border-t border-[var(--line)]">
              <span className="text-[#7C5CBF]">ยังไม่ระบุขั้นตอนคู่ขนาน</span>
              <b className="text-[#7C5CBF]">{swim.stats.parallelsUnpinned}</b>
            </div>
          )}
        </div>

        {swim.crossJob.length > 0 && (
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)] mb-2">โยงกับงานของ</div>
            <div className="flex flex-col gap-1">
              {swim.crossJob.map((c) => (
                <button
                  key={c.pos}
                  disabled={!c.jobId}
                  onClick={() => c.jobId && onJump(c.jobId)}
                  className="text-left text-[12.5px] text-[var(--accent)] disabled:text-[var(--faint)] disabled:no-underline underline"
                >
                  {c.label} {c.jobId ? "→" : "(ไม่มีงานของตัวเอง)"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderNode(n: SwimNode) {
  if (n.kind === "endpoint") {
    const w = 128;
    return (
      <>
        <rect
          x={-w / 2}
          y={-14}
          width={w}
          height={28}
          rx={9}
          fill={n.faint ? "transparent" : n.external ? "#EFE7DE" : "#EEF1EE"}
          stroke={n.faint ? "#B7A6DE" : n.external ? "#D9C2A6" : "#CBD5CF"}
          strokeDasharray={n.faint ? "4 3" : undefined}
          opacity={n.faint ? 0.85 : 1}
        />
        <text x={0} y={4} fontSize={10.5} textAnchor="middle" fill={n.faint ? "#7C5CBF" : n.external ? "#8A5A1C" : "#3A4A43"}>
          {truncate(n.label, 22)}
        </text>
      </>
    );
  }
  const isDec = n.kind === "decision";
  const hasApprover = !!n.approver;
  return (
    <>
      {isDec ? (
        <>
          <polygon points={`0,${-NODE_H / 2 - 4} ${NODE_W / 2},0 0,${NODE_H / 2 + 4} ${-NODE_W / 2},0`} fill="#FBEEE1" stroke="#B65418" strokeWidth={1.6} />
          <text x={0} y={n.decider ? -8 : -2} fontSize={11.5} textAnchor="middle" fill="#8A3D12">{truncate(n.label, 16)}</text>
          {n.decider && (
            <text x={0} y={3} fontSize={8.5} textAnchor="middle" fill="#8A3D12">
              ตัดสิน: {truncate(n.decider, 18)}
              <title>{n.decider}</title>
            </text>
          )}
          {n.decisionFail && <text x={0} y={n.decider ? 15 : 12} fontSize={9.5} textAnchor="middle" fill="#B65418">{truncate(n.decisionFail, 20)}</text>}
        </>
      ) : (
        <>
          <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={10} fill="#E4F5EE" stroke="#57C79E" strokeWidth={hasApprover ? 3 : 1.5} />
          <text x={0} y={n.index ? -2 : 4} fontSize={11.5} textAnchor="middle" fill="#04342C">{truncate(n.label, 18)}</text>
          {n.index != null && <text x={-NODE_W / 2 + 10} y={-NODE_H / 2 + 12} fontSize={9} fill="#128A64">{n.index}</text>}
          {hasApprover && <text x={0} y={13} fontSize={8.5} textAnchor="middle" fill="#0F5F47">อนุมัติ: {truncate(n.approver!, 16)}</text>}
        </>
      )}
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
