import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, User, Crown } from "lucide-react";

const ShiftSubmission = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [therapistName, setTherapistName] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 8, 1)); // September 2025

  const shiftTypes = [
    { id: "early1", label: "早番❶", time: "11:00〜15:00", emoji: "🌅" },
    { id: "early2", label: "早番❷", time: "12:00〜17:00", emoji: "☀️" },
    { id: "late1", label: "遅番❶", time: "16:00〜23:00", emoji: "🌆" },
    { id: "late2", label: "遅番❷", time: "18:00〜23:00", emoji: "🌙" },
    { id: "full", label: "通し出勤", time: "❶+❷組み合わせ", emoji: "💪" },
  ];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Previous month's last days
    const prevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonth - i,
        isCurrentMonth: false,
        date: `${year}-${String(month).padStart(2, '0')}-${String(prevMonth - i).padStart(2, '0')}`
      });
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
    
    // Next month's first days
    const remainingCells = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingCells; day++) {
      days.push({
        day,
        isCurrentMonth: false,
        date: `${year}-${String(month + 2).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const formatMonth = (date: Date) => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  const days = getDaysInMonth(currentMonth);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-purple-800 mb-2">
                🧘‍♀️ セラピスト提出用<Crown className="inline w-6 h-6 text-yellow-500 ml-2" /> 管理画面
              </h1>
              <h2 className="text-xl text-purple-600 mb-6">💆‍♀️ シフト提出システム</h2>
              <p className="text-gray-600">希望シフトを入力してください</p>
            </div>

            {/* Therapist Name Input */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-purple-600" />
                  <label className="font-medium text-purple-800">源氏名を入力してください</label>
                </div>
                <Input
                  type="text"
                  placeholder="源氏名"
                  value={therapistName}
                  onChange={(e) => setTherapistName(e.target.value)}
                  className="w-full"
                />
              </CardContent>
            </Card>

            {/* Shift Types */}
            <Card className="mb-6">
              <CardHeader>
                <h3 className="text-lg font-semibold text-purple-800">シフト種類</h3>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {shiftTypes.map((shift) => (
                  <Button
                    key={shift.id}
                    variant={selectedShift === shift.id ? "default" : "outline"}
                    className={`h-auto p-3 text-left justify-start ${
                      selectedShift === shift.id 
                        ? "bg-purple-600 hover:bg-purple-700" 
                        : "hover:bg-purple-50"
                    }`}
                    onClick={() => setSelectedShift(shift.id)}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <span>{shift.emoji}</span>
                        <span>{shift.label}</span>
                      </div>
                      <div className="text-sm opacity-80">{shift.time}</div>
                    </div>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Calendar */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    前月
                  </Button>
                  <h3 className="text-xl font-bold text-purple-800">
                    {formatMonth(currentMonth)}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    次月
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Week Header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {weekDays.map((day, index) => (
                    <div 
                      key={day} 
                      className={`text-center font-semibold py-2 ${
                        index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-700'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map((dayInfo, index) => (
                    <Button
                      key={`${dayInfo.date}-${index}`}
                      variant="ghost"
                      className={`h-12 p-1 text-sm ${
                        !dayInfo.isCurrentMonth 
                          ? 'text-gray-300 hover:text-gray-400' 
                          : selectedDate === dayInfo.date
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'hover:bg-purple-50'
                      } ${
                        index % 7 === 0 && dayInfo.isCurrentMonth ? 'text-red-500' :
                        index % 7 === 6 && dayInfo.isCurrentMonth ? 'text-blue-500' : ''
                      }`}
                      onClick={() => dayInfo.isCurrentMonth && setSelectedDate(dayInfo.date)}
                      disabled={!dayInfo.isCurrentMonth}
                    >
                      {dayInfo.day}
                    </Button>
                  ))}
                </div>

                {/* Selected Date Info */}
                {selectedDate && selectedShift && (
                  <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">選択中のシフト</h4>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        日付: {selectedDate}
                      </Badge>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        シフト: {shiftTypes.find(s => s.id === selectedShift)?.label}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="mt-6 text-center">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-8"
                    disabled={!therapistName || !selectedDate || !selectedShift}
                  >
                    🚀 シフト提出
                  </Button>
                </div>
              </CardContent>
            </Card>
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

export default ShiftSubmission;