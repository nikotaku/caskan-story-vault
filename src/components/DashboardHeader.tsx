import { Menu, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import caskanLogo from "@/assets/caskan-logo.png";
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

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border z-40">
      <div className="flex items-center justify-between h-full px-4 gap-2">
        {/* Mobile menu button and Logo */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="md:hidden flex-shrink-0"
          >
            <Menu size={20} />
          </Button>

          <a href="/dashboard" className="block flex-shrink-0">
            <img 
              src={caskanLogo} 
              alt="Caskan" 
              className="h-8 w-auto"
            />
          </a>
        </div>

        {/* Account info */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:block text-right">
            <div className="text-xs text-muted-foreground">全力エステ..</div>
            {isAdmin && (
              <div className="text-xs text-primary font-medium">管理者</div>
            )}
          </div>
          
          <img 
            src="https://cdn2-caskan.com/caskan/img/shop_icon/1401_icon_1750161414.jpeg" 
            alt="全力エステ 仙台"
            className="w-9 h-9 rounded border border-border object-cover flex-shrink-0"
          />
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 flex-shrink-0">
                  <User size={14} />
                  <span className="text-xs hidden sm:inline">店舗</span>
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
              <span className="hidden sm:inline">店舗</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
