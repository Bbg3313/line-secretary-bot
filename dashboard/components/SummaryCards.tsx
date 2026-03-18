export type FilterMode = "inbox" | "in_progress" | "urgent_overdue" | null;

export type SummaryCardsProps = {
  inboxCount: number;
  inProgressCount: number;
  urgentOverdueCount: number;
  filterMode?: FilterMode;
  onFilter?: (mode: "inbox" | "in_progress" | "urgent_overdue") => void;
  onClearFilter?: () => void;
};

const CARD_CONFIG = [
  {
    key: "inbox" as const,
    label: "지시 대기",
    icon: "📥",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    key: "in_progress" as const,
    label: "지시 완료",
    icon: "🚀",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  {
    key: "urgent_overdue" as const,
    label: "지연된 지시",
    icon: "🚨",
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
] as const;

export default function SummaryCards({
  inboxCount,
  inProgressCount,
  urgentOverdueCount,
  filterMode = null,
  onFilter,
  onClearFilter,
}: SummaryCardsProps) {
  const values = { inbox: inboxCount, in_progress: inProgressCount, urgent_overdue: urgentOverdueCount };

  return (
    <div className="flex justify-center">
      <div className="grid w-full max-w-5xl gap-5 sm:grid-cols-3">
        {CARD_CONFIG.map((card) => {
          const value = values[card.key];
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
              className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 ${
                canClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-md" : ""
              } ${active ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-50 border-blue-200" : ""}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {card.label}
                {active && onClearFilter && (
                  <span className="ml-2 text-blue-500">
                    · 필터 적용 중{" "}
                    <button type="button" className="underline" onClick={(e) => { e.stopPropagation(); onClearFilter(); }}>
                      해제
                    </button>
                  </span>
                )}
              </p>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span
                  className={`text-3xl font-bold tabular-nums ${
                    card.key === "inbox"
                      ? "text-blue-600"
                      : card.key === "in_progress"
                        ? "text-emerald-500"
                        : "text-rose-500"
                  }`}
                >
                  {value}
                </span>
                <span className="text-gray-500">건</span>
              </p>
              <div
                className={`mt-3 inline-flex h-12 w-12 items-center justify-center rounded-lg p-3 ${card.iconBg} ${card.iconColor} text-2xl`}
                aria-hidden
              >
                {card.icon}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
