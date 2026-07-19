"use client";

import { useState } from "react";
import { Reconciliation, PairEdge } from "@/lib/reconcile";
import { useDirectory } from "@/components/DirectoryProvider";
import { FlowViews } from "./FlowViews";
import { AdminNav } from "./AdminNav";
import { LogoutButton } from "@/app/admin/LogoutButton";

export type ProjectProgress = { filled: number; total: number; missingStaff: string[] };

type Tab = "progress" | "flow" | "mismatch" | "workload";

const TABS: { key: Tab; label: string }[] = [
  { key: "progress", label: "ความคืบหน้า" },
  { key: "flow", label: "ผัง" },
  { key: "mismatch", label: "จุดที่ไม่ตรงกัน" },
  { key: "workload", label: "ภาระงาน" },
];

export function AdminDashboard({
  result,
  blockers,
  projectProgress,
}: {
  result: Reconciliation;
  blockers: { positionId: string; text: string }[];
  projectProgress: ProjectProgress;
}) {
  const { dir } = useDirectory();
  const [tab, setTab] = useState<Tab>("progress");
  const mismatchCount = result.oneSided.filter((e) => e.status === "mismatch").length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-disp font-bold text-2xl">Admin · Workflow</h1>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">
            True CJ Creations — ส่งแล้ว {result.submittedIds.length}/{dir.activePositions.length} ตำแหน่ง
          </p>
        </div>
        <LogoutButton />
      </div>

      <AdminNav />

      <div className="flex gap-2 mb-3">
        <a href="/api/admin/export/json" className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[8px] bg-[var(--accent)] text-white">
          ดาวน์โหลด JSON
        </a>
        <a href="/api/admin/export/csv" className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[8px] border border-[var(--accent)] text-[var(--accent)]">
          ดาวน์โหลด CSV
        </a>
      </div>

      <div className="flex gap-1 border-b border-[var(--line)] mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {t.label}
            {t.key === "mismatch" && mismatchCount > 0 && (
              <span className="ml-1.5 text-[11px] bg-[#B65418] text-white rounded-full px-1.5 py-0.5">{mismatchCount}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "progress" && <ProgressTab result={result} blockers={blockers} projectProgress={projectProgress} />}
      {tab === "flow" && <FlowViews structure={result.structure} edges={result.edges} workload={result.workload} />}
      {tab === "mismatch" && <MismatchTab result={result} />}
      {tab === "workload" && <WorkloadTab result={result} />}
    </div>
  );
}

/* ---------------- Progress ---------------- */

