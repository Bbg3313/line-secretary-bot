import type { ChatRow } from "@/lib/supabase";

export default function ScheduleSummary({ chats }: { chats: ChatRow[] }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 shadow-lg">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-sky-400">
        <span className="text-2xl" aria-hidden>📅</span>
        일정 요약
      </h2>
      {chats.length === 0 ? (
        <p className="text-slate-500">아직 수집된 일정이 없어요.</p>
      ) : (
        <ul className="space-y-3">
          {chats.map((chat) => (
            <li
              key={chat.id}
              className="rounded-lg border border-slate-600 bg-slate-700/30 p-4 transition hover:border-sky-500/50"
            >
              <p className="font-medium text-slate-200">{chat.raw_message}</p>
              {chat.gemini_analysis && (
                <p className="mt-1 text-sm text-slate-400">{chat.gemini_analysis}</p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {new Date(chat.created_at).toLocaleString("ko-KR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
