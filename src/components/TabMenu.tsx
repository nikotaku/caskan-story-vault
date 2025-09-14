import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TabMenuProps {
  activeDate: string;
  dates: { date: string; label: string }[];
  onDateChange: (date: string) => void;
}

export const TabMenu = ({ activeDate, dates, onDateChange }: TabMenuProps) => {
  return (
    <div className="border-b border-border mb-4">
      <div className="flex gap-0">
        {dates.map((dateItem) => (
          <button
            key={dateItem.date}
            onClick={() => onDateChange(dateItem.date)}
            className={cn(
              "px-6 py-3 text-xs font-medium border-l border-t border-r border-border rounded-t-md -mb-px transition-colors",
              activeDate === dateItem.date
                ? "bg-muted/30 text-foreground"
                : "bg-card text-muted-foreground hover:bg-muted/10"
            )}
          >
            {dateItem.label}
          </button>
        ))}
      </div>
    </div>
  );
};