function ProgressTab({
  result,
  blockers,
  projectProgress,
}: {
  result: Reconciliation;
  blockers: { positionId: string; text: string }[];
  projectProgress: ProjectProgress;
}) {
  const { dir } = useDirectory();
  const pct = Math.round((result.submittedIds.length / dir.activePositions.length) * 100);
  const submitted = new Set(result.submittedIds);
  const pp = projectProgress;
  const ppPct = pp.total > 0 ? Math.round((pp.filled / pp.total) * 100) : 0;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 mb-5">
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5">
          <div className="text-[12px] font-semibold text-[var(--faint)] uppercase tracking-wide mb-1.5">ผังงาน · ตำแหน่ง</div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-semibold">กรอกแล้ว {result.submittedIds.length} จาก {dir.activePositions.length} ตำแหน่ง</span>
            <span className="font-disp font-bold text-xl text-[var(--accent)]">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--line)] overflow-hidden">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5">
          <div className="text-[12px] font-semibold text-[var(--faint)] uppercase tracking-wide mb-1.5">โปรเจกต์ · คน</div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-semibold">กรอกแล้ว {pp.filled} จาก {pp.total} คน</span>
            <span className="font-disp font-bold text-xl text-[#2E7CD6]">{ppPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--line)] overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${ppPct}%`, background: "#2E7CD6" }} />
          </div>
          {pp.missingStaff.length > 0 && (
            <details className="mt-3">
              <summary className="text-[12.5px] text-[var(--muted)] cursor-pointer">ยังไม่ได้กรอกโปรเจกต์ ({pp.missingStaff.length})</summary>
              <div className="text-[12.5px] text-[var(--faint)] mt-1.5 leading-relaxed">{pp.missingStaff.map(dir.staffLabel).join(" · ")}</div>
            </details>
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title={`ยังไม่ได้กรอก (${result.missingIds.length})`}>
          {result.missingIds.length === 0 ? (
            <p className="text-[13px] text-[var(--accent)]">ครบทุกตำแหน่งแล้ว 🎉</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {result.missingIds.map((id) => (
                <li key={id} className="text-[13.5px]">
                  <span className="font-medium">{dir.positionName(id)}</span>
                  <span className="text-[var(--faint)] text-[12px]"> — {dir.positionMembers(id).join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`กรอกแล้ว (${result.submittedIds.length})`}>
          {result.submittedIds.length === 0 ? (
            <p className="text-[13px] text-[var(--faint)]">ยังไม่มีตำแหน่งไหนกรอก</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {dir.activePositions.filter((p) => submitted.has(p.id)).map((p) => (
                <li key={p.id} className="text-[13.5px]">
                  <span className="font-medium">{p.name}</span>
                  {result.filledBy[p.id] && <span className="text-[var(--faint)] text-[12px]"> — โดย {result.filledBy[p.id]}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {blockers.length > 0 && (
        <div className="mt-4">
          <Panel title={`สิ่งที่ติดขัด (${blockers.length})`}>
            <ul className="flex flex-col gap-2.5">
              {blockers.map((b) => (
                <li key={b.positionId} className="text-[13.5px]">
                  <span className="font-semibold">{dir.positionName(b.positionId)}:</span>{" "}
                  <span className="text-[var(--muted)]">{b.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ---------------- Mismatch ---------------- */

function MismatchTab({ result }: { result: Reconciliation }) {
  const mismatches = result.oneSided.filter((e) => e.status === "mismatch");
  const pending = result.oneSided.filter((e) => e.status === "pending");
  return (
    <div className="flex flex-col gap-5">
      <Section title={`เข้าใจไม่ตรงกัน (${mismatches.length})`} desc="สองตำแหน่งกรอกแล้วทั้งคู่ แต่พูดถึงการส่งงานไม่ตรง — ควรคุยให้ตรง" color="#B65418">
        {mismatches.length === 0 ? <Empty text="ไม่มีเส้นที่ขัดกัน" /> : mismatches.map((e, i) => <EdgeItem key={i} edge={e} />)}
      </Section>
      <Section title={`รออีกตำแหน่งกรอก (${pending.length})`} desc="ตำแหน่งหนึ่งระบุการส่งงานแล้ว แต่อีกตำแหน่งยังไม่ได้กรอก (ยังไม่ใช่ความผิด)" color="#6C7A73">
        {pending.length === 0 ? <Empty text="ไม่มีเส้นที่ค้างรอ" /> : pending.map((e, i) => <EdgeItem key={i} edge={e} />)}
      </Section>
      <Section title={`จับคู่ได้แล้ว (${result.matched.length})`} desc="ทั้งผู้ส่งและผู้รับยืนยันตรงกัน" color="#128A64">
        {result.matched.length === 0 ? <Empty text="ยังไม่มีเส้นที่จับคู่ได้" /> : result.matched.map((e, i) => <EdgeItem key={i} edge={e} />)}
      </Section>
    </div>
  );
}

function EdgeItem({ edge }: { edge: PairEdge }) {
  const { dir } = useDirectory();
  const [open, setOpen] = useState(false);
  const color = edge.status === "matched" ? "#128A64" : edge.status === "mismatch" ? "#B65418" : "#93A099";
  return (
    <div className="border border-[var(--line)] rounded-[10px] overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-[var(--bg)]">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[13px] font-medium">{dir.positionName(edge.from)}</span>
        <span className="text-[var(--faint)]">→</span>
        <span className="text-[13px] font-medium">{dir.positionName(edge.to)}</span>
        <span className="ml-auto text-[11px] text-[var(--faint)] shrink-0">
          {edge.senderAsserted ? "ผู้ส่ง✓" : "ผู้ส่ง✗"} · {edge.receiverAsserted ? "ผู้รับ✓" : "ผู้รับ✗"}
        </span>
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-1 text-[12.5px] bg-[var(--bg)]/40 flex flex-col gap-2">
          <div>
            <div className="text-[var(--faint)] mb-0.5">{dir.positionName(edge.from)} (ผู้ส่ง) บอกว่า:</div>
            {edge.senderContext.length ? (
              <ul className="list-disc pl-5 text-[var(--ink)]">{edge.senderContext.map((t, i) => <li key={i}>{t}</li>)}</ul>
            ) : (
              <span className="text-[var(--danger)]">ไม่ได้ระบุว่าส่งให้ {dir.positionName(edge.to)}</span>
            )}
          </div>
          <div>
            <div className="text-[var(--faint)] mb-0.5">{dir.positionName(edge.to)} (ผู้รับ) บอกว่า:</div>
            {edge.receiverContext.length ? (
              <ul className="list-disc pl-5 text-[var(--ink)]">{edge.receiverContext.map((t, i) => <li key={i}>{t}</li>)}</ul>
            ) : (
              <span className="text-[var(--danger)]">ไม่ได้ระบุว่ารับจาก {dir.positionName(edge.from)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Workload ---------------- */

function WorkloadTab({ result }: { result: Reconciliation }) {
  const { dir } = useDirectory();
  const maxPerHead = Math.max(0, ...result.workload.map((w) => w.stepsPerHead));
  const maxApprover = Math.max(0, ...result.workload.map((w) => w.approverCount));
  if (result.workload.length === 0) return <Empty text="ยังไม่มีข้อมูลภาระงาน" />;
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] overflow-x-auto">
      <table className="w-full text-[13.5px] border-collapse min-w-[720px]">
        <thead>
          <tr className="text-left text-[var(--faint)] text-xs border-b border-[var(--line)]">
            <th className="px-4 py-3 font-semibold">ตำแหน่ง</th>
            <th className="px-4 py-3 font-semibold text-center">จำนวนคน</th>
            <th className="px-4 py-3 font-semibold text-center">งาน (job)</th>
            <th className="px-4 py-3 font-semibold text-center">ขั้นตอน</th>
            <th className="px-4 py-3 font-semibold text-center">ขั้นตอนต่อหัว</th>
            <th className="px-4 py-3 font-semibold text-center">เส้นเข้า</th>
            <th className="px-4 py-3 font-semibold text-center">เส้นออก</th>
            <th className="px-4 py-3 font-semibold text-center">ผู้อนุมัติ</th>
          </tr>
        </thead>
        <tbody>
          {result.workload.map((w) => {
            const bottleneck = maxPerHead > 0 && w.stepsPerHead === maxPerHead;
            const hub = maxApprover > 0 && w.approverCount === maxApprover;
            return (
              <tr key={w.positionId} className="border-b border-[var(--line)] last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium">{dir.positionName(w.positionId)}</span>
                  {bottleneck && <Tag color="#B65418" text="คอขวด (ต่อหัว)" />}
                  {hub && <Tag color="#128A64" text="จุดอนุมัติหลัก" />}
                </td>
                <td className="px-4 py-3 text-center">{w.members}</td>
                <td className="px-4 py-3 text-center">{w.jobCount}</td>
                <td className="px-4 py-3 text-center">{w.stepCount}</td>
                <td className="px-4 py-3 text-center font-semibold" style={bottleneck ? { color: "#B65418" } : undefined}>{w.stepsPerHead}</td>
                <td className="px-4 py-3 text-center">{w.inbound}</td>
                <td className="px-4 py-3 text-center">{w.outbound}</td>
                <td className="px-4 py-3 text-center" style={hub ? { color: "#128A64", fontWeight: 600 } : undefined}>{w.approverCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- shared ---------------- */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5">
      <h3 className="font-disp font-semibold text-[15px] mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Section({ title, desc, color, children }: { title: string; desc: string; color: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <h3 className="font-disp font-semibold text-[15px]">{title}</h3>
      </div>
      <p className="text-[12.5px] text-[var(--muted)] mb-3 ml-4.5">{desc}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-[13px] text-[var(--faint)] py-1">{text}</p>;
}
function Tag({ color, text }: { color: string; text: string }) {
  return (
    <span className="ml-2 text-[11px] font-semibold rounded-full px-2 py-0.5 text-white align-middle" style={{ background: color }}>{text}</span>
  );
}
