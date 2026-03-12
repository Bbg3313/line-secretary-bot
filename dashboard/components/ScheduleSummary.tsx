import type { ChatRow } from "@/lib/supabase";
import { groupScheduleByDate, getTimeStr } from "@/lib/scheduleUtils";

export default function ScheduleSummary({ chats }: { chats: ChatRow[] }) {
  const byDate = groupScheduleByDate(chats);

  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 shadow-xl">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-slate-200">
        <span className="text-2xl" aria-hidden>📅</span>
        일정 요약
      </h2>
      {chats.length === 0 ? (
        <p className="rounded-lg border border-slate-700/80 bg-slate-800/30 py-8 text-center text-slate-500">
          아직 수집된 일정이 없어요.
        </p>
      ) : (
        <div className="space-y-6">
          {byDate.map(({ dateKey, dateLabel, items }) => (
            <div key={dateKey}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                {dateLabel}
              </h3>
              <div className="overflow-hidden rounded-lg border border-slate-600/80 bg-slate-800/40">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-600/80 bg-slate-700/50">
                      <th className="w-20 px-4 py-3 font-medium text-slate-400">시간</th>
                      <th className="px-4 py-3 font-medium text-slate-400">일정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((chat) => (
                      <tr
                        key={chat.id}
                        className="border-b border-slate-600/60 last:border-0 hover:bg-slate-700/30 transition"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-cyan-300/90">
                          {getTimeStr(chat.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-200">{chat.raw_message}</p>
                          {chat.gemini_analysis && (
                            <p className="mt-0.5 text-xs text-slate-500">{chat.gemini_analysis}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
