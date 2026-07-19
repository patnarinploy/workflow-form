"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowGraph, groupColor } from "@/lib/flowGraph";
import { Workload } from "@/lib/reconcile";
import { forceLayout } from "@/lib/forceLayout";
import { useDirectory } from "@/components/DirectoryProvider";

const CANVAS = { width: 940, height: 560 };

type PosData = {
  label: string;
  size: number;
  color: string;
  faint: boolean;
  dim: boolean;
};

function PosNode({ data }: NodeProps) {
  const d = data as PosData;
  return (
    <div style={{ opacity: d.dim ? 0.25 : 1, transition: "opacity .15s" }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div
        className="flex items-center justify-center text-center"
        style={{
          width: d.size,
          height: d.size,
          borderRadius: "50%",
          background: d.faint ? "transparent" : d.color,
          border: d.faint ? `2px dashed ${d.color}` : `2px solid ${d.color}`,
          color: d.faint ? "var(--faint)" : "#fff",
          boxShadow: d.faint ? "none" : "0 2px 6px rgba(0,0,0,.12)",
        }}
      />
      <div className="text-[10.5px] font-semibold text-center mt-1 max-w-[110px] leading-tight" style={{ color: "var(--ink)" }}>
        {d.label}
      </div>
    </div>
  );
}

const nodeTypes = { pos: PosNode };

export function OverviewMap({
  graph,
  workload,
  onNavigate,
}: {
  graph: FlowGraph;
  workload: Workload[];
  onNavigate: (id: string) => void;
}) {
  const { dir } = useDirectory();
  const [seed, setSeed] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const maxSteps = useMemo(() => Math.max(1, ...graph.nodes.map((n) => n.stepCount)), [graph]);

  // adjacency for hover highlighting
  const adj = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b);
      (m.get(b) ?? m.set(b, new Set()).get(b)!).add(a);
    };
    graph.handoffs.forEach((h) => add(h.from, h.to));
    graph.fails.forEach((f) => add(f.from, f.to));
    return m;
  }, [graph]);

  const layout = useMemo(() => {
    const ids = graph.nodes.map((n) => n.id);
    const groupOf = (id: string) => graph.nodes.find((n) => n.id === id)?.group ?? "";
    const links = [
      ...graph.handoffs.map((h) => ({ source: h.from, target: h.to, weight: h.count })),
      ...graph.fails.map((f) => ({ source: f.from, target: f.to })),
    ];
    return forceLayout(ids, links, { ...CANVAS, groupOf, seed, iterations: 340 });
  }, [graph, seed]);

  // build nodes
  useEffect(() => {
    const ns: Node[] = graph.nodes.map((n) => {
      const size = n.hasData ? 26 + Math.round((n.stepCount / maxSteps) * 40) : 22;
      const dim = hovered != null && hovered !== n.id && !(adj.get(hovered)?.has(n.id));
      return {
        id: n.id,
        type: "pos",
        position: layout[n.id] ?? { x: 0, y: 0 },
        data: { label: n.name, size, color: groupColor(n.group, dir.groups), faint: !n.hasData, dim } as PosData,
      };
    });
    setNodes(ns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, layout, maxSteps, hovered, adj, dir]);

  // build edges
  useEffect(() => {
    const maxCount = Math.max(1, ...graph.handoffs.map((h) => h.count));
    const relevant = (a: string, b: string) => hovered == null || hovered === a || hovered === b;
    const hs: Edge[] = graph.handoffs.map((h, i) => {
      const confirmed = h.status === "matched";
      const color = confirmed ? "#128A64" : "#B65418";
      return {
        id: `h-${i}`,
        source: h.from,
        target: h.to,
        label: String(h.count),
        labelStyle: { fontSize: 10, fill: "var(--muted)" },
        labelBgStyle: { fill: "var(--surface)" },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: {
          stroke: color,
          strokeWidth: 1 + (h.count / maxCount) * 4,
          strokeDasharray: confirmed ? undefined : "6 4",
          opacity: relevant(h.from, h.to) ? 0.9 : 0.12,
        },
        data: { whats: h.whats },
      };
    });
    const fs: Edge[] = graph.fails.map((f, i) => ({
      id: `f-${i}`,
      source: f.from,
      target: f.to,
      type: "default",
      label: "ตีกลับ",
      labelStyle: { fontSize: 10, fill: "#C0392B" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#C0392B" },
      style: { stroke: "#C0392B", strokeWidth: 1.5, opacity: relevant(f.from, f.to) ? 0.85 : 0.12 },
    }));
    setEdges([...hs, ...fs]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, hovered]);

  const onNodeClick = useCallback((_: unknown, node: Node) => onNavigate(node.id), [onNavigate]);

  // side panel numbers
  const byLoad = [...workload].sort((a, b) => b.inbound - a.inbound);
  const bottleneck = byLoad.filter((w) => w.inbound > 0).slice(0, 3);
  const byApprover = [...workload].filter((w) => w.approverCount > 0).sort((a, b) => b.approverCount - a.approverCount).slice(0, 3);
  const unconfirmed = graph.handoffs.filter((h) => h.status !== "matched").length;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] overflow-hidden" style={{ height: 560 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--line)] flex-wrap">
          {dir.groups.map((g) => (
            <span key={g} className="inline-flex items-center gap-1 text-[11.5px] text-[var(--muted)]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: groupColor(g, dir.groups) }} />
              {g}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--faint)]">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[var(--faint)]" /> ยังไม่ได้กรอก
          </span>
          <button onClick={() => setSeed((s) => s + 1)} className="ml-auto text-[12px] font-semibold text-[var(--accent)] border border-[var(--accent-line)] rounded-full px-3 py-1">
            ↻ จัดใหม่
          </button>
        </div>
        <div style={{ height: 512 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={(_, n) => setHovered(n.id)}
            onNodeMouseLeave={() => setHovered(null)}
            fitView
            minZoom={0.3}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#E3E8E4" gap={22} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Panel title="คอขวด (งานไหลเข้ามาก)">
          {bottleneck.length === 0 ? (
            <Empty />
          ) : (
            bottleneck.map((w, i) => (
              <Line key={w.positionId} rank={i + 1} name={dir.positionName(w.positionId)} value={`${w.inbound} เส้นเข้า`} onClick={() => onNavigate(w.positionId)} />
            ))
          )}
        </Panel>
        <Panel title="ถูกอ้างเป็นผู้อนุมัติบ่อย">
          {byApprover.length === 0 ? (
            <Empty />
          ) : (
            byApprover.map((w, i) => (
              <Line key={w.positionId} rank={i + 1} name={dir.positionName(w.positionId)} value={`${w.approverCount} ครั้ง`} onClick={() => onNavigate(w.positionId)} />
            ))
          )}
        </Panel>
        <Panel title="เส้นที่ยังไม่ยืนยันสองฝั่ง">
          <div className="text-[24px] font-disp font-bold text-[#B65418]">{unconfirmed}</div>
          <div className="text-[11.5px] text-[var(--faint)]">เส้นประสีส้ม — ดูรายละเอียดที่แท็บ “จุดที่ไม่ตรงกัน”</div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[14px] p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)] mb-2">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
function Line({ rank, name, value, onClick }: { rank: number; name: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-left hover:bg-[var(--bg)] rounded-md px-1 py-0.5">
      <span className="text-[11px] font-semibold text-[var(--faint)] w-4">{rank}</span>
      <span className="text-[12.5px] font-medium flex-1 min-w-0 truncate">{name}</span>
      <span className="text-[11.5px] text-[var(--muted)]">{value}</span>
    </button>
  );
}
function Empty() {
  return <div className="text-[12px] text-[var(--faint)]">— ยังไม่มีข้อมูล</div>;
}
