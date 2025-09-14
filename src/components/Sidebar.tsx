import { useState } from "react";
import { 
  Home, 
  Calendar, 
  Clock, 
  BookOpen, 
  Users, 
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { href: "/", label: "ホーム", icon: Home, active: true },
  { href: "/schedule", label: "スケジュール", icon: Calendar },
  { href: "/shift", label: "シフト", icon: Clock },
  { href: "/reserve", label: "予約", icon: BookOpen },
  { href: "/customer", label: "顧客", icon: Users },
  { href: "/cast", label: "キャスト", icon: User },
  { href: "/system", label: "料金システム", icon: DollarSign },
  { href: "/room", label: "ルーム", icon: MapPin },
  { href: "/guarantee", label: "給与", icon: Wallet },
  { href: "/expense", label: "経費", icon: Receipt },
  { href: "/design", label: "ホームページ", icon: Globe },
  { href: "/report", label: "レポート", icon: BarChart3 },
  { href: "/shop", label: "設定", icon: Settings },
];

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
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
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-md transition-colors",
                    item.active 
                      ? "text-primary bg-primary/10" 
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </a>
              );
            })}
            
            <hr className="my-2 border-border" />
            
            <a
              href="https://zenryoku-esthe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              <ExternalLink size={16} />
              サイトを見る
            </a>
            
            <button className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/50 rounded-md transition-colors w-full text-left">
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        </nav>
      </aside>
    </>
  );
};