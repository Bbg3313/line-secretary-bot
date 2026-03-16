"use client";

import type { TaskRow } from "@/lib/supabase";

const ASSIGNEE_LIST = ["미정", "대표님", "A팀장", "마케팅팀", "쏨차이(태국CS)", "베트남담당"] as const;

function getAssignee(t: TaskRow): string {
  const a = (t as { assignee?: string | null }).assignee;
  const s = (a ?? "").trim();
  return s || "미정";
}

export default function AssigneeCards({ tasks }: { tasks: TaskRow[] }) {
  const counts = ASSIGNEE_LIST.map((name) => ({
    name,
    count: tasks.filter((t) => getAssignee(t) === name).length,
  }));

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        담당자별 업무
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map(({ name, count }) => (
          <div
            key={name}
            className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-slate-50 py-5 px-4 text-center shadow-sm"
          >
            <p className="text-3xl font-bold tabular-nums text-orange-500">{count}</p>
            <p className="mt-2 text-sm font-medium text-gray-800 leading-snug">{name}</p>
            <span className="mt-1 text-xs text-gray-500">건</span>
          </div>
        ))}
      </div>
    </section>
  );
}
