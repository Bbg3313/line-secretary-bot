"use client";

import type { TaskRow } from "@/lib/supabase";
import { ASSIGNEE_OPTIONS, normalizeAssigneeName } from "@/lib/scheduleUtils";

function getAssignee(t: TaskRow): string {
  const a = (t as { assignee?: string | null }).assignee;
  return normalizeAssigneeName(a);
}

type AssigneeCardsProps = {
  tasks: TaskRow[];
  selectedAssignee?: string | null;
  onSelectAssignee?: (assignee: string | null) => void;
};

export default function AssigneeCards({ tasks, selectedAssignee = null, onSelectAssignee }: AssigneeCardsProps) {
  const counts = ASSIGNEE_OPTIONS.map((name) => ({
    name,
    count: tasks.filter((t) => getAssignee(t) === name).length,
  }));

  const isClickable = Boolean(onSelectAssignee);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-900">
        담당자별 업무
        {selectedAssignee && onSelectAssignee && (
          <span className="ml-2 text-sm font-normal text-blue-600">
            · <span className="font-medium">{selectedAssignee}</span> 필터 적용 중{" "}
            <button type="button" className="underline hover:no-underline" onClick={(e) => { e.stopPropagation(); onSelectAssignee(null); }}>해제</button>
          </span>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map(({ name, count }) => {
          const selected = selectedAssignee === name;
          return (
            <button
              key={name}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isClickable && onSelectAssignee) onSelectAssignee(selected ? null : name);
              }}
              className={`flex flex-col items-center justify-center rounded-xl border py-5 px-4 text-center shadow-sm transition-all duration-200 w-full min-h-[100px] hover:-translate-y-1 hover:shadow-md ${
                selected
                  ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400/50"
                  : "border-gray-100 bg-slate-50 hover:bg-slate-100 hover:border-gray-200"
              } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              <p className="text-3xl font-bold tabular-nums text-slate-800">{count}</p>
              <p className="mt-2 text-sm font-medium text-gray-800 leading-snug">{name}</p>
              <span className="mt-1 text-xs text-gray-500">건</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
