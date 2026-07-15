import { notFound } from "next/navigation";
import { getStaff } from "@/lib/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { FormClient } from "@/components/FormClient";
import { FormState, Task, emptyTask, specialToken, TaskRow, TaskLinkRow, LinkKind } from "@/lib/types";

export const dynamic = "force-dynamic";

function buildInitialForm(
  personId: string,
  response: { id: string; blockers: string | null } | null,
  tasks: TaskRow[],
  links: TaskLinkRow[]
): FormState {
  if (!response) {
    return { personId, tasks: [emptyTask()], blockers: "" };
  }
  const linksByTask = new Map<string, TaskLinkRow[]>();
  for (const l of links) {
    const arr = linksByTask.get(l.task_id) ?? [];
    arr.push(l);
    linksByTask.set(l.task_id, arr);
  }
  const tokensFor = (taskId: string, kind: LinkKind): string[] =>
    (linksByTask.get(taskId) ?? [])
      .filter((l) => l.kind === kind)
      .map((l) => (l.special ? specialToken(l.special) : (l.person_id ?? "")))
      .filter(Boolean);

  const builtTasks: Task[] = tasks
    .sort((a, b) => a.task_order - b.task_order)
    .map((t) => ({
      action: t.action,
      inputDesc: t.input_desc,
      from: tokensFor(t.id, "from"),
      outputDesc: t.output_desc,
      to: tokensFor(t.id, "to"),
      approver: tokensFor(t.id, "approver"),
      parallelWith: t.parallel_with ?? "",
      rework: tokensFor(t.id, "rework"),
    }));

  return {
    personId,
    tasks: builtTasks.length ? builtTasks : [emptyTask()],
    blockers: response.blockers ?? "",
  };
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

  let tasks: TaskRow[] = [];
  let links: TaskLinkRow[] = [];
  if (response) {
    const { data: taskRows } = await supabase
      .from("tasks")
      .select("*")
      .eq("response_id", response.id);
    tasks = (taskRows as TaskRow[] | null) ?? [];
    if (tasks.length) {
      const { data: linkRows } = await supabase
        .from("task_links")
        .select("*")
        .in("task_id", tasks.map((t) => t.id));
      links = (linkRows as TaskLinkRow[] | null) ?? [];
    }
  }

  const initial = buildInitialForm(personId, response, tasks, links);
  return <FormClient staff={staff} initial={initial} alreadySubmitted={!!response} />;
}
