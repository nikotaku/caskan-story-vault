import { useState } from "react";
import { Menu, User, LogOut, Loader2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { useToast } from "@/hooks/use-toast";
import { CtiCallPopup } from "@/components/CtiCallPopup";
import caskanLogo from "@/assets/caskan-logo.png";
import { STORE_DEFS, otherStore, switchToStore, ZENRYOKU_STORE_ID } from "@/lib/storeSwitch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardHeaderProps {
  onToggleSidebar: () => void;
}

export const DashboardHeader = ({ onToggleSidebar }: DashboardHeaderProps) => {
  const { user, signOut, isAdmin } = useAuth();
  const { store: adminStore } = useAdminStore();
  const { toast } = useToast();
  const [switching, setSwitching] = useState(false);

  // 過去データ以外は店舗ごとのアイコンに切り替える
  const currentStoreId = adminStore?.id ?? ZENRYOKU_STORE_ID;
  const isDefaultStore = currentStoreId === ZENRYOKU_STORE_ID;
  const shopIcon = isDefaultStore
    ? "https://cdn2-caskan.com/caskan/img/shop_icon/1401_icon_1750161414.jpeg"
    : "/favicon-tsuyaka.png";
  const shopAlt = adminStore?.name ?? "艶華";
  const target = otherStore(currentStoreId);
  const canSwitch = STORE_DEFS.some((s) => s.id === currentStoreId) && !!target;

  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwInput, setPwInput] = useState("");

  const doSwitch = async (password?: string) => {
    if (!target || switching) return;
    setSwitching(true);
    toast({ title: `${target.name}に切替中…` });
    const res = await switchToStore(target, password);
    if (res.needLogin) {
      // パスワード未保持（この機能導入前からのログイン・新規タブなど）→ その場で入力してもらう
      setSwitching(false);
      setPwInput("");
      setPwDialogOpen(true);
      return;
    }
    if (!res.ok) {
      setSwitching(false);
      toast({ title: "切替に失敗しました", description: res.error, variant: "destructive" });
      return;
    }
    // RLSでデータを店舗別に分離するため、リロードして全ページを再取得
    window.location.href = "/dashboard";
  };

  const handleSwitchStore = () => doSwitch();

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwInput) return;
    setPwDialogOpen(false);
    await doSwitch(pwInput);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] sm:h-[60px] bg-card border-b border-border z-40">
      <div className="flex items-center justify-between h-full px-1 sm:px-4 gap-0.5 sm:gap-2 flex-nowrap">
        {/* Mobile menu button and Logo */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="md:hidden flex-shrink-0 h-8 w-8 p-0"
          >
            <Menu size={18} />
          </Button>

          <a href="/dashboard" className="block flex-shrink-0">
            <img 
              src={caskanLogo} 
              alt="Caskan" 
              className="h-6 sm:h-8 w-auto"
            />
          </a>
        </div>

        {/* Account info（店舗アイコン＝店舗切替トグル） */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 whitespace-nowrap">
          <div className="hidden lg:block text-right">
            <div className="text-xs text-muted-foreground">{adminStore?.name ?? "艶華"}</div>
            {isAdmin && (
              <div className="text-xs text-primary font-medium">管理者</div>
            )}
          </div>

          {canSwitch ? (
            <button
              type="button"
              onClick={handleSwitchStore}
              disabled={switching}
              aria-label={`${target?.name}に切り替え`}
              title={`タップで${target?.name}に切り替え`}
              className="relative flex-shrink-0 max-[360px]:hidden disabled:opacity-60"
            >
              <img
                src={shopIcon}
                alt={shopAlt}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-border object-cover"
              />
              <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center shadow">
                {switching ? <Loader2 size={9} className="animate-spin" /> : <Repeat size={9} />}
              </span>
            </button>
          ) : (
            <img
              src={shopIcon}
              alt={shopAlt}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded border border-border object-cover flex-shrink-0 max-[360px]:hidden"
            />
          )}
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="店舗メニュー" className="flex items-center gap-1 flex-shrink-0 h-8 w-8 p-0 sm:w-auto sm:px-2">
                  <User size={14} />
                  <span className="text-xs hidden md:inline">店舗</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut size={14} className="mr-2" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <User size={14} />
              <span className="hidden md:inline">店舗</span>
            </div>
          )}
        </div>
      </div>
      {/* 店舗切替用パスワード入力（sessionStorage 未保持時のみ） */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{target?.name}に切り替え</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePwSubmit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              管理パスワードを入力してください（次回からは入力不要です）
            </p>
            <Input
              type="password"
              placeholder="パスワード"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPwDialogOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={!pwInput}>
                切り替える
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* CTI着信ポップ（全管理画面共通） */}
      <CtiCallPopup />
    </header>
  );
};
