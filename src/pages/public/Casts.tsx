import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChatBot } from "@/components/ChatBot";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";

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
  profile: string | null;
  x_account: string | null;
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casts' }, () => fetchCasts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase.from("casts").select("*").order("name", { ascending: true });
      if (error) throw error;
      setCasts(data || []);
    } catch (error) {
      console.error("Error fetching casts:", error);
    } finally {
      setLoading(false);
    }
  };

  const isNewFace = (joinDate: string) => {
    const join = new Date(joinDate);
    const now = new Date();
    return Math.ceil(Math.abs(now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24)) <= 30;
  };

  const isWorkingToday = (status: string) => status === 'waiting' || status === 'working';

  const filteredCasts = casts.filter((cast) => {
    if (filter === 'today') return isWorkingToday(cast.status);
    if (filter === 'newface') return isNewFace(cast.join_date);
    return true;
  });

  const formatSize = (cast: Cast) => {
    if (!cast.height) return '';
    let s = `T.${cast.height}`;
    if (cast.bust && cast.cup_size && cast.waist && cast.hip) s += ` B.${cast.bust}(${cast.cup_size}) W.${cast.waist} H.${cast.hip}`;
    else if (cast.bust && cast.waist && cast.hip) s += ` B.${cast.bust} W.${cast.waist} H.${cast.hip}`;
    return s;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "#f5e8e4" }}>
      <PublicNavigation />

      <main className="container py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4" style={{ color: "#8b7355" }}>
              <small className="text-sm block mb-1">THERAPIST</small>
              セラピスト
            </h2>
            <Link to="/schedule" className="inline-block bg-white hover:bg-[#f5e8e4] text-[#8b7355] border border-[#d4b5a8] px-6 py-2 rounded transition-colors">
              出勤表はこちら
            </Link>
          </div>

          <div className="mb-8 flex flex-wrap gap-3">
            {(['all', 'today', 'newface'] as const).map((f) => (
              <Button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-8 py-6 text-base ${filter === f ? 'bg-[#d4a574] hover:bg-[#c59564] text-white' : 'bg-white hover:bg-[#f5e8e4] text-[#8b7355] border border-[#d4b5a8]'}`}
              >
                {f === 'all' ? 'すべて' : f === 'today' ? '本日出勤' : '新人'}
              </Button>
            ))}
          </div>

          {filteredCasts.length === 0 ? (
            <div className="text-center py-12"><p className="text-muted-foreground">該当するセラピストが見つかりませんでした</p></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredCasts.map((cast) => (
                <div key={cast.id} className="relative">
                  <Link to={`/casts/${cast.id}`} className="block group">
                    <figure className="bg-white rounded overflow-hidden shadow hover:shadow-lg transition-shadow relative">
                      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
                        {cast.tags?.map((tag, idx) => (
                          <span key={idx} className={`text-white text-xs font-bold px-2 py-1 rounded shadow-md ${tag === '人気セラピスト' ? 'bg-red-500' : tag === '新人' ? 'bg-pink-500' : 'bg-blue-500'}`}>{tag}</span>
                        ))}
                        {isNewFace(cast.join_date) && (!cast.tags || !cast.tags.includes('新人')) && (
                          <span className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">新人</span>
                        )}
                      </div>
                      {cast.photo ? (
                        <img src={cast.photo} alt={cast.name} className="w-full aspect-[3/4] object-cover" />
                      ) : (
                        <div className="w-full aspect-[3/4] bg-gradient-to-br from-[#d4b5a8] to-[#c5a89b] flex items-center justify-center">
                          <span className="text-4xl text-white">{cast.name.charAt(0)}</span>
                        </div>
                      )}
                      {cast.x_account && (
                        <div className="absolute bottom-12 right-2">
                          <a href={`https://twitter.com/${cast.x_account}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            <img src="https://cdn2-caskan.com/caskan/asset/sns/x.png" alt="X" className="w-6 h-6" />
                          </a>
                        </div>
                      )}
                      <div className="p-3">
                        <small className="block text-xs text-[#a89586] mb-1">{cast.profile || '\u00A0'}</small>
                        <h4 className="font-bold text-[#8b7355] mb-1">{cast.name}{cast.age ? `(${cast.age})` : ''}</h4>
                        {formatSize(cast) && <p className="text-xs text-[#a89586]">{formatSize(cast)}</p>}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm flex items-center justify-center gap-1">VIEW DETAIL →</span>
                      </div>
                    </figure>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
      <FixedBottomBar />
      <ChatBot />
    </div>
  );
};

export default Casts;
