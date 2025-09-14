import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { AnnouncementsList } from "@/components/AnnouncementsList";
import { SalesReport } from "@/components/SalesReport";
import { TabMenu } from "@/components/TabMenu";
import { SocialPosting } from "@/components/SocialPosting";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDate, setActiveDate] = useState("2025-09-14");

  const dates = [
    { date: "2025-09-14", label: "9月14日" },
    { date: "2025-09-15", label: "9月15日" },
  ];

  const attendanceContent = `本日の出勤情報
🌻みさき　13:00〜1:00
🌻ばんび　13:00〜1:00

💫ご予約はこちら
r.caskan.jp/zenryoku1209


📲お電話からのご予約
080-3192-1209

#仙台メンエス`;

  const availabilityContent = `只今の案内状況
🌻みさき　今すぐ
🌻ばんび　今すぐ

💫ご予約はこちら
r.caskan.jp/zenryoku1209


📲お電話からのご予約
080-3192-1209

#仙台メンエス`;

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
            
            <SocialPosting
              title="出勤情報"
              defaultContent={attendanceContent}
              twitterUrl="https://twitter.com/intent/tweet?text=%E6%9C%AC%E6%97%A5%E3%81%AE%E5%87%BA%E5%8B%A4%E6%83%85%E5%A0%B1%0A%F0%9F%8C%BB%E3%81%BF%E3%81%95%E3%81%8D%E3%80%8013%3A00%E3%80%9C1%3A00%0A%F0%9F%8C%BB%E3%81%B0%E3%82%93%E3%81%B3%E3%80%8013%3A00%E3%80%9C1%3A00%0A%0A%F0%9F%92%AB%E3%81%94%E4%BA%88%E7%B4%84%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%0Ar.caskan.jp%2Fzenryoku1209%0A%0A%0D%0A%F0%9F%93%B2%E3%81%8A%E9%9B%BB%E8%A9%B1%E3%81%8B%E3%82%89%E3%81%AE%E3%81%94%E4%BA%88%E7%B4%84%0D%0A080-3192-1209%0D%0A%0D%0A%23%E4%BB%99%E5%8F%B0%E3%83%A1%E3%83%B3%E3%82%A8%E3%82%B9"
              hpUrl="/post?ShopPost[body]=%E6%9C%AC%E6%97%A5%E3%81%AE%E5%87%BA%E5%8B%A4%E6%83%85%E5%A0%B1%0A%F0%9F%8C%BB%E3%81%BF%E3%81%95%E3%81%8D%E3%80%8013%3A00%E3%80%9C1%3A00%0A%F0%9F%8C%BB%E3%81%B0%E3%82%93%E3%81%B3%E3%80%8013%3A00%E3%80%9C1%3A00%0A%0A%F0%9F%92%AB%E3%81%94%E4%BA%88%E7%B4%84%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%0Ahttps%3A%2F%2Fr.caskan.jp%2Fzenryoku1209%0A%0A%0D%0A%F0%9F%93%B2%E3%81%8A%E9%9B%BB%E8%A9%B1%E3%81%8B%E3%82%89%E3%81%AE%E3%81%94%E4%BA%88%E7%B4%84%0D%0A080-3192-1209%0D%0A%0D%0A%23%E4%BB%99%E5%8F%B0%E3%83%A1%E3%83%B3%E3%82%A8%E3%82%B9"
            />
            
            <SocialPosting
              title="案内状況"
              defaultContent={availabilityContent}
              twitterUrl="https://twitter.com/intent/tweet?text=%E5%8F%AA%E4%BB%8A%E3%81%AE%E6%A1%88%E5%86%85%E7%8A%B6%E6%B3%81%0A%F0%9F%8C%BB%E3%81%BF%E3%81%95%E3%81%8D%E3%80%80%E4%BB%8A%E3%81%99%E3%81%90%0A%F0%9F%8C%BB%E3%81%B0%E3%82%93%E3%81%B3%E3%80%80%E4%BB%8A%E3%81%99%E3%81%90%0A%0A%F0%9F%92%AB%E3%81%94%E4%BA%88%E7%B4%84%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%0Ar.caskan.jp%2Fzenryoku1209%0A%0A%0D%0A%F0%9F%93%B2%E3%81%8A%E9%9B%BB%E8%A9%B1%E3%81%8B%E3%82%89%E3%81%AE%E3%81%94%E4%BA%88%E7%B4%84%0D%0A080-3192-1209%0D%0A%0D%0A%23%E4%BB%99%E5%8F%B0%E3%83%A1%E3%83%B3%E3%82%A8%E3%82%B9"
              hpUrl="/post?ShopPost[body]=%E5%8F%AA%E4%BB%8A%E3%81%AE%E6%A1%88%E5%86%85%E7%8A%B6%E6%B3%81%0A%F0%9F%8C%BB%E3%81%BF%E3%81%95%E3%81%8D%E3%80%80%E4%BB%8A%E3%81%99%E3%81%90%0A%F0%9F%8C%BB%E3%81%B0%E3%82%93%E3%81%B3%E3%80%80%E4%BB%8A%E3%81%99%E3%81%90%0A%0A%F0%9F%92%AB%E3%81%94%E4%BA%88%E7%B4%84%E3%81%AF%E3%81%93%E3%81%A1%E3%82%89%0Ahttps%3A%2F%2Fr.caskan.jp%2Fzenryoku1209%0A%0A%0D%0A%F0%9F%93%B2%E3%81%8A%E9%9B%BB%E8%A9%B1%E3%81%8B%E3%82%89%E3%81%AE%E3%81%94%E4%BA%88%E7%B4%84%0D%0A080-3192-1209%0D%0A%0D%0A%23%E4%BB%99%E5%8F%B0%E3%83%A1%E3%83%B3%E3%82%A8%E3%82%B9"
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
