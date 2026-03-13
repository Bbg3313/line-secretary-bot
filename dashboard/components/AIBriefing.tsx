type AIBriefingProps = {
  /** AI 비서 한마디 전체 문장 (예: "대표님, 오늘 마이셀 예산 증액 건 포함 총 5개의 긴급 업무가 있습니다.") */
  text: string;
};

export default function AIBriefing({ text }: AIBriefingProps) {
  return (
    <section className="rounded-xl border border-slate-600/80 bg-slate-800/30 p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-xl">
          ✨
        </div>
        <p className="text-base font-medium leading-snug text-slate-200">
          {text}
        </p>
      </div>
    </section>
  );
}
