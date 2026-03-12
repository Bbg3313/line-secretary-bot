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
      gradient: "from-violet-500/20 to-indigo-600/20",
      border: "border-violet-500/30",
      text: "text-violet-300",
    },
    {
      label: "긴급 · 주의",
      value: urgentCount,
      unit: "건",
      icon: "⚠️",
      gradient: "from-amber-500/20 to-orange-600/20",
      border: "border-amber-500/30",
      text: "text-amber-300",
    },
    {
      label: "오늘 일정",
      value: todayScheduleCount,
      unit: "건",
      icon: "📅",
      gradient: "from-cyan-500/20 to-sky-600/20",
      border: "border-cyan-500/30",
      text: "text-cyan-300",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border bg-gradient-to-br ${card.gradient} ${card.border} p-5 shadow-lg backdrop-blur-sm transition hover:shadow-xl`}
        >
          <p className="text-sm font-medium uppercase tracking-wider text-slate-400">
            {card.label}
          </p>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-3xl font-bold tabular-nums ${card.text}`}>
              {card.value}
            </span>
            <span className="text-slate-500">{card.unit}</span>
          </p>
          <span className="mt-2 block text-2xl opacity-80" aria-hidden>
            {card.icon}
          </span>
        </div>
      ))}
    </div>
  );
}
