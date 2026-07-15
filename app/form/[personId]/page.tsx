import { notFound } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { FormClient } from "@/components/FormClient";
import {
  FormState,
  Job,
  Reveal,
  emptyForm,
  emptyReveal,
  specialToken,
  JobRow,
  StepRow,
  StepLinkRow,
  LinkKind,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function buildReveal(links: StepLinkRow[], kind: LinkKind): Reveal {
  const rows = links.filter((l) => l.kind === kind);
  if (rows.length === 0) return emptyReveal();
  const people = rows.map((l) => (l.external ? specialToken("external") : (l.person_id ?? ""))).filter(Boolean);
  const what = rows.find((l) => l.what)?.what ?? "";
  return { enabled: true, people, what };
}

export default async function FormPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const staff = getStaff(personId);
  if (!staff) notFound();

  const supabase = createServiceClient();
  const { data: response } = await supabase
    .from("responses")
    .select("id, blockers")
    .eq("person_id", personId)
    .maybeSingle();

  let initial: FormState = emptyForm(personId);

  if (response) {
    const { data: jobRows } = await supabase.from("jobs").select("*").eq("response_id", response.id);
    const jobs = (jobRows as JobRow[] | null) ?? [];
    let steps: StepRow[] = [];
    let links: StepLinkRow[] = [];
    if (jobs.length) {
      const { data: stepRows } = await supabase.from("steps").select("*").in("job_id", jobs.map((j) => j.id));
      steps = (stepRows as StepRow[] | null) ?? [];
      if (steps.length) {
        const { data: linkRows } = await supabase.from("step_links").select("*").in("step_id", steps.map((s) => s.id));
        links = (linkRows as StepLinkRow[] | null) ?? [];
      }
    }

    const linksByStep = new Map<string, StepLinkRow[]>();
    for (const l of links) {
      const arr = linksByStep.get(l.step_id) ?? [];
      arr.push(l);
      linksByStep.set(l.step_id, arr);
    }
    const stepsByJob = new Map<string, StepRow[]>();
    for (const s of steps) {
      const arr = stepsByJob.get(s.job_id) ?? [];
      arr.push(s);
      stepsByJob.set(s.job_id, arr);
    }

    const builtJobs: Job[] = jobs
      .sort((a, b) => a.job_order - b.job_order)
      .map((j) => ({
        name: j.name,
        trigger: j.trigger ?? "",
        frequency: j.frequency ?? "",
        steps: (stepsByJob.get(j.id) ?? [])
          .sort((a, b) => a.step_order - b.step_order)
          .map((s) => {
            const sl = linksByStep.get(s.id) ?? [];
            return {
              action: s.action,
              waitsFor: buildReveal(sl, "waits_for"),
              sendsTo: buildReveal(sl, "sends_to"),
              approver: buildReveal(sl, "approver"),
            };
          }),
      }));

    if (builtJobs.length) {
      initial = { personId, jobs: builtJobs, blockers: response.blockers ?? "" };
    } else {
      initial = { ...emptyForm(personId), blockers: response.blockers ?? "" };
    }
  }

  return <FormClient staff={staff} initial={initial} alreadySubmitted={!!response} />;
}
