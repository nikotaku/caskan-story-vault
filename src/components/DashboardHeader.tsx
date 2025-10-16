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
      <div className="flex items-center justify-between h-full px-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="md:hidden"
        >
          <Menu size={20} />
        </Button>

        {/* Logo */}
        <div className="flex-1 flex justify-center md:justify-start">
          <a href="/" className="block">
            <img 
              src={caskanLogo} 
              alt="Caskan" 
              className="h-9 w-auto"
            />
          </a>
        </div>

        {/* Account info */}
        <div className="flex items-center gap-3">
          <div className="hidden md:block text-right">
            <div className="text-xs text-muted-foreground">全力エステ..</div>
            {isAdmin && (
              <div className="text-xs text-primary font-medium">管理者</div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <img 
              src="https://cdn2-caskan.com/caskan/img/shop_icon/1401_icon_1750161414.jpeg" 
              alt="全力エステ 仙台"
              className="w-10 h-10 rounded border border-border object-cover"
            />
          </div>
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <User size={14} />
                  <span className="text-xs">店舗</span>
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
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User size={14} />
              <span>店舗</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
