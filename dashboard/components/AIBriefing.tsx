type AIBriefingProps = {
  todayScheduleCount: number;
  todayTaskCount: number;
  /** 오늘 수집된 메시지의 gemini_analysis에서 추린 한 줄 (선택) */
  highlightLine?: string | null;
};

export default function AIBriefing({
  todayScheduleCount,
  todayTaskCount,
  highlightLine,
}: AIBriefingProps) {
  const hasActivity = todayScheduleCount > 0 || todayTaskCount > 0;
  const defaultPhrase = hasActivity
    ? "오늘도 꼼꼼히 챙기세요."
    : "채팅에서 일정이나 할 일을 말해 주시면 정리해 드릴게요.";

  const phrase = highlightLine?.trim() || defaultPhrase;

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-teal-950/30 p-6 shadow-lg backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-2xl">
          ✨
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/90">
            AI 비서 한마디
          </h2>
          <p className="mt-2 text-lg leading-relaxed text-slate-200">
            {phrase}
          </p>
          {hasActivity && (
            <p className="mt-3 text-sm text-slate-500">
              오늘 일정 {todayScheduleCount}건, 할 일 {todayTaskCount}건이 수집되었어요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
