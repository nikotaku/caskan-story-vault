import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { AnnouncementsList } from "@/components/AnnouncementsList";
import { SalesReport } from "@/components/SalesReport";
import { TabMenu } from "@/components/TabMenu";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDate, setActiveDate] = useState("2025-09-14");

  const dates = [
    { date: "2025-09-14", label: "9月14日" },
    { date: "2025-09-15", label: "9月15日" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <main className="pt-[60px] md:ml-[180px] transition-all duration-300">
        <div className="p-4">
          <div className="max-w-4xl mx-auto">
            <AnnouncementsList />
            
            <SalesReport />
            
            <TabMenu 
              activeDate={activeDate}
              dates={dates}
              onDateChange={setActiveDate}
            />
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
