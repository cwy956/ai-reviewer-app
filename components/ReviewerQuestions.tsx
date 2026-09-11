export function ReviewerQuestions({ questions }: { questions: string[] }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-5">
      <h3 className="font-semibold">심사역이 추가로 궁금해할 질문</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
    </div>
  );
}
