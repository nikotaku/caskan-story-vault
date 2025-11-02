import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChatBot } from "@/components/ChatBot";
import caskanLogo from "@/assets/caskan-logo.png";

interface Cast {
  id: string;
  name: string;
  age: number | null;
  height: number | null;
  bust: number | null;
  cup_size: string | null;
  waist: number | null;
  hip: number | null;
  type: string;
  status: string;
  photo: string | null;
  photos: string[] | null;
  tags: string[] | null;
  join_date: string;
}

const Casts = () => {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'newface'>('all');

  useEffect(() => {
    document.title = "全力エステ - セラピスト";
  }, []);

  useEffect(() => {
    fetchCasts();

    const channel = supabase
      .channel('public-casts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'casts'
        },
        () => {
          fetchCasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from("casts")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error("Error fetching casts:", error);
    } finally {
      setLoading(false);
    }
  };

  // 新人判定（入店から30日以内）
  const isNewFace = (joinDate: string) => {
    const join = new Date(joinDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - join.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  };

  // 本日出勤判定（シフトテーブルから取得する必要があるが、今は status === 'waiting' で代用）
  const isWorkingToday = (status: string) => {
    return status === 'waiting' || status === 'working';
  };

  const filteredCasts = casts.filter((cast) => {
    if (filter === 'today') return isWorkingToday(cast.status);
    if (filter === 'newface') return isNewFace(cast.join_date);
    return true;
  });

  const formatSize = (cast: Cast) => {
    if (!cast.height) return '';
    
    let sizeStr = `T.${cast.height}`;
    
    if (cast.bust && cast.cup_size && cast.waist && cast.hip) {
      sizeStr += ` B.${cast.bust}(${cast.cup_size}) W.${cast.waist} H.${cast.hip}`;
    } else if (cast.bust && cast.waist && cast.hip) {
      sizeStr += ` B.${cast.bust} W.${cast.waist} H.${cast.hip}`;
    }
    
    return sizeStr;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5e8e4" }}>
      {/* Top Contact Bar */}
      <div className="bg-[#d4b5a8] text-white py-2 px-4 flex justify-between items-center text-sm">
        <div className="container mx-auto flex justify-center items-center">
          <span>12:00〜26:00(24:40最終受付)</span>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-white py-6">
        <div className="container mx-auto text-center">
          <Link to="/">
            <img src={caskanLogo} alt="全力エステ" className="h-24 md:h-32 mx-auto object-contain" style={{ mixBlendMode: 'multiply' }} />
          </Link>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="bg-white border-y border-[#e5d5cc] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto">
          <div className="flex justify-center items-center flex-wrap">
            <Link to="/" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">TOP</div>
              <div className="text-xs text-[#a89586]">トップ</div>
            </Link>
            <Link to="/schedule" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SCHEDULE</div>
              <div className="text-xs text-[#a89586]">出勤情報</div>
            </Link>
            <Link to="/casts" className="px-8 py-4 bg-[#f5e8e4] transition-colors border-b-2 border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">THERAPIST</div>
              <div className="text-xs text-[#a89586]">セラピスト</div>
            </Link>
            <Link to="/system" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">SYSTEM</div>
              <div className="text-xs text-[#a89586]">システム</div>
            </Link>
            <Link to="/booking" className="px-8 py-4 hover:bg-[#f5e8e4] transition-colors border-b-2 border-transparent hover:border-[#d4a574]">
              <div className="text-[#8b7355] font-semibold text-sm">BOOKING</div>
              <div className="text-xs text-[#a89586]">WEB予約</div>
            </Link>
          </div>
        </div>
      </nav>

      <main className="container py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#8b7355" }}>
              <small className="text-sm block mb-1">THERAPIST</small>
              セラピスト
            </h2>
            <Link 
              to="/schedule" 
              className="inline-block bg-white hover:bg-[#f5e8e4] text-[#8b7355] border border-[#d4b5a8] px-6 py-2 rounded transition-colors"
            >
              出勤表はこちら
            </Link>
          </div>

          {/* Filter Buttons */}
          <div className="mb-8 flex flex-wrap gap-3">
            <Button
              onClick={() => setFilter('all')}
              className={`px-8 py-6 text-base ${
                filter === 'all' 
                  ? 'bg-[#d4a574] hover:bg-[#c59564] text-white' 
                  : 'bg-white hover:bg-[#f5e8e4] text-[#8b7355] border border-[#d4b5a8]'
              }`}
            >
              すべて
            </Button>
            <Button
              onClick={() => setFilter('today')}
              className={`px-8 py-6 text-base ${
                filter === 'today' 
                  ? 'bg-[#d4a574] hover:bg-[#c59564] text-white' 
                  : 'bg-white hover:bg-[#f5e8e4] text-[#8b7355] border border-[#d4b5a8]'
              }`}
            >
              本日出勤
            </Button>
            <Button
              onClick={() => setFilter('newface')}
              className={`px-8 py-6 text-base ${
                filter === 'newface' 
                  ? 'bg-[#d4a574] hover:bg-[#c59564] text-white' 
                  : 'bg-white hover:bg-[#f5e8e4] text-[#8b7355] border border-[#d4b5a8]'
              }`}
            >
              新人
            </Button>
          </div>

          {/* Therapist Grid - エステ魂スタイル */}
          {filteredCasts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">該当するセラピストが見つかりませんでした</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredCasts.map((cast) => (
                <div key={cast.id} className="relative">
                  <Link to={`/casts/${cast.id}`} className="block group">
                    <figure className="bg-white rounded overflow-hidden shadow hover:shadow-lg transition-shadow relative">
                      {/* タグバッジ */}
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        {cast.tags && cast.tags.map((tag, idx) => (
                          <span 
                            key={idx}
                            className={`text-white text-xs font-bold px-2 py-1 rounded shadow-md ${
                              tag === '人気セラピスト' ? 'bg-red-500' :
                              tag === '新人' ? 'bg-pink-500' :
                              'bg-blue-500'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                        {/* 新人バッジ（タグにない場合のみ表示） */}
                        {isNewFace(cast.join_date) && (!cast.tags || !cast.tags.includes('新人')) && (
                          <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                            新人
                          </span>
                        )}
                      </div>
                      
                      {/* 写真 */}
                      {cast.photo ? (
                        <img
                          src={cast.photo}
                          alt={cast.name}
                          className="w-full aspect-[357/556] object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-[357/556] bg-gradient-to-br from-[#d4b5a8] to-[#c5a89b] flex items-center justify-center">
                          <span className="text-4xl text-white">
                            {cast.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      
                      {/* セラピスト情報 */}
                      <div className="p-3">
                        <small className="block text-xs text-[#a89586] mb-1">
                          <br />
                        </small>
                        <h4 className="font-bold text-[#8b7355] mb-1">
                          {cast.name}{cast.age ? `(${cast.age})` : ''}
                        </h4>
                        {formatSize(cast) && (
                          <p className="text-xs text-[#a89586]">
                            {formatSize(cast)}
                          </p>
                        )}
                      </div>
                      
                      {/* VIEW DETAIL リンク */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm flex items-center justify-center gap-1">
                          VIEW DETAIL <i className="fa fa-angle-right"></i>
                        </span>
                      </div>
                    </figure>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-16 px-4 text-white" style={{ background: "linear-gradient(180deg, #d4b5a8 0%, #c5a89b 100%)" }}>
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            <div>
              <h4 className="font-bold mb-4 text-lg">営業時間</h4>
              <p className="text-white/95">12:00〜26:00</p>
              <p className="text-sm text-white/80">(24:40最終受付)</p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-lg">メニュー</h4>
              <div className="flex flex-col gap-3 text-sm">
                <Link to="/casts" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  セラピスト
                </Link>
                <Link to="/schedule" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  出勤情報
                </Link>
                <Link to="/system" className="text-white/85 hover:text-[#d4a574] transition-colors">
                  システム
                </Link>
              </div>
            </div>
          </div>
          <div className="text-center text-sm text-white/70 pt-10 border-t border-white/20">
            © 2025 全力エステ ZR. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Chat Bot */}
      <ChatBot />
    </div>
  );
};

export default Casts;
