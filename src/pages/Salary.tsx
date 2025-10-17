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
  reservation_count: number;
  details: {
    course_back: number;
    option_back: number;
    nomination_back: number;
  };
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

      // Get reservations with all details
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select(`
          cast_id,
          price,
          duration,
          course_type,
          options,
          nomination_type,
          casts (name)
        `)
        .eq('reservation_date', dateStr)
        .in('status', ['confirmed', 'completed']);

      if (reservationsError) throw reservationsError;

      // Fetch rate tables
      const { data: backRates } = await supabase
        .from('back_rates')
        .select('*');
      
      const { data: optionRates } = await supabase
        .from('option_rates')
        .select('*');
      
      const { data: nominationRates } = await supabase
        .from('nomination_rates')
        .select('*');

      // Calculate salary per cast based on back rates
      const salaryMap = new Map<string, CastSalary>();

      reservations?.forEach(reservation => {
        if (reservation.casts && Array.isArray(reservation.casts) && reservation.casts[0]) {
          const castName = reservation.casts[0].name;
          
          // Calculate base course back
          let courseBack = 0;
          const matchingRate = backRates?.find(
            rate => rate.course_type === reservation.course_type && 
                    rate.duration === reservation.duration
          );
          if (matchingRate) {
            courseBack = matchingRate.therapist_back;
          }

          // Calculate options back
          let optionBack = 0;
          if (reservation.options && Array.isArray(reservation.options)) {
            reservation.options.forEach(optionName => {
              const matchingOption = optionRates?.find(opt => opt.option_name === optionName);
              if (matchingOption) {
                optionBack += matchingOption.therapist_back;
              }
            });
          }

          // Calculate nomination back
          let nominationBack = 0;
          if (reservation.nomination_type) {
            const matchingNomination = nominationRates?.find(
              nom => nom.nomination_type === reservation.nomination_type
            );
            if (matchingNomination && matchingNomination.therapist_back) {
              nominationBack = matchingNomination.therapist_back;
            }
          }

          const totalSalary = courseBack + optionBack + nominationBack;
          
          const existing = salaryMap.get(reservation.cast_id);
          if (existing) {
            existing.total_salary += totalSalary;
            existing.reservation_count += 1;
            existing.details.course_back += courseBack;
            existing.details.option_back += optionBack;
            existing.details.nomination_back += nominationBack;
          } else {
            salaryMap.set(reservation.cast_id, {
              cast_id: reservation.cast_id,
              cast_name: castName,
              total_salary: totalSalary,
              reservation_count: 1,
              details: {
                course_back: courseBack,
                option_back: optionBack,
                nomination_back: nominationBack,
              },
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
              reservation_count: 0,
              details: {
                course_back: 0,
                option_back: 0,
                nomination_back: 0,
              },
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
                      className="p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <div className="font-medium text-lg">{salary.cast_name}</div>
                          <div className="text-sm text-muted-foreground">
                            予約: {salary.reservation_count}件
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ¥{salary.total_salary.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {salary.reservation_count > 0 && (
                        <div className="mt-3 pt-3 border-t text-sm space-y-1">
                          <div className="flex justify-between text-muted-foreground">
                            <span>コースバック:</span>
                            <span>¥{salary.details.course_back.toLocaleString()}</span>
                          </div>
                          {salary.details.option_back > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>オプションバック:</span>
                              <span>¥{salary.details.option_back.toLocaleString()}</span>
                            </div>
                          )}
                          {salary.details.nomination_back > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>指名バック:</span>
                              <span>¥{salary.details.nomination_back.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      )}
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
