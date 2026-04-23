import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { SalesReport } from "@/components/SalesReport";
import { DailyReservationTimeline } from "@/components/DailyReservationTimeline";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle } from "lucide-react";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [siteStatus, setSiteStatus] = useState<'loading' | 'public' | 'private'>('loading');

  useEffect(() => {
    const checkSiteStatus = async () => {
      const { data, error } = await supabase
        .from("casts")
        .select("id")
        .eq("is_visible", true)
        .limit(1);
      
      if (error) {
        console.error("Error checking site status:", error);
        return;
      }
      setSiteStatus(data && data.length > 0 ? 'public' : 'private');
    };
    checkSiteStatus();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-7xl mx-auto space-y-6">
            {siteStatus !== 'loading' && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                siteStatus === 'public'
                  ? 'bg-green-500/10 text-green-700 border border-green-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}>
                {siteStatus === 'public' ? (
                  <>
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span>サイト公開中 — セラピストが公開されています</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>サイト非公開 — 全セラピストが非表示です</span>
                  </>
                )}
              </div>
            )}
            <DailyReservationTimeline />
            <SalesReport />
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

export default Index;
