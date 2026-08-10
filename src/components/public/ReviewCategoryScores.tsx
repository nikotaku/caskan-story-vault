const CATEGORY_LABELS = [
  "ルックスS級",
  "非日常感",
  "ゴッドハンド指数",
  "値段以上のサービス",
  "ハイレベルなおもてなし",
  "あぁぁぁぁぁ！",
] as const;

interface ReviewCategoryScoresProps {
  details: unknown;
}

function categoryScores(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const rawScores = (details as Record<string, unknown>).category_scores;
  if (!rawScores || typeof rawScores !== "object" || Array.isArray(rawScores)) return [];

  return CATEGORY_LABELS.flatMap((label) => {
    const score = Number((rawScores as Record<string, unknown>)[label]);
    return Number.isFinite(score) && score >= 1 && score <= 5 ? [{ label, score }] : [];
  });
}

export function ReviewCategoryScores({ details }: ReviewCategoryScoresProps) {
  const scores = categoryScores(details);
  if (scores.length === 0) return null;

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 rounded-lg border px-3 py-2.5 mb-3"
      style={{ borderColor: "var(--pub-border,#3a2f1c)", background: "var(--pub-card2,#221b12)" }}
      aria-label="項目別評価"
    >
      {scores.map(({ label, score }) => (
        <div key={label} className="flex items-center justify-between gap-3 text-xs">
          <span style={{ color: "var(--pub-text-muted,#a3987f)" }}>{label}</span>
          <span className="font-bold shrink-0" style={{ color: "var(--pub-accent,#c6a15b)" }}>
            {score.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
