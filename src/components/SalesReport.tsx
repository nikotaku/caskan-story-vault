import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfToday, endOfToday, startOfYesterday, endOfYesterday, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";

interface SalesData {
  period: string;
  amount: string;
  reservations: number;
}

export const SalesReport = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([
    { period: "本日", amount: "0円", reservations: 0 },
    { period: "昨日", amount: "0円", reservations: 0 },
    { period: "今月", amount: "0円", reservations: 0 },
    { period: "昨月", amount: "0円", reservations: 0 }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      const today = new Date();
      const yesterday = subMonths(today, 0);
      
      // Fetch today's data
      const { data: todayData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfToday(), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfToday(), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      // Fetch yesterday's data
      const { data: yesterdayData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfYesterday(), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfYesterday(), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      // Fetch this month's data
      const { data: thisMonthData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfMonth(today), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfMonth(today), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      // Fetch last month's data
      const lastMonth = subMonths(today, 1);
      const { data: lastMonthData } = await supabase
        .from('reservations')
        .select('price')
        .gte('reservation_date', format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        .lte('reservation_date', format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
        .in('status', ['confirmed', 'completed']);

      const calculateTotal = (data: any[] | null) => {
        if (!data) return { total: 0, count: 0 };
        return {
          total: data.reduce((sum, item) => sum + (item.price || 0), 0),
          count: data.length
        };
      };

      const todayStats = calculateTotal(todayData);
      const yesterdayStats = calculateTotal(yesterdayData);
      const thisMonthStats = calculateTotal(thisMonthData);
      const lastMonthStats = calculateTotal(lastMonthData);

      setSalesData([
        {
          period: "本日",
          amount: `${todayStats.total.toLocaleString()}円`,
          reservations: todayStats.count
        },
        {
          period: "昨日",
          amount: `${yesterdayStats.total.toLocaleString()}円`,
          reservations: yesterdayStats.count
        },
        {
          period: "今月",
          amount: `${thisMonthStats.total.toLocaleString()}円`,
          reservations: thisMonthStats.count
        },
        {
          period: "昨月",
          amount: `${lastMonthStats.total.toLocaleString()}円`,
          reservations: lastMonthStats.count
        }
      ]);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <h3 className="font-semibold text-sm mb-4">売上</h3>
          <div className="text-center py-4 text-muted-foreground">読み込み中...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="font-semibold text-sm mb-4">売上</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {salesData.map((data, index) => (
            <div key={index} className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {data.period}
              </div>
              <div className="text-xl font-medium">
                {data.amount}
              </div>
              <div className="text-sm text-primary">
                <span className="text-xs text-muted-foreground mr-2">予約</span>
                {data.reservations}件
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};