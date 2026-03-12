import type { ChatRow } from "@/lib/supabase";

function formatDateTime(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    return d.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return createdAt.slice(0, 16);
  }
}

export default function IncompleteTasks({ chats }: { chats: ChatRow[] }) {
  const sorted = [...chats].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 shadow-lg">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-amber-400">
        <span className="text-2xl" aria-hidden>📋</span>
        미완료 업무
      </h2>
      {chats.length === 0 ? (
        <p className="text-slate-500">아직 수집된 미완료 업무가 없어요.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-600">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-700/50">
                <th className="w-24 px-3 py-2 font-medium text-slate-400">수집일시</th>
                <th className="px-3 py-2 font-medium text-slate-400">업무</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((chat) => (
                <tr
                  key={chat.id}
                  className="border-b border-slate-600/80 last:border-0 hover:bg-slate-700/30"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                    {formatDateTime(chat.created_at)}
                  </td>
                  <td className="px-3 py-2.5">
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
      )}
    </section>
  );
}
