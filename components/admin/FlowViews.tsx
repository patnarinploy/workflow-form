"use client";

import { useEffect, useMemo, useState } from "react";
import { FlowPosition, PairEdge, Workload } from "@/lib/reconcile";
import { buildFlowGraph } from "@/lib/flowGraph";
import { useDirectory } from "@/components/DirectoryProvider";
import { OverviewMap } from "./OverviewMap";
import { FocusView } from "./FocusView";

// The old single swimlane (24 lanes at once) was unreadable. This replaces it
// with two linked modes over ONE graph model: an Overview map (positions as
// nodes) and a per-position Focus view (handoffs become edge chips, so no lines
// cross the screen). Mode + selected position live in the URL for sharing.

type View = "overview" | "focus";

function readUrl(): { view: View; pos: string } {
  if (typeof window === "undefined") return { view: "overview", pos: "" };
  const p = new URLSearchParams(window.location.search);
  const view = p.get("view") === "focus" ? "focus" : "overview";
  return { view, pos: p.get("pos") || "" };
}

export function FlowViews({
  structure,
  edges,
  workload,
}: {
  structure: FlowPosition[];
  edges: PairEdge[];
  workload: Workload[];
}) {
  const { dir } = useDirectory();
  const graph = useMemo(() => buildFlowGraph(structure, edges, dir), [structure, edges, dir]);

  const [view, setView] = useState<View>("overview");
  const [pos, setPos] = useState<string>("");

  // hydrate from URL once
  useEffect(() => {
    const u = readUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(u.view);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(u.pos && dir.getPosition(u.pos) ? u.pos : "");
  }, [dir]);

  function sync(nextView: View, nextPos: string) {
    setView(nextView);
    setPos(nextPos);
    const p = new URLSearchParams(window.location.search);
    p.set("view", nextView);
    if (nextView === "focus" && nextPos) p.set("pos", nextPos);
    else p.delete("pos");
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }

  const defaultPos = () => pos || graph.nodes.find((n) => n.hasData)?.id || dir.activePositions[0]?.id || "";

  const goFocus = (id: string) => sync("focus", id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-full border border-[var(--line)] overflow-hidden">
          <button
            onClick={() => sync("overview", pos)}
            className={`text-[12.5px] font-semibold px-4 py-1.5 ${view === "overview" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
          >
            ภาพรวม
          </button>
          <button
            onClick={() => sync("focus", defaultPos())}
            className={`text-[12.5px] font-semibold px-4 py-1.5 ${view === "focus" ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
          >
            รายตำแหน่ง
          </button>
        </div>

        {view === "focus" && (
          <select
            value={pos || defaultPos()}
            onChange={(e) => sync("focus", e.target.value)}
            className="text-[13px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2 outline-none focus:border-[var(--accent)]"
          >
            {dir.groups.map((g) => (
              <optgroup key={g} label={g}>
                {dir.positionsInGroup(g).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}

        <span className="text-[12px] text-[var(--faint)] ml-auto">
          {view === "overview" ? "คลิกจุดเพื่อเจาะดูตำแหน่งนั้น" : "คลิกชิปเพื่อกระโดดไปตำแหน่งที่เชื่อมกัน"}
        </span>
      </div>

      {view === "overview" ? (
        <OverviewMap graph={graph} workload={workload} onNavigate={goFocus} />
      ) : (
        <FocusView structure={structure} edges={edges} posId={defaultPos()} onNavigate={(id) => goFocus(id)} />
      )}
    </div>
  );
}
