"use client";

import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType, type Node, type Edge as RFEdge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Edge } from "@/lib/reconcile";
import { getStaff, GROUP_ORDER, GROUP_LABEL, StaffGroup, staffNick } from "@/lib/staff";

const NODE_W = 150;
const NODE_H = 44;

const GROUP_COLOR: Record<StaffGroup, string> = {
  Executive: "#7C5CBF",
  Commercial: "#128A64",
  Production: "#2E7CD6",
  Operation: "#B6841C",
};

export function FlowChart({ edges }: { edges: Edge[] }) {
  const [enabled, setEnabled] = useState<Set<StaffGroup>>(new Set(GROUP_ORDER));
  const [showOneSided, setShowOneSided] = useState(true);

  const toggleGroup = (g: StaffGroup) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const { nodes, rfEdges, empty } = useMemo(() => {
    const groupOf = (id: string) => getStaff(id)?.group;

    const shown = edges.filter((e) => {
      if (e.status !== "matched" && !showOneSided) return false;
      const gf = groupOf(e.from);
      const gt = groupOf(e.to);
      return !!gf && !!gt && enabled.has(gf) && enabled.has(gt);
    });

    const nodeIds = new Set<string>();
    for (const e of shown) {
      nodeIds.add(e.from);
      nodeIds.add(e.to);
    }
    if (nodeIds.size === 0) {
      return { nodes: [] as Node[], rfEdges: [] as RFEdge[], empty: true };
    }

    // dagre for horizontal ranking (left-to-right flow)
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 20, ranksep: 90, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const id of nodeIds) g.setNode(id, { width: NODE_W, height: NODE_H });
    for (const e of shown) g.setEdge(e.from, e.to);
    dagre.layout(g);

    const dagreX = new Map<string, number>();
    let minX = Infinity;
    let maxX = -Infinity;
    for (const id of nodeIds) {
      const x = g.node(id).x;
      dagreX.set(id, x);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }

    // Assign lanes by group; within lane spread by x with simple collision avoidance.
    const lanes = GROUP_ORDER.filter((grp) => [...nodeIds].some((id) => groupOf(id) === grp));
    const laneNodes = new Map<StaffGroup, string[]>();
    for (const grp of lanes) {
      laneNodes.set(
        grp,
        [...nodeIds].filter((id) => groupOf(id) === grp).sort((a, b) => (dagreX.get(a)! - dagreX.get(b)!))
      );
    }

    const subRowOf = new Map<string, number>();
    const laneMaxSub = new Map<StaffGroup, number>();
    for (const grp of lanes) {
      let lastRight = -Infinity;
      let sub = 0;
      let maxSub = 0;
      for (const id of laneNodes.get(grp)!) {
        const x = dagreX.get(id)!;
        if (x - lastRight < NODE_W + 24) sub += 1;
        else sub = 0;
        subRowOf.set(id, sub);
        maxSub = Math.max(maxSub, sub);
        lastRight = x;
      }
      laneMaxSub.set(grp, maxSub);
    }

    const rowH = NODE_H + 14;
    const laneLabelH = 26;
    const laneTop = new Map<StaffGroup, number>();
    let cursor = 0;
    for (const grp of lanes) {
      laneTop.set(grp, cursor);
      const rows = (laneMaxSub.get(grp) ?? 0) + 1;
      cursor += laneLabelH + rows * rowH + 24;
    }

    const bandLeft = minX - NODE_W / 2 - 30;
    const bandWidth = maxX - minX + NODE_W + 60;

    const outNodes: Node[] = [];

    // lane bands (behind)
    for (const grp of lanes) {
      const rows = (laneMaxSub.get(grp) ?? 0) + 1;
      outNodes.push({
        id: `lane-${grp}`,
        position: { x: bandLeft, y: laneTop.get(grp)! },
        data: { label: GROUP_LABEL[grp] },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 0,
        style: {
          width: bandWidth,
          height: laneLabelH + rows * rowH + 8,
          background: `${GROUP_COLOR[grp]}0F`,
          border: `1px solid ${GROUP_COLOR[grp]}33`,
          borderRadius: 12,
          color: GROUP_COLOR[grp],
          fontSize: 11,
          fontWeight: 700,
          textAlign: "left",
          padding: "6px 10px",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          display: "flex",
        },
      });
    }

    // person nodes
    for (const id of nodeIds) {
      const grp = groupOf(id)!;
      const x = dagreX.get(id)!;
      const y = laneTop.get(grp)! + laneLabelH + subRowOf.get(id)! * rowH + 6;
      outNodes.push({
        id,
        position: { x, y },
        data: { label: staffNick(id) },
        draggable: true,
        selectable: false,
        connectable: false,
        zIndex: 1,
        style: {
          width: NODE_W,
          height: NODE_H,
          background: "#fff",
          border: `1.5px solid ${GROUP_COLOR[grp]}`,
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: "#1C2A25",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      });
    }

    const outEdges: RFEdge[] = shown.map((e) => {
      const oneSided = e.status !== "matched";
      const color = oneSided ? "#B65418" : "#128A64";
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        style: { stroke: color, strokeWidth: 1.8, strokeDasharray: oneSided ? "6 4" : undefined },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        zIndex: 5,
      };
    });

    return { nodes: outNodes, rfEdges: outEdges, empty: false };
  }, [edges, enabled, showOneSided]);

  const matchedCount = edges.filter((e) => e.status === "matched").length;
  const oneSidedCount = edges.length - matchedCount;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[12.5px] text-[var(--muted)] mr-1">กรองกลุ่ม:</span>
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            onClick={() => toggleGroup(g)}
            className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${
              enabled.has(g) ? "text-white" : "text-[var(--muted)] bg-transparent"
            }`}
            style={enabled.has(g) ? { background: GROUP_COLOR[g], borderColor: GROUP_COLOR[g] } : { borderColor: "var(--field-bd)" }}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] cursor-pointer">
          <input type="checkbox" checked={showOneSided} onChange={(e) => setShowOneSided(e.target.checked)} />
          แสดงเส้นข้างเดียว
        </label>
      </div>

      <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-[#128A64]" /> จับคู่ได้ ({matchedCount})</span>
        <span className="flex items-center gap-1.5"><span className="w-6 h-0 border-t-2 border-dashed border-[#B65418]" /> เส้นข้างเดียว ({oneSidedCount})</span>
      </div>

      <div className="h-[560px] bg-[var(--surface)] border border-[var(--line)] rounded-[16px] overflow-hidden">
        {empty ? (
          <div className="h-full flex items-center justify-center text-[13.5px] text-[var(--faint)] px-6 text-center">
            ยังไม่มีเส้นที่จะแสดง (ต้องมีคนกรอกที่ส่ง/รับงานกันก่อน หรือลองเปิดกลุ่มเพิ่ม)
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={rfEdges} fitView minZoom={0.1} proOptions={{ hideAttribution: true }}>
            <Background color="#E3E8E4" gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
