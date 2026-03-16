type AIBriefingProps = {
  /** AI 비서 한마디 전체 문장 */
  text: string;
};

export default function AIBriefing({ text }: AIBriefingProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xl text-amber-500">
          ✨
        </div>
        <p className="text-base font-medium leading-snug text-gray-900">
          {text}
        </p>
      </div>
    </section>
  );
}
