export type SummaryCardsProps = {
  todayTaskCount: number;
  urgentCount: number;
  todayScheduleCount: number;
};

export default function SummaryCards({ todayTaskCount, urgentCount, todayScheduleCount }: SummaryCardsProps) {
  const cards = [
    {
      label: "오늘의 할 일",
      value: todayTaskCount,
      unit: "건",
      icon: "📋",
      className: "border-slate-600/80 bg-slate-800/40 hover:bg-slate-700/50",
      valueClass: "text-white",
    },
    {
      label: "긴급 · 주의",
      value: urgentCount,
      unit: "건",
      icon: "⚠️",
      className: "border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30",
      valueClass: "text-amber-300",
    },
    {
      label: "오늘 일정",
      value: todayScheduleCount,
      unit: "건",
      icon: "📅",
      className: "border-sky-500/30 bg-sky-950/20 hover:bg-sky-900/30",
      valueClass: "text-sky-300",
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border ${card.className} p-6 shadow-lg transition`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {card.label}
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
      ))}
    </div>
  );
}
