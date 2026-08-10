import { Star } from "lucide-react";

interface ReviewStarsProps {
  rating: number;
  size?: number;
  mutedColor?: string;
}

export function ReviewStars({
  rating,
  size = 16,
  mutedColor = "var(--pub-text-muted,#a3987f)",
}: ReviewStarsProps) {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));

  return (
    <div className="flex gap-0.5" aria-label={`5点満点中${normalized.toFixed(1)}点`}>
      {[1, 2, 3, 4, 5].map((position) => {
        const fill = Math.max(0, Math.min(1, normalized - position + 1));
        return (
          <span key={position} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
            <Star size={size} fill="none" stroke={mutedColor} aria-hidden="true" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
              aria-hidden="true"
            >
              <Star
                size={size}
                fill="var(--pub-accent,#c6a15b)"
                stroke="var(--pub-accent,#c6a15b)"
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}
