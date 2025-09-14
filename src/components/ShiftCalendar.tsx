import { MapPin } from "lucide-react";

interface Cast {
  id: string;
  name: string;
}

interface Shift {
  castId: string;
  date: string;
  time?: string;
  room?: string;
  hasData: boolean;
}

interface DateInfo {
  date: string;
  label: string;
  isToday: boolean;
}

interface ShiftCalendarProps {
  dates: DateInfo[];
  casts: Cast[];
  shifts: Shift[];
}

export const ShiftCalendar = ({ dates, casts, shifts }: ShiftCalendarProps) => {
  const getShiftForCastAndDate = (castId: string, date: string) => {
    return shifts.find(shift => shift.castId === castId && shift.date === date);
  };

  return (
    <table className="w-full bg-background border border-border">
      <thead>
        <tr>
          <th className="border border-border text-center py-2 px-1 text-xs font-normal text-muted-foreground"></th>
          {dates.map((date) => (
            <th 
              key={date.date}
              className={`border border-border text-center py-2 px-1 text-xs font-normal sticky top-0 z-10 ${
                date.isToday 
                  ? "bg-green-50 text-green-700 border-t-0" 
                  : "bg-background text-muted-foreground border-t-0"
              }`}
            >
              {date.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {casts.map((cast) => (
          <tr key={cast.id} className="hover:bg-muted/30 transition-colors">
            <td className="border border-border text-center py-2 px-1">
              <div className="text-left">
                <a href={`/cast/view?id=${cast.id}`} className="text-xs text-foreground whitespace-nowrap">
                  {cast.name}
                </a>
              </div>
            </td>
            {dates.map((date) => {
              const shift = getShiftForCastAndDate(cast.id, date.date);
              return (
                <td 
                  key={`${cast.id}-${date.date}`}
                  className="border border-border text-center py-2 px-1 text-xs relative cursor-pointer hover:bg-muted/50 transition-colors"
                  style={{ width: "12.5%" }}
                >
                  {shift?.hasData ? (
                    <>
                      <div className="mb-1">
                        {shift.time}
                      </div>
                      {shift.room && (
                        <div className="flex items-center justify-center">
                          <MapPin size={10} className="mr-1 text-muted-foreground" />
                          <span className="text-green-600 text-xs">{shift.room}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-8"></div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};