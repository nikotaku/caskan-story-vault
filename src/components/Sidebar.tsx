import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Home, 
  Calendar, 
  Clock, 
  BookOpen, 
  Users, 
  UserCheck,
  User, 
  DollarSign, 
  MapPin, 
  Wallet, 
  Receipt, 
  Globe, 
  BarChart3, 
  Settings, 
  LogOut,
  ExternalLink,
  Menu,
  X,
  Sparkles,
  FileText,
  RefreshCw,
  Home as RoomIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { href: "/dashboard", label: "ホーム", icon: Home },
  { href: "/staff", label: "キャスト管理", icon: User },
  { href: "/shift", label: "シフト", icon: Clock },
  { href: "/reservations", label: "予約管理", icon: BookOpen },
  { href: "/customers", label: "顧客管理", icon: UserCheck },
  { href: "/agreement", label: "誓約書", icon: FileText },
  { href: "/rooms", label: "ルーム設定", icon: RoomIcon },
  { href: "/pricing-management", label: "料金設定", icon: DollarSign },
  { href: "/salary", label: "給与", icon: Wallet },
  { href: "/report", label: "レポート", icon: BarChart3 },
  { href: "/text-generation", label: "文章生成", icon: Sparkles },
  { href: "/estama", label: "Estama連携", icon: ExternalLink },
  { href: "/sync", label: "同期状況", icon: RefreshCw },
  { href: "/design", label: "ホームページ", icon: Globe },
  { href: "/shop", label: "設定", icon: Settings },
];

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { signOut } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed top-[60px] left-0 h-[calc(100vh-60px)] w-[180px] bg-muted/30 border-r border-border z-50 transition-transform duration-300",
        "md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <nav className="h-full overflow-y-auto">
          <div className="space-y-1 p-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isCurrentPath = window.location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-md transition-colors",
                    isCurrentPath 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
            
            <hr className="my-2 border-border" />
            
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              <ExternalLink size={16} />
              サイトを見る
            </Link>
            
            <button 
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 rounded-md transition-colors w-full text-left"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};