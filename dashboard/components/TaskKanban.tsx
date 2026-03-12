"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatRow } from "@/lib/supabase";
import type { TaskStatus } from "@/lib/taskStatus";
import { getStoredStatus, setStoredStatus } from "@/lib/taskStatus";

function formatTime(createdAt: string): string {
  try {
    return new Date(createdAt).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

const COLUMNS: { key: TaskStatus; label: string; accent: string }[] = [
  { key: "pending", label: "대기", accent: "border-slate-500/50 bg-slate-800/50" },
  { key: "in_progress", label: "진행 중", accent: "border-amber-500/40 bg-amber-950/20" },
  { key: "done", label: "완료", accent: "border-emerald-500/40 bg-emerald-950/20" },
];

export default function TaskKanban({ chats }: { chats: ChatRow[] }) {
  const [statusMap, setStatusMap] = useState<Record<string, TaskStatus>>({});

  useEffect(() => {
    setStatusMap(getStoredStatus());
  }, []);

  const getStatus = useCallback(
    (id: string): TaskStatus => statusMap[id] ?? "pending",
    [statusMap]
  );

  const setStatus = useCallback((id: string, status: TaskStatus) => {
    setStoredStatus(id, status);
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  const byStatus = { pending: [] as ChatRow[], in_progress: [] as ChatRow[], done: [] as ChatRow[] };
  for (const chat of chats) {
    const s = getStatus(chat.id);
    byStatus[s].push(chat);
  }

  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 shadow-xl">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-200">
        <span className="text-2xl" aria-hidden>📋</span>
        업무 관리
      </h2>
      {chats.length === 0 ? (
        <p className="rounded-lg border border-slate-700/80 bg-slate-800/30 py-8 text-center text-slate-500">
          아직 수집된 업무가 없어요.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map(({ key, label, accent }) => (
            <div
              key={key}
              className={`rounded-xl border ${accent} p-4 transition`}
            >
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                {label}
                <span className="ml-2 font-normal text-slate-500">
                  ({byStatus[key].length})
                </span>
              </h3>
              <div className="space-y-2">
                {byStatus[key].map((chat) => (
                  <TaskCard
                    key={chat.id}
                    chat={chat}
                    currentStatus={key}
                    onMove={(newStatus) => setStatus(chat.id, newStatus)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskCard({
  chat,
  currentStatus,
  onMove,
}: {
  chat: ChatRow;
  currentStatus: TaskStatus;
  onMove: (status: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg border border-slate-600/80 bg-slate-800/60 p-3 shadow-sm transition hover:border-slate-500/80"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <p className="text-sm font-medium text-slate-200 line-clamp-2">
        {chat.raw_message}
      </p>
      <p className="mt-1 text-xs text-slate-500">{formatTime(chat.created_at)}</p>
      {chat.gemini_analysis && (
        <p className="mt-1 text-xs text-slate-500 line-clamp-1">
          {chat.gemini_analysis}
        </p>
      )}
      {open && (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-600/60 pt-2">
          {COLUMNS.filter((c) => c.key !== currentStatus).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onMove(key)}
              className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
            >
              → {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
