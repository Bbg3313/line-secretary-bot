export type SummaryCardsProps = {
  todayTaskCount: number;
  urgentCount: number;
  todayScheduleCount: number;
  onTodayClick?: () => void;
  filterTodayActive?: boolean;
  onClearTodayFilter?: () => void;
};

export default function SummaryCards({
  todayTaskCount,
  urgentCount,
  todayScheduleCount,
  onTodayClick,
  filterTodayActive,
  onClearTodayFilter,
}: SummaryCardsProps) {
  const cards = [
    {
      label: "오늘의 할 일",
      value: todayTaskCount,
      unit: "건",
      icon: "📋",
      className: "border-slate-600/80 bg-slate-800/40 hover:bg-slate-700/50",
      valueClass: "text-white",
      clickable: true,
    },
    {
      label: "긴급 · 주의",
      value: urgentCount,
      unit: "건",
      icon: "⚠️",
      className: "border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30",
      valueClass: "text-amber-300",
      clickable: false,
    },
    {
      label: "오늘 일정",
      value: todayScheduleCount,
      unit: "건",
      icon: "📅",
      className: "border-sky-500/30 bg-sky-950/20 hover:bg-sky-900/30",
      valueClass: "text-sky-300",
      clickable: false,
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {cards.map((card) => {
        const isTodayCard = card.label === "오늘의 할 일";
        const active = isTodayCard && filterTodayActive;
        const canClick = isTodayCard && onTodayClick;
        return (
          <div
            key={card.label}
            role={canClick ? "button" : undefined}
            tabIndex={canClick ? 0 : undefined}
            onClick={canClick ? (active && onClearTodayFilter ? onClearTodayFilter : onTodayClick) : undefined}
            onKeyDown={
              canClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (active && onClearTodayFilter) onClearTodayFilter();
                      else onTodayClick?.();
                    }
                  }
                : undefined
            }
            className={`rounded-xl border ${card.className} p-6 shadow-lg transition ${
              canClick ? "cursor-pointer" : ""
            } ${active ? "ring-2 ring-emerald-500/60 ring-offset-2 ring-offset-[#0f172a]" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {card.label}
              {active && (
                <span className="ml-2 text-emerald-400">
                  · 필터 적용 중 <button type="button" className="underline" onClick={(e) => { e.stopPropagation(); onClearTodayFilter?.(); }}>해제</button>
                </span>
              )}
            </p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className={`text-3xl font-bold tabular-nums ${card.valueClass}`}>
                {card.value}
              </span>
              <span className="text-slate-500">{card.unit}</span>
            </p>
            <span className="mt-3 block text-2xl opacity-70" aria-hidden>
              {card.icon}
            </span>
          </div>
        );
      })}
    </div>
  );
}
