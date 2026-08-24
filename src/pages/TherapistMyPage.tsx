import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, KeyRound, Copy, ExternalLink, RefreshCw } from "lucide-react";

interface Therapist {
  id: string;
  name: string;
  access_token?: string | null;
}

export default function TherapistMyPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Therapist | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [generating, setGenerating] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { store: adminStore } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && adminStore?.id) fetchTherapists();
  }, [user, adminStore?.id]);

  const fetchTherapists = async () => {
    setLoading(true);
    const [castsResult, tokensResult] = await Promise.all([
      supabase
        .from("casts")
        .select("id, name")
        .eq("store_id", adminStore!.id)
        .eq("is_active", true)
        .order("name"),
      supabase.rpc("get_cast_access_tokens"),
    ]);
    if (castsResult.error || tokensResult.error) {
      toast.error(`読み込みに失敗しました: ${(castsResult.error || tokensResult.error)?.message}`);
    } else {
      const tokenMap = new Map(
        (tokensResult.data || []).map((row) => [row.cast_id, row.access_token]),
      );
      const list = (castsResult.data || []).map((cast) => ({
        ...cast,
        access_token: tokenMap.get(cast.id) || null,
      })) as Therapist[];
      setTherapists(list);
      if (selected) {
        const updated = list.find((t) => t.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
    setLoading(false);
  };

  const handleGenerateToken = async () => {
    if (!selected) return;
    setGenerating(true);
    const token = crypto.randomUUID();
    const { error } = await supabase.rpc("set_cast_access_token", {
      p_cast_id: selected.id,
      p_token: token,
    });
    setGenerating(false);
    if (error) {
      toast.error(`リンクの発行に失敗しました: ${error.message}`);
      return;
    }
    toast.success("リンクを発行しました");
    await fetchTherapists();
  };

  // 店舗の独自ドメインがあればそれを優先（艶華なら enka-salon.jp、無ければ従来の全社URL）
  const portalBase = adminStore?.custom_domain
    ? `https://${adminStore.custom_domain}`
    : (import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin);
  const portalLink = (token: string) => `${portalBase}/therapist/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(portalLink(token));
    toast.success("リンクをコピーしました");
  };

  const filtered = therapists.filter((t) => t.name?.includes(searchQuery));

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">セラピスト マイページ</h1>
            <p className="text-muted-foreground text-sm">各セラピストのマイページアクセス管理</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left: therapist list */}
            <div>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              {loading ? (
                <div className="text-center text-muted-foreground py-4 text-sm">読み込み中...</div>
              ) : (
                <div className="space-y-0.5">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                        selected?.id === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      {t.access_token && (
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${selected?.id === t.id ? "bg-primary-foreground/60" : "bg-green-500"}`} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: selected therapist detail */}
            <div className="lg:col-span-3">
              {selected ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">{selected.name}</h2>

                  <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <KeyRound size={16} className="text-primary" />
                        マイページアクセスリンク
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selected.access_token ? (
                        <>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono truncate">
                              {portalLink(selected.access_token)}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyLink(selected.access_token!)}
                              className="shrink-0"
                            >
                              <Copy size={13} className="mr-1" />コピー
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(portalLink(selected.access_token!), "_blank")}
                              className="shrink-0"
                            >
                              <ExternalLink size={13} />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateToken}
                            disabled={generating}
                          >
                            <RefreshCw size={13} className="mr-1.5" />
                            {generating ? "発行中..." : "リンクを再発行する"}
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground mb-4">
                            まだリンクが発行されていません
                          </p>
                          <Button onClick={handleGenerateToken} disabled={generating}>
                            <KeyRound size={14} className="mr-2" />
                            {generating ? "発行中..." : "リンクを発行する"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                    左からセラピストを選択してください
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
