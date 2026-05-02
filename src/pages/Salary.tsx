import React, { useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const EXPENSE_TYPES = ["雑費", "宿泊費", "交通費"] as const;
const AMOUNT_OPTIONS = Array.from({ length: 30 }, (_, i) => (i + 1) * 1000);

interface ReservationDetail {
  course_type: string | null;
  duration: number;
  payment_method: string;
  customer_price: number;
  course_back: number;
  course_shop: number;
  option_back: number;
  option_shop: number;
  nomination_back: number;
  nomination_shop: number;
  total_therapist: number;
  total_shop: number;
}

interface ExpenseDetail {
  id: string;
  expense_type: string;
  therapist_amount: number;
  shop_amount: number;
}

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
  reservations: ReservationDetail[];
  expenses: ExpenseDetail[];
  total_expense_therapist: number;
  total_expense_shop: number;
}

export default function Salary() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [salaries, setSalaries] = useState<CastSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCastId, setExpandedCastId] = useState<string | null>(null);
  const [expenseForms, setExpenseForms] = useState<Record<string, { type: string; amount: string; custom: string; saving: boolean }>>({});

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const getForm = (castId: string) =>
    expenseForms[castId] ?? { type: "雑費", amount: "1000", custom: "", saving: false };

  const updateForm = (castId: string, patch: Partial<{ type: string; amount: string; custom: string; saving: boolean }>) => {
    setExpenseForms(prev => ({ ...prev, [castId]: { ...getForm(castId), ...patch } }));
  };

  const handleAddExpense = async (castId: string) => {
    const form = getForm(castId);
    const isCustom = form.type === "その他手当";
    const isMisc = form.type === "雑費";
    const amount = isMisc ? 1000 : (isCustom ? parseInt(form.custom, 10) : parseInt(form.amount, 10));
    if (!amount || isNaN(amount) || amount <= 0) {
      toast({ title: "金額を入力してください", variant: "destructive" });
      return;
    }
    if (isMisc) {
      const castEntry = salaries.find(s => s.cast_id === castId);
      const currentMiscTotal = castEntry?.expenses
        .filter(e => e.expense_type === "雑費")
        .reduce((sum, e) => sum + (e.amount || 0), 0) ?? 0;
      if (currentMiscTotal + 1000 > 2000) {
        toast({ title: "雑費は1日2,000円までです", variant: "destructive" });
        return;
      }
    }
    updateForm(castId, { saving: true });
    try {
      const { error } = await supabase.from("expenses").insert({
        cast_id: castId,
        expense_date: format(selectedDate, "yyyy-MM-dd"),
        expense_type: form.type,
        amount,
      });
      if (error) throw error;
      toast({ title: "登録しました" });
      updateForm(castId, { custom: "", saving: false });
      await fetchSalaries();
    } catch (e: any) {
      toast({ title: "登録失敗", description: e.message, variant: "destructive" });
      updateForm(castId, { saving: false });
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("この経費・手当を削除しますか？")) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
      toast({ title: "削除しました" });
      await fetchSalaries();
    } catch (e: any) {
      toast({ title: "削除失敗", description: e.message, variant: "destructive" });
    }
  };
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
          payment_method,
          casts (name)
        `)
        .eq('reservation_date', dateStr)
        .in('status', ['confirmed', 'completed']);

      if (reservationsError) throw reservationsError;

      // Fetch rate tables and expenses
      const [{ data: backRates }, { data: optionRates }, { data: nominationRates }, { data: expenses }, { data: expenseRates }] = await Promise.all([
        supabase.from('back_rates').select('*'),
        supabase.from('option_rates').select('*'),
        supabase.from('nomination_rates').select('*'),
        supabase.from('expenses').select('*').eq('expense_date', dateStr),
        supabase.from('expense_rates').select('*'),
      ]);

      // Calculate salary per cast based on back rates
      const salaryMap = new Map<string, CastSalary>();

      reservations?.forEach(reservation => {
        const castData = reservation.casts as any;
        const castName = Array.isArray(castData) ? castData[0]?.name : castData?.name;
        if (castName) {
          // Calculate base course back
          let courseBack = 0;
          let courseShop = 0;
          let customerPrice = 0;
          const matchingRate = backRates?.find(
            rate => rate.course_type === reservation.course_type && 
                    rate.duration === reservation.duration
          );
          if (matchingRate) {
            courseBack = matchingRate.therapist_back;
            courseShop = matchingRate.shop_back;
            customerPrice = matchingRate.customer_price;
          }

          // Calculate options back
          let optionBack = 0;
          let optionShop = 0;
          if (reservation.options && Array.isArray(reservation.options)) {
            reservation.options.forEach(optionName => {
              const matchingOption = optionRates?.find(opt => opt.option_name === optionName);
              if (matchingOption) {
                optionBack += matchingOption.therapist_back;
                optionShop += matchingOption.shop_back || 0;
              }
            });
          }

          // Calculate nomination back
          let nominationBack = 0;
          let nominationShop = 0;
          if (reservation.nomination_type) {
            const matchingNomination = nominationRates?.find(
              nom => nom.nomination_type === reservation.nomination_type
            );
            if (matchingNomination) {
              nominationBack = matchingNomination.therapist_back || 0;
              nominationShop = matchingNomination.shop_back || 0;
            }
          }

          const totalTherapist = courseBack + optionBack + nominationBack;
          const totalShop = courseShop + optionShop + nominationShop;

          const resDetail: ReservationDetail = {
            course_type: reservation.course_type,
            duration: reservation.duration,
            payment_method: (reservation as any).payment_method || '現金',
            customer_price: customerPrice,
            course_back: courseBack,
            course_shop: courseShop,
            option_back: optionBack,
            option_shop: optionShop,
            nomination_back: nominationBack,
            nomination_shop: nominationShop,
            total_therapist: totalTherapist,
            total_shop: totalShop,
          };
          
          const existing = salaryMap.get(reservation.cast_id);
          if (existing) {
            existing.total_salary += totalTherapist;
            existing.reservation_count += 1;
            existing.details.course_back += courseBack;
            existing.details.option_back += optionBack;
            existing.details.nomination_back += nominationBack;
            existing.reservations.push(resDetail);
          } else {
            salaryMap.set(reservation.cast_id, {
              cast_id: reservation.cast_id,
              cast_name: castName,
              total_salary: totalTherapist,
              reservation_count: 1,
              details: {
                course_back: courseBack,
                option_back: optionBack,
                nomination_back: nominationBack,
              },
              reservations: [resDetail],
              expenses: [],
              total_expense_therapist: 0,
              total_expense_shop: 0,
            });
          }
        }
      });

      // Add casts with shifts but no reservations
      shifts?.forEach(shift => {
        const castData = shift.casts as any;
        const castName = Array.isArray(castData) ? castData[0]?.name : castData?.name;
        if (castName && !salaryMap.has(shift.cast_id)) {
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
            reservations: [],
            expenses: [],
            total_expense_therapist: 0,
            total_expense_shop: 0,
          });
        }
      });

      // Apply expenses per cast
      expenses?.forEach(expense => {
        if (!expense.cast_id) return;
        const castEntry = salaryMap.get(expense.cast_id);
        if (!castEntry) return;
        
        // Find matching expense rate
        const matchingRate = expenseRates?.find(r => r.expense_type === expense.expense_type);
        let therapistAmount = 0;
        let shopAmount = 0;
        if (matchingRate) {
          therapistAmount = matchingRate.therapist_deduction;
          shopAmount = matchingRate.shop_income;
        } else {
          // Fallback: use the entered amount. 手当はプラス、雑費・交通費・宿泊費はマイナス（控除）
          const amt = expense.amount || 0;
          if (expense.expense_type === 'その他手当') {
            therapistAmount = amt;
            shopAmount = -amt;
          } else {
            therapistAmount = -amt;
            shopAmount = amt;
          }
        }

        castEntry.expenses.push({
          id: expense.id,
          expense_type: expense.expense_type,
          therapist_amount: therapistAmount,
          shop_amount: shopAmount,
        });
        castEntry.total_expense_therapist += therapistAmount;
        castEntry.total_expense_shop += shopAmount;
        castEntry.total_salary += therapistAmount;
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
                      className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      onClick={() => setExpandedCastId(expandedCastId === salary.cast_id ? null : salary.cast_id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-lg">{salary.cast_name}</div>
                          <div className="text-sm text-muted-foreground">
                            予約: {salary.reservation_count}件
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div className="text-2xl font-bold">
                            ¥{salary.total_salary.toLocaleString()}
                          </div>
                          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedCastId === salary.cast_id ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      
                      {expandedCastId === salary.cast_id && (
                        <div className="mt-3 pt-3 border-t text-sm space-y-3">
                          {salary.reservations.map((res, idx) => (
                            <div key={idx} className="p-3 bg-muted/50 rounded space-y-2">
                              <div className="flex justify-between items-center font-medium">
                                <span>{res.course_type || '不明'} {res.duration}分</span>
                                <span className="px-2 py-0.5 rounded bg-muted text-xs">{res.payment_method}</span>
                              </div>
                              {res.customer_price > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  お客様料金: ¥{res.customer_price.toLocaleString()}
                                </div>
                              )}
                              <div className="grid grid-cols-3 gap-1 text-xs">
                                <div className="font-medium text-muted-foreground"></div>
                                <div className="text-center font-medium text-muted-foreground">セラピスト</div>
                                <div className="text-center font-medium text-muted-foreground">店舗</div>
                                
                                <div className="text-muted-foreground">コース</div>
                                <div className="text-center">¥{res.course_back.toLocaleString()}</div>
                                <div className="text-center">¥{res.course_shop.toLocaleString()}</div>
                                
                                {(res.option_back > 0 || res.option_shop > 0) && (
                                  <>
                                    <div className="text-muted-foreground">オプション</div>
                                    <div className="text-center">¥{res.option_back.toLocaleString()}</div>
                                    <div className="text-center">¥{res.option_shop.toLocaleString()}</div>
                                  </>
                                )}
                                {(res.nomination_back > 0 || res.nomination_shop > 0) && (
                                  <>
                                    <div className="text-muted-foreground">指名</div>
                                    <div className="text-center">¥{res.nomination_back.toLocaleString()}</div>
                                    <div className="text-center">¥{res.nomination_shop.toLocaleString()}</div>
                                  </>
                                )}
                                
                                <div className="font-medium border-t pt-1">合計</div>
                                <div className="text-center font-medium border-t pt-1">¥{res.total_therapist.toLocaleString()}</div>
                                <div className="text-center font-medium border-t pt-1">¥{res.total_shop.toLocaleString()}</div>
                              </div>
                            </div>
                          ))}

                          {/* 経費・手当 入力 */}
                          {(() => {
                            const form = getForm(salary.cast_id);
                            const isCustom = form.type === "その他手当";
                            return (
                              <div className="p-3 bg-muted/30 border rounded space-y-2" onClick={(e) => e.stopPropagation()}>
                                <div className="font-medium text-sm">経費・手当を追加</div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">種類</Label>
                                    <Select value={form.type} onValueChange={(v) => updateForm(salary.cast_id, { type: v })}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {EXPENSE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        <SelectItem value="その他手当">その他手当</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">金額</Label>
                                    {isCustom ? (
                                      <Input
                                        type="number"
                                        placeholder="自由入力"
                                        value={form.custom}
                                        onChange={(e) => updateForm(salary.cast_id, { custom: e.target.value })}
                                      />
                                    ) : (
                                      <Select value={form.amount} onValueChange={(v) => updateForm(salary.cast_id, { amount: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent className="max-h-60">
                                          {AMOUNT_OPTIONS.map(a => (
                                            <SelectItem key={a} value={String(a)}>¥{a.toLocaleString()}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className="flex items-end">
                                    <Button
                                      className="w-full"
                                      disabled={form.saving}
                                      onClick={() => handleAddExpense(salary.cast_id)}
                                    >
                                      {form.saving ? "登録中..." : "追加"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 経費控除 */}
                          {salary.expenses.length > 0 && (
                            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded space-y-2" onClick={(e) => e.stopPropagation()}>
                              <div className="font-medium text-destructive">経費・手当</div>
                              <div className="space-y-1">
                                {salary.expenses.map((exp) => (
                                  <div key={exp.id} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                                    <div className="flex-1 text-muted-foreground">{exp.expense_type}</div>
                                    <div className="w-20 text-right">セ ¥{exp.therapist_amount.toLocaleString()}</div>
                                    <div className="w-20 text-right">店 ¥{exp.shop_amount.toLocaleString()}</div>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteExpense(exp.id)}
                                      aria-label="削除"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ))}
                                <div className="flex items-center gap-2 text-xs pt-1 font-medium">
                                  <div className="flex-1">経費合計</div>
                                  <div className="w-20 text-right">セ ¥{salary.total_expense_therapist.toLocaleString()}</div>
                                  <div className="w-20 text-right">店 ¥{salary.total_expense_shop.toLocaleString()}</div>
                                  <div className="w-7" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 最終合計 */}
                          {(salary.reservation_count > 0 || salary.expenses.length > 0) && (
                            <div className="p-3 bg-primary/5 border border-primary/20 rounded">
                              <div className="flex justify-between items-center text-sm font-bold">
                                <span>最終支給額</span>
                                <span className="text-lg">¥{salary.total_salary.toLocaleString()}</span>
                              </div>
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
