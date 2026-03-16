export type FilterMode = "inbox" | "in_progress" | "urgent_overdue" | null;

export type SummaryCardsProps = {
  inboxCount: number;
  inProgressCount: number;
  urgentOverdueCount: number;
  filterMode?: FilterMode;
  onFilter?: (mode: "inbox" | "in_progress" | "urgent_overdue") => void;
  onClearFilter?: () => void;
};

export default function SummaryCards({
  inboxCount,
  inProgressCount,
  urgentOverdueCount,
  filterMode = null,
  onFilter,
  onClearFilter,
}: SummaryCardsProps) {
  const cards: {
    key: "inbox" | "in_progress" | "urgent_overdue";
    label: string;
    value: number;
    unit: string;
    icon: string;
    className: string;
    valueClass: string;
  }[] = [
    { key: "inbox", label: "지시 대기 (Inbox)", value: inboxCount, unit: "건", icon: "📥", className: "border-slate-600/80 bg-slate-800/40 hover:bg-slate-700/50", valueClass: "text-white" },
    { key: "in_progress", label: "실무 진행 중 (In Progress)", value: inProgressCount, unit: "건", icon: "🏃‍♂️", className: "border-sky-500/30 bg-sky-950/20 hover:bg-sky-900/30", valueClass: "text-sky-300" },
    { key: "urgent_overdue", label: "긴급 및 지연 (Urgent/Overdue)", value: urgentOverdueCount, unit: "건", icon: "🚨", className: "border-amber-500/30 bg-amber-950/20 hover:bg-amber-900/30", valueClass: "text-amber-300" },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {cards.map((card) => {
        const active = filterMode === card.key;
        const canClick = Boolean(onFilter || onClearFilter);
        const handleClick = () => {
          if (active && onClearFilter) onClearFilter();
          else if (!active && onFilter) onFilter(card.key);
        };
        return (
          <div
            key={card.key}
            role={canClick ? "button" : undefined}
            tabIndex={canClick ? 0 : undefined}
            onClick={canClick ? handleClick : undefined}
            onKeyDown={
              canClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleClick();
                    }
                  }
                : undefined
            }
            className={`rounded-xl border ${card.className} p-6 shadow-lg transition-transform transition-colors duration-150 ${
              canClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-xl" : ""
            } ${
              active
                ? "border-emerald-400 ring-2 ring-emerald-500/60 ring-offset-2 ring-offset-[#0f172a]"
                : ""
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {card.label}
              {active && onClearFilter && (
                <span className="ml-2 text-emerald-400">
                  · 필터 적용 중 <button type="button" className="underline" onClick={(e) => { e.stopPropagation(); onClearFilter(); }}>해제</button>
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
