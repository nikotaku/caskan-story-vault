import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStore } from "@/hooks/useAdminStore";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2, Upload, Trash2, X, Megaphone, Plus, Save,
  ExternalLink, Lightbulb, ImagePlus, ChevronDown, ChevronUp,
} from "lucide-react";

/**
 * 媒体攻略：広告媒体（エスたま等）の攻略ガイドと、媒体ごとの掲載設定シート。
 * 攻略ガイドのスクリーンショットは cast-photos バケットの estama-guide/<セクション>/ に保存する。
 */

const BUCKET = "cast-photos";

/* ---------------- 攻略ガイドのセクション定義 ---------------- */

interface GuideSection {
  key: string; // ストレージのプレフィックスにも使う
  title: string;
  body: string[];
  points: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    key: "pr",
    title: "PR枠",
    body: [
      "検索一覧の最上部に「PR」ラベル付きで固定表示される有料広告枠。仙台エリアでは3枠が縦に並び、通常掲載よりも圧倒的に目に入りやすい。",
      "見出しに表示されるのは各店の「キャッチコピー（30文字）」がそのまま。つまりPR枠の成果はキャッチコピーの強さで決まる。",
    ],
    points: [
      "競合の訴求は「クーポン・割引・新人価格」系が主流。数字入りコピー（¥2,000×5枚など）が最も目を引く",
      "左のサムネイルはロゴより訴求バナーの方が視認性が高い（例：15分延長無料のバナー）",
      "出稿するなら露出効果が最大化する「グランドオープン期」が費用対効果◎",
      "PR枠を買わない場合も、上位表示ボタン（保存と同時に上位表示・回数制限あり）をゴールデンタイム前（18〜20時）に使うと効果的",
    ],
  },
];

/* ---------------- セクション画像（ストレージ連携） ---------------- */

interface StockImage {
  name: string;
  url: string;
}

function SectionImages({ prefix }: { prefix: string }) {
  const [images, setImages] = useState<StockImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<StockImage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dir = `estama-guide/${prefix}`;

  const fetchImages = useCallback(async () => {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list(dir, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
    setImages(
      (data || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from(BUCKET).getPublicUrl(`${dir}/${f.name}`).data.publicUrl,
        })),
    );
  }, [dir]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      let ok = 0;
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "png";
        const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(`${dir}/${name}`, file);
        if (error) { console.error(error); continue; }
        ok++;
      }
      if (ok > 0) { toast.success(`${ok}枚アップロードしました`); fetchImages(); }
      else toast.error("アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (img: StockImage) => {
    if (!confirm("この画像を削除しますか？")) return;
    const { error } = await supabase.storage.from(BUCKET).remove([`${dir}/${img.name}`]);
    if (error) { toast.error("削除に失敗しました"); return; }
    setImages((prev) => prev.filter((i) => i.name !== img.name));
    if (preview?.name === img.name) setPreview(null);
  };

  return (
    <div className="mt-3">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {images.map((img) => (
            <div key={img.name} className="relative group rounded-lg overflow-hidden border bg-muted/20">
              <img
                src={img.url}
                alt=""
                loading="lazy"
                className="w-full h-36 object-cover cursor-pointer"
                onClick={() => setPreview(img)}
              />
              <button
                className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(img)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <ImagePlus size={14} className="mr-1.5" />}
        スクショを追加
      </Button>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setPreview(null)}>
            <X size={28} />
          </button>
          <img
            src={preview.url}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- 媒体設定シート ---------------- */

interface MediaSetting {
  id: string;
  media_name: string;
  url: string | null;
  login_id: string | null;
  login_password: string | null;
  shop_name: string | null;
  catch_copy: string | null;
  description: string | null;
  main_color: string | null;
  sub_color: string | null;
  plan: string | null;
  memo: string | null;
  sort_order: number;
}

const EMPTY_MEDIA: Omit<MediaSetting, "id"> = {
  media_name: "",
  url: "", login_id: "", login_password: "",
  shop_name: "", catch_copy: "", description: "",
  main_color: "", sub_color: "", plan: "", memo: "",
  sort_order: 0,
};

function SettingRow({ label, description, value, onChange, textarea, mono, placeholder, children }: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  mono?: boolean;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <tr className="border-b last:border-b-0 align-top">
      <th scope="row" className="w-[32%] min-w-32 bg-muted/35 px-3 py-3 text-left font-medium">
        <span className="block text-sm text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">{description}</span>}
      </th>
      <td className="px-3 py-2.5">
        {children ?? (textarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={value.length > 200 ? 8 : 3}
            placeholder={placeholder}
            className="w-full resize-y rounded-md border bg-background px-2.5 py-2 text-sm whitespace-pre-wrap focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 ${mono ? "font-mono" : ""}`}
          />
        ))}
      </td>
    </tr>
  );
}

