import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Mail, Calendar, CreditCard, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface Customer {
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  total_visits: number;
  total_spent: number;
  last_visit: string | null;
  first_visit: string;
}

const Customers = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCustomers();
    }
  }, [user]);

  const fetchCustomers = async () => {
    try {
      // 予約テーブルから顧客情報を集計
      const { data, error } = await supabase
        .from("reservations")
        .select("customer_name, customer_phone, customer_email, price, reservation_date, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 顧客ごとにデータを集計
      const customerMap = new Map<string, Customer>();

      data?.forEach((reservation) => {
        const key = `${reservation.customer_name}-${reservation.customer_phone}`;
        
        if (customerMap.has(key)) {
          const existing = customerMap.get(key)!;
          existing.total_visits += 1;
          existing.total_spent += reservation.price;
          
          if (reservation.reservation_date > (existing.last_visit || "")) {
            existing.last_visit = reservation.reservation_date;
          }
          if (reservation.created_at < existing.first_visit) {
            existing.first_visit = reservation.created_at;
          }
        } else {
          customerMap.set(key, {
            customer_name: reservation.customer_name,
            customer_phone: reservation.customer_phone,
            customer_email: reservation.customer_email,
            total_visits: 1,
            total_spent: reservation.price,
            last_visit: reservation.reservation_date,
            first_visit: reservation.created_at,
          });
        }
      });

      setCustomers(Array.from(customerMap.values()));
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "エラー",
        description: "顧客情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_phone.includes(searchTerm) ||
      (customer.customer_email && customer.customer_email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="pt-[60px] md:ml-[240px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-7xl mx-auto">
            <div className="mb-5">
              <h2 className="text-lg font-normal m-0 p-0">顧客管理</h2>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="顧客名、電話番号、メールアドレスで検索"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 mb-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">総顧客数</p>
                      <p className="text-2xl font-bold">{customers.length}</p>
                    </div>
                    <User className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">総予約数</p>
                      <p className="text-2xl font-bold">
                        {customers.reduce((sum, c) => sum + c.total_visits, 0)}
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">総売上</p>
                      <p className="text-2xl font-bold">
                        ¥{customers.reduce((sum, c) => sum + c.total_spent, 0).toLocaleString()}
                      </p>
                    </div>
                    <CreditCard className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4">
              {filteredCustomers.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">顧客情報がありません</p>
                  </CardContent>
                </Card>
              ) : (
                filteredCustomers.map((customer, index) => (
                  <Card key={`${customer.customer_phone}-${index}`}>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User size={16} className="text-muted-foreground" />
                              <span className="font-semibold text-lg">{customer.customer_name}</span>
                              <Badge variant="secondary">
                                {customer.total_visits}回来店
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone size={14} />
                              <span>{customer.customer_phone}</span>
                            </div>
                            {customer.customer_email && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail size={14} />
                                <span>{customer.customer_email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">総支払額</p>
                            <p className="font-semibold text-lg">
                              ¥{customer.total_spent.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">最終来店日</p>
                            <p className="font-semibold">
                              {customer.last_visit
                                ? format(new Date(customer.last_visit), "yyyy年M月d日", { locale: ja })
                                : "未来店"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">初回来店日</p>
                            <p className="font-semibold">
                              {format(new Date(customer.first_visit), "yyyy年M月d日", { locale: ja })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">平均単価</p>
                            <p className="font-semibold">
                              ¥{Math.round(customer.total_spent / customer.total_visits).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
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

export default Customers;
