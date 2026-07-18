import { createServiceClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { loadDirectory } from "@/lib/directory";
import {
  Project,
  Assignment,
  isActive,
  summarizePeople,
  topScoreThreshold,
  bottomScoreThreshold,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

function Section({ title, hint, empty, children }: { title: string; hint: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-[16px] p-5 shadow-sm">
      <div className="font-semibold text-[15px]">{title}</div>
      <div className="text-[12.5px] text-[var(--faint)] mt-0.5 mb-3">{hint}</div>
      {empty ? <div className="text-[13px] text-[var(--faint)]">— ไม่มีข้อสังเกตในหมวดนี้</div> : children}
    </div>
  );
}

export default async function AdminInsightsPage() {
  const supabase = createServiceClient();
  const [{ data: projRows }, { data: asgRows }, dir] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("assignments").select("*"),
    loadDirectory(supabase),
  ]);
  const allProjects = (projRows as Project[] | null) ?? [];
  const projects = allProjects.filter(isActive);
  const assignments = (asgRows as Assignment[] | null) ?? [];
  const activeIds = new Set(projects.map((p) => p.id));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  // Insights consider ACTIVE staff only (deactivated people are excluded from load).
  const summaries = summarizePeople(activeIds, assignments, dir.staffOrdered.map((s) => s.id));
  const topT = topScoreThreshold(summaries);
  const botT = bottomScoreThreshold(summaries);

  // active assignments grouped
  const active = assignments.filter((a) => activeIds.has(a.project_id));
  const byPerson = new Map<string, Assignment[]>();
  const byProject = new Map<string, Assignment[]>();
  for (const a of active) {
    (byPerson.get(a.person_id) ?? byPerson.set(a.person_id, []).get(a.person_id)!).push(a);
    (byProject.get(a.project_id) ?? byProject.set(a.project_id, []).get(a.project_id)!).push(a);
  }
  const personProjects = (pid: string) => (byPerson.get(pid) ?? []).map((a) => projectName.get(a.project_id) ?? a.project_id);

  const topLoad = summaries.filter((s) => s.score > 0 && s.score >= topT).sort((a, b) => b.score - a.score);
  const available = summaries.filter((s) => s.score > 0 && s.score <= botT && s.score < topT).sort((a, b) => a.score - b.score);
  const noProjects = summaries.filter((s) => s.score === 0);
  const multiHigh = summaries.filter((s) => s.high > 1).sort((a, b) => b.high - a.high);

  const singleHigh = projects
    .map((p) => ({ p, highs: (byProject.get(p.id) ?? []).filter((a) => a.involvement === "high") }))
    .filter((x) => x.highs.length === 1);
  const noOwner = projects.filter((p) => !(byProject.get(p.id) ?? []).some((a) => a.is_owner));

  // positions present per active project; a position missing here but present in ALL other active projects
  const posByProject = new Map<string, Set<string>>();
  for (const p of projects) {
    const set = new Set<string>();
    for (const a of byProject.get(p.id) ?? []) {
      const pos = dir.getStaff(a.person_id)?.positionId;
      if (pos) set.add(pos);
    }
    posByProject.set(p.id, set);
  }
  const missingByProject = projects
    .map((p) => {
      const others = projects.filter((o) => o.id !== p.id).map((o) => posByProject.get(o.id)!);
      if (others.length === 0) return { p, missing: [] as string[] };
      const inAllOthers = [...others[0]].filter((pos) => others.every((s) => s.has(pos)));
      const mine = posByProject.get(p.id)!;
      return { p, missing: inAllOthers.filter((pos) => !mine.has(pos)) };
    })
    .filter((x) => x.missing.length > 0);

  const li = "text-[13px] text-[var(--ink)] flex flex-wrap gap-x-2 gap-y-0.5 items-baseline";

  return (
    <div className="max-w-[820px] mx-auto px-5 py-8">
      <h1 className="font-disp font-bold text-[22px] mb-4">ข้อสังเกต</h1>
      <AdminNav />
      <p className="text-[13px] text-[var(--muted)] mb-5">คำนวณจากข้อมูลจริงที่แต่ละคนกรอก แสดงเฉพาะที่เข้าเงื่อนไข</p>

      <div className="flex flex-col gap-4">
        <Section title="คนที่ภาระสูงสุด" hint="อยู่ใน 25% บนสุดของทีม" empty={topLoad.length === 0}>
          <ul className="flex flex-col gap-1.5">
            {topLoad.map((s) => (
              <li key={s.staffId} className={li}>
                <b>{dir.staffLabel(s.staffId)}</b>
                <span className="text-[#B65418] font-semibold">คะแนน {s.score}</span>
                <span className="text-[var(--faint)]">— {personProjects(s.staffId).join(", ")}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="คนที่ยังพอรับงานได้" hint="25% ล่างสุดที่ยังทำงานอยู่ (ไม่นับคนที่ไม่มีโปรเจกต์เลย)" empty={available.length === 0}>
          <ul className="flex flex-col gap-1.5">
            {available.map((s) => (
              <li key={s.staffId} className={li}>
                <b>{dir.staffLabel(s.staffId)}</b>
                <span className="text-[var(--muted)]">คะแนน {s.score}</span>
                <span className="text-[var(--faint)]">— {personProjects(s.staffId).join(", ")}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="คนที่ยังไม่มีโปรเจกต์เลย" hint="อาจยังไม่ได้กรอก — เช็คกับแท็บความคืบหน้าก่อนสรุป" empty={noProjects.length === 0}>
          <div className="text-[13px] text-[var(--ink)]">{noProjects.map((s) => dir.staffLabel(s.staffId)).join(" · ")}</div>
        </Section>

        <Section title="คนที่ถือระดับสูงมากกว่า 1 โปรเจกต์" hint="เสี่ยงที่สุด เพราะงานหลักชนกัน" empty={multiHigh.length === 0}>
          <ul className="flex flex-col gap-1.5">
            {multiHigh.map((s) => (
              <li key={s.staffId} className={li}>
                <b>{dir.staffLabel(s.staffId)}</b>
                <span className="text-[#B65418] font-semibold">สูง {s.high} โปรเจกต์</span>
                <span className="text-[var(--faint)]">
                  — {(byPerson.get(s.staffId) ?? []).filter((a) => a.involvement === "high").map((a) => projectName.get(a.project_id)).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="โปรเจกต์ที่มีคนระดับสูงคนเดียว" hint="ถ้าคนนั้นลา งานสะดุด" empty={singleHigh.length === 0}>
          <ul className="flex flex-col gap-1.5">
            {singleHigh.map(({ p, highs }) => (
              <li key={p.id} className={li}>
                <b>{p.name}</b>
                <span className="text-[var(--faint)]">— มีแค่ {dir.staffLabel(highs[0].person_id)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="โปรเจกต์ที่ไม่มีเจ้าของ" hint="ไม่มีใครติ๊กว่าเป็นเจ้าของงานหลัก" empty={noOwner.length === 0}>
          <div className="text-[13px] text-[var(--ink)]">{noOwner.map((p) => p.name).join(" · ")}</div>
        </Section>

        <Section title="ตำแหน่งที่อาจขาดในบางโปรเจกต์" hint="ตำแหน่งที่โปรเจกต์อื่นมีครบ แต่โปรเจกต์นี้ไม่มี" empty={missingByProject.length === 0}>
          <ul className="flex flex-col gap-1.5">
            {missingByProject.map(({ p, missing }) => (
              <li key={p.id} className={li}>
                <b>{p.name}</b>
                <span className="text-[var(--faint)]">— ขาด {missing.map((id) => dir.positionName(id)).join(", ")}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
