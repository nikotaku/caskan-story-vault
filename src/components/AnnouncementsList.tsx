import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const announcements = [
  { date: "7/22", title: "【訂正】姫予約報酬設定の仕様変更について", id: 72 },
  { date: "7/5", title: "広告媒体別レポートを公開しました", id: 71 },
  { date: "6/17", title: "広告媒体項目を追加しました", id: 70 },
  { date: "6/6", title: "待機中の表示・非表示を選択できるようになりました", id: 69 },
  { date: "4/4", title: "シフト公開期間の設定ができるようになりました", id: 68 },
];

export const AnnouncementsList = () => {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground px-2">
        <Bell size={12} />
        お知らせ
      </div>
      
      <ul className="space-y-1">
        {announcements.map((announcement) => (
          <li key={announcement.id}>
            <a 
              href={`/announce/view?id=${announcement.id}`}
              className="flex items-start gap-3 text-xs hover:text-primary transition-colors"
            >
              <span className="inline-block w-8 text-center text-muted-foreground">
                {announcement.date}
              </span>
              <span className="flex-1">{announcement.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};