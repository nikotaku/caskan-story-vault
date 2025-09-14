import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Shift = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState("2025-09-14");
  const [searchTerm, setSearchTerm] = useState("");

  const dates = [
    { date: "2025-09-14", label: "9/14 (日)", isToday: true },
    { date: "2025-09-15", label: "9/15 (月)", isToday: false },
    { date: "2025-09-16", label: "9/16 (火)", isToday: false },
    { date: "2025-09-17", label: "9/17 (水)", isToday: false },
    { date: "2025-09-18", label: "9/18 (木)", isToday: false },
    { date: "2025-09-19", label: "9/19 (金)", isToday: false },
    { date: "2025-09-20", label: "9/20 (土)", isToday: false },
  ];

  const casts = [
    { id: "43317", name: "えな" },
    { id: "45287", name: "かおる" },
    { id: "43648", name: "ひより" },
    { id: "43703", name: "ゆりあ" },
    { id: "43761", name: "まりな" },
    { id: "22121", name: "ばんび" },
  ];

  const shifts = [
    {
      castId: "43317",
      date: "2025-09-20",
      time: "13:00〜25:00",
      room: "ラズroom",
      hasData: true
    },
    {
      castId: "22121",
      date: "2025-09-14",
      time: "13:00〜25:00",
      room: "ラズroom",
      hasData: true
    },
    {
      castId: "22121",
      date: "2025-09-15",
      time: "13:00〜25:00",
      room: "ラズroom",
      hasData: true
    },
    {
      castId: "22121",
      date: "2025-09-16",
      time: "13:00〜25:00",
      room: "ラズroom",
      hasData: true
    },
    {
      castId: "22121",
      date: "2025-09-17",
      time: "13:00〜25:00",
      room: "ラズroom",
      hasData: true
    },
  ];

  const filteredCasts = casts.filter(cast => 
    cast.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabMenuItems = [
    { label: "シフト登録", href: "/shift", active: true },
    { label: "シフト表", href: "/shift/view", active: false },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-full">
            <div className="mb-5">
              <h2 className="text-lg font-normal m-0 p-0">シフト</h2>
            </div>

            {/* Tab Menu */}
            <div className="border-b border-border mb-4 px-2">
              <div className="flex">
                {tabMenuItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`inline-block w-auto py-2.5 px-6 text-center border-l border-t border-r border-border rounded-t-md -mb-px text-xs ${
                      item.active 
                        ? "bg-muted/50" 
                        : "bg-background hover:bg-muted/30"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="p-2">
              {/* Date Navigation */}
              <table className="mb-1">
                <tr>
                  <td>
                    <a href="/shift?start_day=2025-09-07" className="inline-block border border-blue-400 text-blue-600 py-1 px-2 text-xs no-underline rounded-l-full">
                      <ChevronLeft size={12} className="inline mr-1" />1週間前
                    </a>
                  </td>
                  <td>
                    <input 
                      type="text" 
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                      className="form-control h-8 w-32 px-2 text-center border border-input rounded-md"
                    />
                  </td>
                  <td>
                    <a href="/shift?start_day=2025-09-21" className="inline-block border border-blue-400 text-blue-600 py-1 px-2 text-xs no-underline rounded-r-full">
                      1週間後<ChevronRight size={12} className="inline ml-1" />
                    </a>
                  </td>
                </tr>
              </table>

              {/* Search */}
              <div className="py-1 mb-4">
                <div className="flex max-w-64">
                  <Input
                    type="text"
                    placeholder="キャスト名"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button type="submit" size="sm" className="ml-1 h-8">
                    検索
                  </Button>
                </div>
              </div>
            </div>

            <div className="border-t border-border">
              <ShiftCalendar 
                dates={dates}
                casts={filteredCasts}
                shifts={shifts}
              />
            </div>

            <div className="p-2 text-xs">
              <a href="/schedule" className="text-foreground">
                表示を切り替える
              </a>
            </div>
          </div>
        </div>
        
        <footer className="mt-auto py-4 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-muted-foreground">
              © 2025 caskan.jp All rights reserved
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Shift;