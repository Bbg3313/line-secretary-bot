type AIBriefingProps = {
  totalTasks: number;
  dueTodayCount: number;
  dueTodayExample?: string | null;
};

export default function AIBriefing({ totalTasks, dueTodayCount, dueTodayExample }: AIBriefingProps) {
  const line =
    totalTasks === 0
      ? "대표님, 아직 수집된 업무가 없어요."
      : dueTodayCount > 0 && dueTodayExample
        ? `대표님, 오늘 마감인 ${dueTodayExample} 포함 총 ${totalTasks}개의 업무가 있습니다.`
        : `대표님, 총 ${totalTasks}개의 업무가 있습니다.`;

  return (
    <section className="rounded-xl border border-slate-600/80 bg-slate-800/30 p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-xl">
          ✨
        </div>
        <p className="text-base font-medium leading-snug text-slate-200">
          {line}
        </p>
      </div>
    </section>
  );
}
