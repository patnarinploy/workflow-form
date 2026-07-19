"use client";

import { useEffect, useMemo, useState } from "react";
import { FlowPosition, PairEdge, Workload } from "@/lib/reconcile";
import { buildFlowGraph } from "@/lib/flowGraph";
import { listJobs } from "@/lib/swimlane";
import { useDirectory } from "@/components/DirectoryProvider";
import { SwimlaneView } from "@/components/diagram/SwimlaneView";
import { OverviewMap } from "@/components/diagram/legacy/OverviewMap";
import { FocusView } from "@/components/diagram/legacy/FocusView";

// Three switchable modes over one dataset. A (report swimlane, per job) is the
// default; B (focus, per position) and C (overview map) are kept as options in
// components/diagram/legacy so we can fall back without a redeploy. Mode +
// per-mode selection live in the URL so links are shareable.
// Revert everything: `git checkout claude/new-session-gg5p9o` (tag diagram-bc-stable).

type View = "a" | "b" | "c";
type HMode = "collapse" | "hide";

function readUrl() {
  if (typeof window === "undefined") return { view: "a" as View, job: "", pos: "", hide: [] as string[], hmode: "collapse" as HMode };
  const p = new URLSearchParams(window.location.search);
  const v = p.get("view");
  const view: View = v === "b" || v === "c" ? v : "a";
  return {
    view,
    job: p.get("job") || "",
    pos: p.get("pos") || "",
    hide: (p.get("hide") || "").split(",").filter(Boolean),
    hmode: p.get("hmode") === "hide" ? ("hide" as HMode) : ("collapse" as HMode),
  };
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
  const jobs = useMemo(() => listJobs(structure, dir), [structure, dir]);

  const [view, setView] = useState<View>("a");
  const [job, setJob] = useState("");
  const [pos, setPos] = useState("");
  const [hide, setHide] = useState<string[]>([]);
  const [hmode, setHmode] = useState<HMode>("collapse");

  useEffect(() => {
    const u = readUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(u.view);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJob(u.job && jobs.some((j) => j.jobId === u.job) ? u.job : jobs[0]?.jobId || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPos(u.pos && dir.getPosition(u.pos) ? u.pos : "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHide(u.hide);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHmode(u.hmode);
  }, [jobs, dir]);

  function writeUrl(next: Partial<{ view: View; job: string; pos: string; hide: string[]; hmode: HMode }>) {
    const cur = { view, job, pos, hide, hmode, ...next };
    const p = new URLSearchParams(window.location.search);
    p.set("view", cur.view);
    if (cur.view === "a") {
      cur.job ? p.set("job", cur.job) : p.delete("job");
      cur.hide.length ? p.set("hide", cur.hide.join(",")) : p.delete("hide");
      cur.hmode === "hide" ? p.set("hmode", "hide") : p.delete("hmode");
      p.delete("pos");
    } else if (cur.view === "b") {
      cur.pos ? p.set("pos", cur.pos) : p.delete("pos");
      p.delete("job");
      p.delete("hide");
      p.delete("hmode");
    } else {
      p.delete("pos");
      p.delete("job");
      p.delete("hide");
      p.delete("hmode");
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
  }

  const jobDefault = job || jobs[0]?.jobId || "";
  const posDefault = pos || graph.nodes.find((n) => n.hasData)?.id || dir.activePositions[0]?.id || "";

  const gotoView = (v: View) => {
    setView(v);
    writeUrl({ view: v });
  };
  const setJobSync = (id: string) => {
    setJob(id);
    setHide([]);
    writeUrl({ view: "a", job: id, hide: [] });
  };
  const setHideSync = (ids: string[]) => {
    setHide(ids);
    writeUrl({ hide: ids });
  };
  const setHmodeSync = (m: HMode) => {
    setHmode(m);
    writeUrl({ hmode: m });
  };
  const focusPos = (id: string) => {
    setPos(id);
    setView("b");
    writeUrl({ view: "b", pos: id });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex rounded-full border border-[var(--line)] overflow-hidden">
          {([
            ["a", "รายงาน"],
            ["b", "รายตำแหน่ง"],
            ["c", "ภาพรวม"],
          ] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => gotoView(v)}
              className={`text-[12.5px] font-semibold px-4 py-1.5 ${view === v ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "a" && jobs.length > 0 && (
          <select
            value={jobDefault}
            onChange={(e) => setJobSync(e.target.value)}
            className="text-[13px] bg-[var(--field)] border border-[var(--field-bd)] rounded-[10px] px-3 py-2 outline-none focus:border-[var(--accent)] max-w-[360px]"
          >
            {jobs.map((j) => (
              <option key={j.jobId} value={j.jobId}>{j.label}</option>
            ))}
          </select>
        )}
        {view === "b" && (
          <select
            value={posDefault}
            onChange={(e) => focusPos(e.target.value)}
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
          {view === "a" ? "ทีละ 1 งาน — คลิกกล่องปลายทางเพื่อข้ามไปงานตำแหน่งนั้น" : view === "c" ? "คลิกจุดเพื่อเจาะดูตำแหน่งนั้น" : "คลิกชิปเพื่อกระโดดไปตำแหน่งที่เชื่อมกัน"}
        </span>
      </div>

      {view === "a" ? (
        jobs.length === 0 ? (
          <div className="text-[13.5px] text-[var(--faint)] py-10 text-center border border-dashed border-[var(--line)] rounded-[14px]">
            ยังไม่มีใครกรอกงาน — เมื่อมีตำแหน่งกรอกผังงานแล้ว ผังรายงานจะขึ้นที่นี่
          </div>
        ) : (
          <SwimlaneView
            structure={structure}
            edges={edges}
            jobId={jobDefault}
            hidden={hide}
            hiddenMode={hmode}
            onHiddenChange={setHideSync}
            onModeChange={setHmodeSync}
            onJump={setJobSync}
          />
        )
      ) : view === "b" ? (
        <FocusView structure={structure} edges={edges} posId={posDefault} onNavigate={(id) => focusPos(id)} />
      ) : (
        <OverviewMap graph={graph} workload={workload} onNavigate={focusPos} />
      )}
    </div>
  );
}
