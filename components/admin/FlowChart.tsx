"use client";

import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType, Position, type Node, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowPerson, PairEdge } from "@/lib/reconcile";
import { getStaff, GROUP_ORDER, GROUP_LABEL, StaffGroup, staffNick, STAFF } from "@/lib/staff";

const LANE_W = 240;
const LANE_GAP = 44;
const HEADER_H = 44;
const JOB_HEAD_H = 30;
const STEP_H = 58;
const STEP_GAP = 8;
const JOB_PAD_BOTTOM = 12;
const JOB_GAP = 18;

const GROUP_COLOR: Record<StaffGroup, string> = {
  Executive: "#7C5CBF",
  Commercial: "#128A64",
  Production: "#2E7CD6",
  Operation: "#B6841C",
};

function truncate(s: string, n = 46) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function FlowChart({ structure, edges }: { structure: FlowPerson[]; edges: PairEdge[] }) {
  const [enabled, setEnabled] = useState<Set<StaffGroup>>(new Set(GROUP_ORDER));

  const toggleGroup = (g: StaffGroup) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const { nodes, rfEdges, empty } = useMemo(() => {
    const groupOf = (id: string) => getStaff(id)?.group;

    const byId = new Map(structure.map((p) => [p.personId, p]));
    const lanePeople = STAFF.filter((s) => byId.has(s.id) && (byId.get(s.id)!.jobs.length > 0) && enabled.has(s.group)).map((s) => s.id);
    const laneSet = new Set(lanePeople);

    if (lanePeople.length === 0) {
      return { nodes: [] as Node[], rfEdges: [] as RFEdge[], empty: true };
    }

    const edgeMap = new Map<string, PairEdge>();
    for (const e of edges) edgeMap.set(`${e.from}|${e.to}`, e);

    const laneX = new Map<string, number>();
    lanePeople.forEach((pid, i) => laneX.set(pid, i * (LANE_W + LANE_GAP)));

    const outNodes: Node[] = [];
    const receiverStepId = (q: string, p: string): string | null => {
      const qp = byId.get(q);
      if (!qp) return null;
      for (const j of qp.jobs) for (const s of j.steps) if (s.waitsFor.includes(p)) return s.id;
      return null;
    };

    for (const pid of lanePeople) {
      const person = byId.get(pid)!;
      const x = laneX.get(pid)!;
      const grp = groupOf(pid)!;
      const color = GROUP_COLOR[grp];

      outNodes.push({
        id: `header-${pid}`,
        position: { x, y: 0 },
        data: { label: staffNick(pid) },
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
          fontSize: 14,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      });

      let y = HEADER_H + 16;
      for (const job of person.jobs) {
        const jobHeight = JOB_HEAD_H + job.steps.length * STEP_H + JOB_PAD_BOTTOM;
        outNodes.push({
          id: `job-${job.id}`,
          position: { x, y },
          data: { label: truncate(job.name, 30) },
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
          const approverNames = [...s.approvers.map(staffNick), ...(s.approverExternal ? ["ลูกค้า/ภายนอก"] : [])].join(", ");
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
                    <div style={{ fontSize: 10.5, color: "#128A64", marginTop: 2 }}>🔒 อนุมัติ: {approverNames}</div>
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
    const pushEdge = (source: string, target: string, kind: "seq" | "matched" | "oneSided") => {
      const id = `${kind}:${source}->${target}`;
      if (seen.has(id)) return;
      seen.add(id);
      const stroke = kind === "seq" ? "#1C2A25" : kind === "matched" ? "#128A64" : "#B65418";
      outEdges.push({
        id,
        source,
        target,
        style: { stroke, strokeWidth: kind === "seq" ? 1.4 : 2, strokeDasharray: kind === "oneSided" ? "6 4" : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 14, height: 14 },
        zIndex: 5,
      });
    };

    for (const pid of lanePeople) {
      const person = byId.get(pid)!;
      for (const job of person.jobs) {
        for (let i = 0; i < job.steps.length - 1; i++) {
          pushEdge(`step-${job.steps[i].id}`, `step-${job.steps[i + 1].id}`, "seq");
        }
        for (const s of job.steps) {
          for (const q of s.sendsTo) {
            if (!laneSet.has(q)) continue;
            const pe = edgeMap.get(`${pid}|${q}`);
            const status = pe?.status ?? "matched";
            const rid = receiverStepId(q, pid);
            const target = rid ? `step-${rid}` : `header-${q}`;
            pushEdge(`step-${s.id}`, target, status === "matched" ? "matched" : "oneSided");
          }
          for (const xid of s.waitsFor) {
            if (!laneSet.has(xid)) continue;
            const pe = edgeMap.get(`${xid}|${pid}`);
            if (pe && pe.status === "mismatch" && !pe.senderAsserted) {
              pushEdge(`header-${xid}`, `step-${s.id}`, "oneSided");
            }
          }
        }
      }
    }

    return { nodes: outNodes, rfEdges: outEdges, empty: false };
  }, [structure, edges, enabled]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[12.5px] text-[var(--muted)] mr-1">กรองกลุ่ม:</span>
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            onClick={() => toggleGroup(g)}
            className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${enabled.has(g) ? "text-white" : "text-[var(--muted)] bg-transparent"}`}
            style={enabled.has(g) ? { background: GROUP_COLOR[g], borderColor: GROUP_COLOR[g] } : { borderColor: "var(--field-bd)" }}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#1C2A25]" /> ลำดับใน job</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#128A64]" /> ส่งงาน (ยืนยันสองฝั่ง)</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0 border-t-2 border-dashed border-[#B65418]" /> ส่งงาน (ฝั่งเดียว)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 border-2 border-[#128A64] rounded-sm" /> 🔒 ต้องอนุมัติ</span>
      </div>

      <div className="h-[640px] bg-[var(--surface)] border border-[var(--line)] rounded-[16px] overflow-hidden">
        {empty ? (
          <div className="h-full flex items-center justify-center text-[13.5px] text-[var(--faint)] px-6 text-center">
            ยังไม่มีใครกรอก หรือกลุ่มที่เลือกยังไม่มีข้อมูล — ลองเปิดกลุ่มเพิ่ม
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