/** 「#D4547A（...）」のような文字列から先頭のカラーコードを拾ってスウォッチ表示する */
function ColorSwatch({ value }: { value: string }) {
  const hex = value.match(/#[0-9a-fA-F]{6}/)?.[0];
  if (!hex) return null;
  return <span className="inline-block w-4 h-4 rounded border align-middle ml-1.5" style={{ backgroundColor: hex }} />;
}

function MediaCard({ media, onSaved, onDeleted }: {
  media: MediaSetting;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState<MediaSetting>(media);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(media);

  const set = (k: keyof MediaSetting) => (v: string) => setDraft({ ...draft, [k]: v });

  const handleSave = async () => {
    if (!draft.media_name.trim()) { toast.error("媒体名を入力してください"); return; }
    setSaving(true);
    const { id, ...payload } = draft;
    const { error } = await supabase
      .from("media_settings" as any)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) { console.error(error); toast.error("保存に失敗しました"); return; }
    toast.success("保存しました");
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirm(`「${media.media_name}」の設定シートを削除しますか？`)) return;
    const { error } = await supabase.from("media_settings" as any).delete().eq("id", media.id);
    if (error) { toast.error("削除に失敗しました"); return; }
    toast.success("削除しました");
    onDeleted();
  };

  return (
    <div className="rounded-xl border bg-card">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone size={16} className="text-primary shrink-0" />
          <span className="font-bold text-sm truncate">{draft.media_name || "（媒体名未設定）"}</span>
          {draft.catch_copy && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">｜{draft.catch_copy}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">設定項目</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">現在の設定内容</th>
                </tr>
              </thead>
              <tbody>
                <SettingRow label="媒体名" description="管理画面での表示名" value={draft.media_name} onChange={set("media_name")} placeholder="エスたま" />
                <SettingRow label="掲載ページURL" description="媒体の店舗ページ" value={draft.url ?? ""} onChange={set("url")}>
              <div className="flex gap-1.5">
                <input
                  value={draft.url ?? ""}
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  placeholder="https://"
                  className="flex-1 px-2.5 py-1.5 border rounded-md text-sm bg-background font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                {draft.url && (
                  <a href={draft.url} target="_blank" rel="noreferrer" className="p-2 border rounded-md hover:bg-muted">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
                </SettingRow>
                <SettingRow label="ログインID" description="媒体管理画面のID" value={draft.login_id ?? ""} onChange={set("login_id")} mono />
                <SettingRow label="ログインPW" description="媒体管理画面のパスワード" value={draft.login_password ?? ""} onChange={set("login_password")} mono />
                <SettingRow label="店舗名表記" description="媒体上に掲載する店名" value={draft.shop_name ?? ""} onChange={set("shop_name")} />
                <SettingRow label="掲載プラン" description="無料掲載・PR枠など" value={draft.plan ?? ""} onChange={set("plan")} placeholder="無料掲載／PR枠 など" />
                <SettingRow label="メインカラー" description="ページの基調色" value={draft.main_color ?? ""} onChange={set("main_color")}>
                  <div className="flex items-center gap-2">
              <input
                value={draft.main_color ?? ""}
                onChange={(e) => setDraft({ ...draft, main_color: e.target.value })}
                placeholder="#D4547A（R212 G84 B122）"
                        className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
                    <ColorSwatch value={draft.main_color ?? ""} />
                  </div>
                </SettingRow>
                <SettingRow label="サブカラー" description="補助・アクセント色" value={draft.sub_color ?? ""} onChange={set("sub_color")}>
                  <div className="flex items-center gap-2">
              <input
                value={draft.sub_color ?? ""}
                onChange={(e) => setDraft({ ...draft, sub_color: e.target.value })}
                placeholder="#150A11（R21 G10 B17）"
                        className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
                    <ColorSwatch value={draft.sub_color ?? ""} />
                  </div>
                </SettingRow>
                <SettingRow label="キャッチコピー" description="検索一覧や店舗ページの訴求文" value={draft.catch_copy ?? ""} onChange={set("catch_copy")} />
                <SettingRow label="お店の説明" description="媒体に掲載する紹介文" value={draft.description ?? ""} onChange={set("description")} textarea />
                <SettingRow label="運用メモ" description="クーポン・特徴枠・注意事項など" value={draft.memo ?? ""} onChange={set("memo")} textarea />
              </tbody>
            </table>
          </div>

          <div className="flex justify-between pt-1">
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={handleDelete}>
              <Trash2 size={14} className="mr-1" />削除
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
              保存
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- ページ本体 ---------------- */

export default function MediaStrategy() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"guide" | "sheet">("guide");
  const [mediaList, setMediaList] = useState<MediaSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();
  const { store: adminStore } = useAdminStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => { document.title = "媒体攻略"; }, []);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("media_settings" as any)
      .select("*")
      .order("sort_order")
      .order("created_at");
    if (error) console.error(error);
    setMediaList(((data ?? []) as unknown as MediaSetting[]));
    setLoading(false);
  }, []);

  useEffect(() => { if (user) fetchMedia(); }, [user, fetchMedia]);

  const handleAdd = async () => {
    const { data, error } = await supabase
      .from("media_settings" as any)
      .insert({ ...EMPTY_MEDIA, media_name: "新しい媒体", sort_order: mediaList.length + 1 } as any)
      .select()
      .single();
    if (error || !data) { console.error(error); toast.error("追加に失敗しました"); return; }
    fetchMedia();
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="pt-[60px] md:ml-[240px]">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
            <Megaphone size={20} className="text-primary" />
            媒体攻略
            {adminStore?.name && (
              <span className="text-sm font-normal text-muted-foreground">（{adminStore.name}）</span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mb-4">
            広告媒体の攻略メモと、媒体ごとの掲載設定をまとめる内部ページです。公開サイトには表示されません。
          </p>

          {/* タブ */}
          <div className="flex gap-1 border-b mb-5">
            {([["guide", "エスたま攻略"], ["sheet", "媒体設定シート"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "guide" ? (
            <div className="space-y-6">
              {GUIDE_SECTIONS.map((sec) => (
                <section key={sec.key} className="rounded-xl border bg-card p-4 sm:p-5">
                  <h2 className="text-base font-bold mb-2">{sec.title}</h2>
                  <div className="space-y-2 text-sm text-foreground/90 leading-relaxed">
                    {sec.body.map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                  <div className="mt-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1.5">
                      <Lightbulb size={13} />攻略ポイント
                    </p>
                    <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
                      {sec.points.map((pt, i) => (
                        <li key={i} className="flex gap-1.5"><span className="shrink-0">・</span>{pt}</li>
                      ))}
                    </ul>
                  </div>
                  <SectionImages prefix={sec.key} />
                </section>
              ))}
              <p className="text-xs text-muted-foreground">
                ※ セクションは随時追加していきます。追加したい項目（上位表示・口コミ・写真・料金表示など）があれば伝えてください。
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                </div>
              ) : (
                <>
                  {mediaList.map((m) => (
                    <MediaCard key={m.id} media={m} onSaved={fetchMedia} onDeleted={fetchMedia} />
                  ))}
                  {mediaList.length === 0 && (
                    <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground text-sm">
                      まだ媒体がありません。「媒体を追加」から作成してください。
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={handleAdd}>
                    <Plus size={15} className="mr-1.5" />媒体を追加
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
