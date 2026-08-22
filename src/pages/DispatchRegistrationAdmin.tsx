import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Link as LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { supabase } from "@/integrations/supabase/client";

interface DispatchRegistration {
  id: string;
  name: string;
  dispatch_start: string;
  dispatch_end: string;
  entry_source: string;
  created_at: string;
}

export default function DispatchRegistrationAdmin() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [token, setToken] = useState("");
  const [registrations, setRegistrations] = useState<DispatchRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { store, storeId, loading: storeLoading } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/login");
  }, [authLoading, isAdmin, navigate, user]);

  useEffect(() => {
    if (!user || !isAdmin || storeLoading) return;

    const load = async () => {
      setLoading(true);
      let { data: form, error: formError } = await supabase
        .from("dispatch_registration_forms")
        .select("token")
        .eq("store_id", storeId)
        .maybeSingle();

      if (!form && !formError) {
        const result = await supabase
          .from("dispatch_registration_forms")
          .insert({ store_id: storeId })
          .select("token")
          .single();
        form = result.data;
        formError = result.error;
      }

      const { data: rows, error: rowsError } = await supabase
        .from("dispatch_registrations")
        .select("id,name,dispatch_start,dispatch_end,entry_source,created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });

      if (formError || rowsError) {
        toast.error("派遣登録フォームの読み込みに失敗しました");
      } else {
        setToken((form as { token?: string } | null)?.token ?? "");
        setRegistrations((rows ?? []) as DispatchRegistration[]);
      }
      setLoading(false);
    };

    void load();
  }, [isAdmin, storeId, storeLoading, user]);

  const formUrl = useMemo(() => {
    if (!token) return "";
    const base = store?.custom_domain
      ? `https://${store.custom_domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
      : window.location.origin;
    return `${base}/dispatch-registration/${token}`;
  }, [store?.custom_domain, token]);

  const copyLink = async () => {
    if (!formUrl) return;
    await navigator.clipboard.writeText(formUrl);
    toast.success("派遣登録フォームのリンクをコピーしました");
  };

  if (authLoading || storeLoading || loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[76px] px-4 pb-8 md:ml-[240px] md:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold">派遣登録フォーム</h1>
            <p className="text-sm text-muted-foreground">派遣予定のセラピストへ、このリンクを送ってください。</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><LinkIcon className="h-5 w-5" />共有リンク</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={formUrl} readOnly aria-label="派遣登録フォームの共有リンク" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button onClick={copyLink}><Copy className="mr-2 h-4 w-4" />リンクをコピー</Button>
                <Button variant="outline" onClick={() => window.open(formUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="mr-2 h-4 w-4" />フォームを開く
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">送信された内容</CardTitle></CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">まだ登録はありません。</p>
              ) : (
                <div className="space-y-3">
                  {registrations.map((registration) => (
                    <div key={registration.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{registration.name}</p>
                        <Badge variant="secondary">{registration.entry_source}</Badge>
                      </div>
                      <p className="mt-2 text-sm">{registration.dispatch_start} 〜 {registration.dispatch_end}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        送信: {format(new Date(registration.created_at), "yyyy/M/d HH:mm", { locale: ja })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
