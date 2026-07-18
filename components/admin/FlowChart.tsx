"use client";

import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType, Position, type Node, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowPosition, PairEdge } from "@/lib/reconcile";
import { useDirectory } from "@/components/DirectoryProvider";

const LANE_W = 250;
const LANE_GAP = 44;
const HEADER_H = 58;
const JOB_HEAD_H = 30;
const STEP_H = 58;
const STEP_GAP = 8;
const JOB_PAD_BOTTOM = 12;
const JOB_GAP = 18;

const GROUP_COLOR: Record<string, string> = {
  Executive: "#7C5CBF",
  Commercial: "#128A64",
  Production: "#2E7CD6",
  Operation: "#B6841C",
};
const EXTRA_GROUP_COLORS = ["#C2508A", "#3AA6A6", "#8A6D3B", "#5C6BC0"];
function colorFor(group: string, groups: string[]): string {
  if (GROUP_COLOR[group]) return GROUP_COLOR[group];
  const i = groups.indexOf(group);
  return EXTRA_GROUP_COLORS[Math.max(0, i) % EXTRA_GROUP_COLORS.length];
}

function truncate(s: string, n = 40) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function FlowChart({ structure, edges }: { structure: FlowPosition[]; edges: PairEdge[] }) {
  const { dir } = useDirectory();
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(dir.groups));

  const toggleGroup = (g: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const { nodes, rfEdges, empty } = useMemo(() => {
    const byId = new Map(structure.map((p) => [p.positionId, p]));
    const lanePositions = dir.activePositions.filter((p) => byId.has(p.id) && byId.get(p.id)!.jobs.length > 0 && enabled.has(p.group)).map((p) => p.id);
    const laneSet = new Set(lanePositions);

    if (lanePositions.length === 0) {
      return { nodes: [] as Node[], rfEdges: [] as RFEdge[], empty: true };
    }

    const edgeMap = new Map<string, PairEdge>();
    for (const e of edges) edgeMap.set(`${e.from}|${e.to}`, e);

    const laneX = new Map<string, number>();
    lanePositions.forEach((pid, i) => laneX.set(pid, i * (LANE_W + LANE_GAP)));

    const outNodes: Node[] = [];
    // absolute top-left position of each rendered step node (for placing diamond nodes)
    const stepAbs = new Map<string, { x: number; y: number }>();

    const receiverStepId = (q: string, p: string): string | null => {
      const qp = byId.get(q);
      if (!qp) return null;
      for (const j of qp.jobs) for (const s of j.steps) if (s.waits.some((w) => w.targets.includes(p))) return s.id;
      return null;
    };

    for (const pid of lanePositions) {
      const posData = byId.get(pid)!;
      const pos = dir.getPosition(pid)!;
      const x = laneX.get(pid)!;
      const color = colorFor(pos.group, dir.groups);

      outNodes.push({
        id: `header-${pid}`,
        position: { x, y: 0 },
        data: {
          label: (
            <div style={{ textAlign: "center", width: "100%", padding: "0 6px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.15 }}>{truncate(pos.name, 34)}</div>
              <div style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.9, marginTop: 1 }}>{truncate(dir.positionMembers(pos.id).join(", "), 40)}</div>
            </div>
          ),
        },
        draggable: false,
        selectable: false,
        connectable: false,
        targetPosition: Position.Top,
        sourcePosition: Position.Bottom,
        style: {
          width: LANE_W,
          height: HEADER_H,
          background: color,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      });

      let y = HEADER_H + 16;
      for (const job of posData.jobs) {
        const jobHeight = JOB_HEAD_H + job.steps.length * STEP_H + JOB_PAD_BOTTOM;
        outNodes.push({
          id: `job-${job.id}`,
          position: { x, y },
          data: { label: truncate(job.name, 32) },
          draggable: false,
          selectable: false,
          connectable: false,
          zIndex: 0,
          style: {
            width: LANE_W,
            height: jobHeight,
            background: `${color}0D`,
            border: `1.5px solid ${color}44`,
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            color,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            padding: "6px 10px",
          },
        });

        job.steps.forEach((s, si) => {
          const hasApprover = s.approvers.length > 0 || s.approverExternal;
          const approverNames = [...s.approvers.map((id) => dir.positionName(id)), ...(s.approverExternal ? ["ลูกค้า/ภายนอก"] : [])].join(", ");
          const stepTop = y + JOB_HEAD_H + si * STEP_H;
          stepAbs.set(s.id, { x: x + 12, y: stepTop });
          outNodes.push({
            id: `step-${s.id}`,
            parentId: `job-${job.id}`,
            extent: "parent",
            position: { x: 12, y: JOB_HEAD_H + si * STEP_H },
            data: {
              label: (
                <div style={{ textAlign: "left", width: "100%" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25 }}>
                    {si + 1}. {truncate(s.action)}
                  </div>
                  {hasApprover && (
                    <div style={{ fontSize: 10.5, color: "#128A64", marginTop: 2 }}>🔒 อนุมัติ: {truncate(approverNames, 34)}</div>
                  )}
                </div>
              ),
            },
            draggable: false,
            selectable: false,
            connectable: false,
            targetPosition: Position.Top,
            sourcePosition: Position.Bottom,
            style: {
              width: LANE_W - 24,
              height: STEP_H - STEP_GAP,
              background: "#fff",
              border: hasApprover ? "2.5px solid #128A64" : "1px solid var(--line, #E3E8E4)",
              borderRadius: 8,
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              fontSize: 12,
            },
          });
        });

        y += jobHeight + JOB_GAP;
      }
    }

    const outEdges: RFEdge[] = [];
    const seen = new Set<string>();
    type Kind = "seq" | "matched" | "oneSided" | "branch" | "decision" | "fail";
    const strokeOf = (kind: Kind) =>
      kind === "seq"
        ? "#1C2A25"
        : kind === "matched"
        ? "#128A64"
        : kind === "branch"
        ? "#6C7A73"
        : kind === "decision"
        ? "#2E7CD6"
        : kind === "fail"
        ? "#D14343"
        : "#B65418";
    const pushEdge = (source: string, target: string, kind: Kind, label?: string, idSuffix = "") => {
      const id = `${kind}:${source}->${target}${idSuffix}`;
      if (seen.has(id)) return;
      seen.add(id);
      const stroke = strokeOf(kind);
      outEdges.push({
        id,
        source,
        target,
        label: label ? truncate(label, 22) : undefined,
        labelStyle: { fontSize: 10, fill: "#1C2A25", fontWeight: 600 },
        labelBgStyle: { fill: "#F4F6F4", fillOpacity: 0.9 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        style: {
          stroke,
          strokeWidth: kind === "seq" ? 1.4 : 2,
          strokeDasharray: kind === "oneSided" ? "6 4" : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
        zIndex: 5,
      });
    };

    let diamondSeq = 0;
    const addDiamond = (nearStepId: string): string | null => {
      const pos = stepAbs.get(nearStepId);
      if (!pos) return null;
      const id = `diamond-${nearStepId}-${diamondSeq++}`;
      outNodes.push({
        id,
        position: { x: pos.x + (LANE_W - 24) - 10, y: pos.y + (STEP_H - STEP_GAP) / 2 - 10 },
        data: { label: "" },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 6,
        style: {
          width: 20,
          height: 20,
          background: "#fff",
          border: "2px solid #B65418",
          transform: "rotate(45deg)",
          borderRadius: 3,
        },
      });
      return id;
    };

    const addDecisionDiamond = (nearStepId: string): string | null => {
      const pos = stepAbs.get(nearStepId);
      if (!pos) return null;
      const id = `decision-${nearStepId}-${diamondSeq++}`;
      outNodes.push({
        id,
        position: { x: pos.x - 26, y: pos.y + (STEP_H - STEP_GAP) / 2 - 10 },
        data: { label: "" },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 6,
        style: {
          width: 20,
          height: 20,
          background: "#fff",
          border: "2px solid #2E7CD6",
          transform: "rotate(45deg)",
          borderRadius: 3,
        },
      });
      return id;
    };

    for (const pid of lanePositions) {
      const posData = byId.get(pid)!;
      for (const job of posData.jobs) {
        // sequence within job
        for (let i = 0; i < job.steps.length - 1; i++) {
          pushEdge(`step-${job.steps[i].id}`, `step-${job.steps[i + 1].id}`, "seq");
        }
        for (const s of job.steps) {
          // sends (line items)
          s.sends.forEach((send, sendIdx) => {
            const targets = send.targets.filter((q) => laneSet.has(q));
            if (targets.length === 0) return;
            const statusFor = (q: string) => edgeMap.get(`${pid}|${q}`)?.status ?? "matched";
            const targetNode = (q: string) => {
              const rid = receiverStepId(q, pid);
              return rid ? `step-${rid}` : `header-${q}`;
            };
            if (send.conditional) {
              // branch point: step -> diamond -> each target (labeled with condition)
              const dId = addDiamond(s.id);
              const condLabel = send.condition || send.what;
              if (dId) {
                pushEdge(`step-${s.id}`, dId, "branch", send.what || undefined, `-c${sendIdx}`);
                targets.forEach((q) => {
                  const kind = statusFor(q) === "matched" ? "matched" : "oneSided";
                  pushEdge(dId, targetNode(q), kind, condLabel || undefined, `-c${sendIdx}-${q}`);
                });
              } else {
                targets.forEach((q) => {
                  const kind = statusFor(q) === "matched" ? "matched" : "oneSided";
                  pushEdge(`step-${s.id}`, targetNode(q), kind, condLabel || undefined, `-c${sendIdx}-${q}`);
                });
              }
            } else {
              // same item to (possibly) many positions: branch from one point, same label
              targets.forEach((q) => {
                const kind = statusFor(q) === "matched" ? "matched" : "oneSided";
                pushEdge(`step-${s.id}`, targetNode(q), kind, send.what || undefined, `-s${sendIdx}-${q}`);
              });
            }
          });
          // waits the other side never acknowledged (one-sided, but they DID submit)
          for (const w of s.waits) {
            for (const xid of w.targets) {
              if (!laneSet.has(xid)) continue;
              const pe = edgeMap.get(`${xid}|${pid}`);
              if (pe && pe.status === "mismatch" && !pe.senderAsserted) {
                pushEdge(`header-${xid}`, `step-${s.id}`, "oneSided", w.what || undefined, `-w-${xid}`);
              }
            }
          }
          // decision (pass/fail): diamond + red "ไม่ผ่าน" back-edge to the fail target
          if (s.decision) {
            const d = s.decision;
            let failNode: string | null = null;
            if (d.failStepId) failNode = `step-${d.failStepId}`;
            else if (d.failPosition && laneSet.has(d.failPosition)) failNode = `header-${d.failPosition}`;
            const dId = addDecisionDiamond(s.id);
            if (dId) {
              const deciderLabel = d.deciderExternal
                ? "ลูกค้า/ภายนอก"
                : d.decider && d.decider !== pid
                ? dir.positionName(d.decider)
                : "";
              pushEdge(`step-${s.id}`, dId, "decision", deciderLabel ? `ตัดสิน: ${deciderLabel}` : "ตัดสิน", `-dec`);
              if (failNode) {
                const failLabel = d.failReason ? `ไม่ผ่าน (${d.failReason})` : "ไม่ผ่าน";
                pushEdge(dId, failNode, "fail", failLabel, `-fail`);
              }
            }
          }
        }
      }
    }

    return { nodes: outNodes, rfEdges: outEdges, empty: false };
  }, [structure, edges, enabled, dir]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[12.5px] text-[var(--muted)] mr-1">กรองกลุ่ม:</span>
        {dir.groups.map((g) => (
          <button
            key={g}
            onClick={() => toggleGroup(g)}
            className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${enabled.has(g) ? "text-white" : "text-[var(--muted)] bg-transparent"}`}
            style={enabled.has(g) ? { background: colorFor(g, dir.groups), borderColor: colorFor(g, dir.groups) } : { borderColor: "var(--field-bd)" }}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#1C2A25]" /> ลำดับใน job</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#128A64]" /> ส่งงาน (ยืนยันสองฝั่ง)</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0 border-t-2 border-dashed border-[#B65418]" /> ส่งงาน (ฝั่งเดียว)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 border-2 border-[#B65418] rotate-45 rounded-sm" /> ทางแยกตามเงื่อนไข</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 border-2 border-[#2E7CD6] rotate-45 rounded-sm" /> จุดตัดสินใจ</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#D14343]" /> เส้นไม่ผ่าน (ย้อนกลับ)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 border-2 border-[#128A64] rounded-sm" /> 🔒 ต้องอนุมัติ</span>
      </div>

      <div className="h-[640px] bg-[var(--surface)] border border-[var(--line)] rounded-[16px] overflow-hidden">
        {empty ? (
          <div className="h-full flex items-center justify-center text-[13.5px] text-[var(--faint)] px-6 text-center">
            ยังไม่มีตำแหน่งไหนกรอก หรือกลุ่มที่เลือกยังไม่มีข้อมูล — ลองเปิดกลุ่มเพิ่ม
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={rfEdges} fitView minZoom={0.05} proOptions={{ hideAttribution: true }}>
            <Background color="#E3E8E4" gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
