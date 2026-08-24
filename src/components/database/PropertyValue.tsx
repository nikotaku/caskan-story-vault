import { Property, SelectOption } from "./types";

const COLOR_MAP: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-700",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  pink: "bg-pink-100 text-pink-700",
};

function Tag({ label, color }: SelectOption) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${COLOR_MAP[color] || COLOR_MAP.gray}`}>
      {label}
    </span>
  );
}

interface Props {
  property: Property;
  value: unknown;
  compact?: boolean;
}

export function PropertyValue({ property, value, compact }: Props) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  switch (property.type) {
    case "checkbox":
      return (
        <span className={`text-sm ${value ? "text-green-600" : "text-muted-foreground"}`}>
          {value ? "✓" : "✗"}
        </span>
      );

    case "number":
      return (
        <span className="text-sm tabular-nums">
          {property.format === "currency" && typeof value === "number"
            ? `¥${value.toLocaleString("ja-JP")}`
            : property.format === "days" && typeof value === "number"
              ? `${value.toLocaleString("ja-JP")}日`
              : property.format === "percent" && typeof value === "number"
                ? `${value.toLocaleString("ja-JP")}%`
                : typeof value === "number"
                  ? value.toLocaleString("ja-JP")
                  : String(value)}
        </span>
      );

    case "date":
      if (!value) return <span className="text-muted-foreground text-xs">—</span>;
      return <span className="text-sm">{String(value).slice(0, 10)}</span>;

    case "phone":
      return (
        <a href={`tel:${String(value).replace(/\D/g, "")}`} className="text-sm text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(value)}
        </a>
      );

    case "email":
      return (
        <a href={`mailto:${value}`} className="text-sm text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
          {String(value)}
        </a>
      );

    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate block max-w-[200px]" onClick={(e) => e.stopPropagation()}>
          {String(value)}
        </a>
      );

    case "select": {
      const stringValue = String(value);
      const opt = property.options?.find((o) => o.label === stringValue);
      return opt ? <Tag {...opt} /> : <span className="text-sm">{stringValue}</span>;
    }

    case "multi_select": {
      const vals: string[] = Array.isArray(value) ? value : String(value).split(",").map((v) => v.trim()).filter(Boolean);
      if (compact) {
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {vals.slice(0, 2).map((v) => {
              const opt = property.options?.find((o) => o.label === v);
              return opt ? <Tag key={v} {...opt} /> : <span key={v} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v}</span>;
            })}
            {vals.length > 2 && <span className="text-xs text-muted-foreground">+{vals.length - 2}</span>}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {vals.map((v) => {
            const opt = property.options?.find((o) => o.label === v);
            return opt ? <Tag key={v} {...opt} /> : <span key={v} className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v}</span>;
          })}
        </div>
      );
    }

    default:
      return (
        <span className={`text-sm ${compact ? "truncate block max-w-[200px]" : ""}`}>
          {String(value)}
        </span>
      );
  }
}
