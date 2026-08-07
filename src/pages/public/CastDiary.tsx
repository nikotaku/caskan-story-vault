import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, ExternalLink, Clock } from "lucide-react";
import { PublicNavigation } from "@/components/public/PublicNavigation";
import { PublicFooter } from "@/components/public/PublicFooter";
import { FixedBottomBar } from "@/components/public/FixedBottomBar";
import { useStore } from "@/hooks/useStore";

interface Diary {
  id: string;
  title: string | null;
  category: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  body: string | null;
  posted_at: string | null;
  external_url: string | null;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${dow}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function CastDiary() {
  const { id } = useParams();
  const { store, storeId } = useStore();
  const [castName, setCastName] = useState("");
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("casts").select("name").eq("id", id).eq("store_id", storeId).maybeSingle(),
      supabase.from("cast_diaries" as any).select("*").eq("cast_id", id).order("display_order", { ascending: true }),
    ]).then(([c, d]) => {
      setCastName((c.data as any)?.name ?? "");
      setDiaries(((d.data as any[]) ?? []) as Diary[]);
      setLoading(false);
      document.title = `${(c.data as any)?.name ?? ""} 写メ日記 | ${store?.name ?? ""}`;
    });
  }, [id, storeId, store?.name]);

  return (
    <div className="min-h-screen pb-14 md:pb-0" style={{ backgroundColor: "var(--pub-bg,#0f0c09)" }}>
      <PublicNavigation />
      <main className="container py-6 px-3 md:px-4">
        <div className="max-w-2xl mx-auto">
          <Link to={`/casts/${id}`} className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "var(--pub-text-muted,#a3987f)" }}>
            <ArrowLeft size={15} />{castName ? `${castName}のプロフィールへ` : "戻る"}
          </Link>

          <div className="text-center mb-6">
            <p className="text-xs tracking-[0.3em] font-bold" style={{ color: "var(--pub-accent,#c6a15b)" }}>DIARY</p>
            <h1 className="text-2xl font-bold mt-1 flex items-center justify-center gap-2" style={{ color: "var(--pub-text,#f0e6d2)" }}>
              <Camera size={20} />{castName} 写メ日記
            </h1>
          </div>

          {loading ? (
            <p className="text-center py-12" style={{ color: "var(--pub-text-muted,#a3987f)" }}>読み込み中...</p>
          ) : diaries.length === 0 ? (
            <p className="text-center py-12" style={{ color: "var(--pub-text-muted,#a3987f)" }}>まだ写メ日記がありません</p>
          ) : (
            <div className="space-y-4">
              {diaries.map((d) => (
                <article key={d.id} className="rounded-lg overflow-hidden border" style={{ background: "var(--pub-card,#1a150f)", borderColor: "var(--pub-border,#3a2f1c)" }}>
                  {(d.image_urls?.length || d.image_url) && (
                    <div className={`grid gap-0.5 ${d.image_urls && d.image_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {(d.image_urls?.length ? d.image_urls : [d.image_url]).filter(Boolean).map((url, index) => (
                        <img key={`${url}-${index}`} src={url!} alt={`${d.title ?? "写メ日記"} ${index + 1}`} className="w-full h-full object-cover aspect-square" loading="lazy" />
                      ))}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      {d.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--pub-card2,#221b12)", color: "var(--pub-accent,#c6a15b)" }}>{d.category}</span>
                      )}
                      {d.posted_at && (
                        <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--pub-text-muted,#a3987f)" }}>
                          <Clock size={11} />{fmtDate(d.posted_at)}
                        </span>
                      )}
                    </div>
                    {d.title && <h2 className="text-base font-bold mb-1" style={{ color: "var(--pub-text,#f0e6d2)" }}>{d.title}</h2>}
                    {d.body && <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--pub-text-mid,#d9cdb4)" }}>{d.body}</p>}
                    {d.external_url && (
                      <a href={d.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 font-semibold" style={{ color: "var(--pub-accent,#c6a15b)" }}>
                        続きを読む <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <PublicFooter />
      <FixedBottomBar />
    </div>
  );
}
