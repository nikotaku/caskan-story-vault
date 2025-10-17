import { useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CastSalary {
  cast_id: string;
  cast_name: string;
  total_salary: number;
}

export default function Salary() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [salaries, setSalaries] = useState<CastSalary[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSalaries();
    }
  }, [user, selectedDate]);

  const fetchSalaries = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get shifts for the selected date
      const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select(`
          cast_id,
          casts (name)
        `)
        .eq('shift_date', dateStr);

      if (shiftsError) throw shiftsError;

      // Get reservations for the selected date
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          cast_id,
          price,
          casts (name)
        `)
        .eq('reservation_date', dateStr)
        .in('status', ['confirmed', 'completed']);

      if (reservationsError) throw reservationsError;

      // Calculate salary per cast (assuming 50% of reservation price)
      const salaryMap = new Map<string, CastSalary>();

      reservations?.forEach(reservation => {
        if (reservation.casts && Array.isArray(reservation.casts) && reservation.casts[0]) {
          const castName = reservation.casts[0].name;
          const salary = Math.floor(reservation.price * 0.5); // 50% commission
          
          const existing = salaryMap.get(reservation.cast_id);
          if (existing) {
            existing.total_salary += salary;
          } else {
            salaryMap.set(reservation.cast_id, {
              cast_id: reservation.cast_id,
              cast_name: castName,
              total_salary: salary,
            });
          }
        }
      });

      // Add casts with shifts but no reservations
      shifts?.forEach(shift => {
        if (shift.casts && Array.isArray(shift.casts) && shift.casts[0]) {
          const castName = shift.casts[0].name;
          if (!salaryMap.has(shift.cast_id)) {
            salaryMap.set(shift.cast_id, {
              cast_id: shift.cast_id,
              cast_name: castName,
              total_salary: 0,
            });
          }
        }
      });

      setSalaries(Array.from(salaryMap.values()).sort((a, b) => 
        a.cast_name.localeCompare(b.cast_name)
      ));
    } catch (error) {
      console.error('Error fetching salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-6 md:ml-[240px]">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">給与</h1>
              
              {/* Date Navigation */}
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button variant="outline" onClick={handlePreviousDay}>
                  <ChevronLeft className="h-4 w-4" />
                  前の日
                </Button>
                
                <div className="text-lg font-medium min-w-[200px] text-center">
                  {format(selectedDate, 'yyyy-MM-dd', { locale: ja })}
                </div>
                
                <Button variant="outline" onClick={handleNextDay}>
                  次の日
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Salary List */}
            <Card>
              <CardHeader>
                <CardTitle>キャスト</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {salaries.map((salary) => (
                    <div 
                      key={salary.cast_id}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="font-medium">{salary.cast_name}</div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-bold">
                          ¥{salary.total_salary.toLocaleString()}
                        </div>
                        <Button 
                          variant="link" 
                          className="text-primary"
                          onClick={() => {
                            // Navigate to detailed salary page (to be implemented)
                            console.log('詳細', salary.cast_id);
                          }}
                        >
                          詳細
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {salaries.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      この日のシフト・予約データがありません
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
