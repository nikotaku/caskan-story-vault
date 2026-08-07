import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Search, Filter, Camera, Clock, TrendingUp, Sparkles, Loader2, Link as LinkIcon, Copy, Eye, EyeOff, CalendarPlus, GripVertical, FileUp, X, ChevronDown, ChevronRight, ExternalLink, Bot } from "lucide-react";
import { driveImgUrl } from "@/lib/drive";
import { ImportModal } from "@/components/ImportModal";
import { EstamaImportModal, type EstamaProfileData } from "@/components/EstamaImportModal";
import { EstamaAutomationModal } from "@/components/EstamaAutomationModal";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { runEstamaCastAutomation } from "@/lib/estamaAutomation";

const THERAPIST_FEATURES = [
  "新人", "経験豊富", "業界未経験", "施術上手", "上品", "甘えん坊", "おとなしい", "おっとり",
  "明るい", "優しい", "努力家", "礼儀正しい", "清楚系", "天然系", "セクシー系", "お姉様系",
  "お嬢様系", "ギャル系", "美人系", "熟女系", "かわいい系", "アイドル系", "癒し系", "妹系",
  "モデル体型", "小柄", "色白肌",
];

const MAX_FEATURES = 4;

// エステ魂の「特徴」チェックボックス: ラベル → value(id) マップ
const ESTAMA_FEATURE_MAP: Record<string, string> = {
  "新人": "1", "経験豊富": "2", "業界未経験": "3", "施術上手": "28", "上品": "25",
  "甘えん坊": "4", "おとなしい": "5", "おっとり": "7", "明るい": "8", "優しい": "32",
  "努力家": "30", "礼儀正しい": "27", "清楚系": "9", "天然系": "10", "セクシー系": "11",
  "お姉様系": "12", "お嬢様系": "29", "ギャル系": "19", "美人系": "20", "熟女系": "21",
  "かわいい系": "22", "アイドル系": "24", "癒し系": "23", "妹系": "26",
  "モデル体型": "16", "小柄": "31", "色白肌": "18",
};

// 一度だけブックマークバーに登録する固定ブックマークレット。
// クリップボードのキャストデータ(JSON)を読み取り、エステ魂のフォームへ自動入力する。
const ESTAMA_BOOKMARKLET = `javascript:(function(){function go(D){function fire(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('keyup',{bubbles:true}));}function setSel(sel,val){if(val==null||val==='')return;var el=document.querySelector(sel);if(el){el.value=val;fire(el);}}setSel('#Name',D.name);setSel('#Description',D.description);setSel('#CastPr',D.cast_pr);setSel('[name=experience]',D.experience);setSel('[name=age]',D.age);setSel('[name=tall]',D.tall);setSel('[name=size_w]',D.size_w);setSel('[name=size_h]',D.size_h);setSel('[name=blood]',D.blood);setSel('#ForteProcedure',D.forte_procedure);setSel('#Food',D.food);setSel('#ManLikeType',D.man_like_type);setSel('#LikeTalent',D.like_talent);setSel('#Holiday',D.holiday);setSel('#Vogue',D.vogue);setSel('#Blog',D.blog);setSel('#Twitter',D.twitter);setSel('#Instagram',D.instagram);setSel('[name=size_b]',D.size_b);setTimeout(function(){setSel('[name=size_cup]',D.size_cup);},500);(D.types||[]).forEach(function(v){var c=document.getElementById('type_'+v);if(c&&!c.checked){c.checked=true;fire(c);}});var photos=D.photos||[];var fi=[].slice.call(document.querySelectorAll('input[type=file]'));var done=0,fail=0;function rep(){if(done+fail<photos.length)return;alert('エスたま:「'+D.name+'」入力完了。写真'+done+'/'+photos.length+'枚。内容を確認して保存を押してください。');}if(!photos.length)rep();photos.forEach(function(u,i){var input=fi[i];if(!input){fail++;rep();return;}fetch(u).then(function(r){return r.blob();}).then(function(b){var ext=(b.type&&b.type.indexOf('png')>=0)?'png':'jpg';var f=new File([b],'photo'+(i+1)+'.'+ext,{type:b.type||'image/jpeg'});var dt=new DataTransfer();dt.items.add(f);input.files=dt.files;fire(input);done++;rep();}).catch(function(){fail++;rep();});});}if(location.hostname.indexOf('estama')<0){alert('エステ魂のセラピスト登録ページ(estama.jp/admin/cast_edit/)を開いてからクリックしてください。');return;}navigator.clipboard.readText().then(function(t){var D;try{D=JSON.parse(t);}catch(e){alert('クリップボードにデータがありません。先にキャスト管理で「エスたま」ボタンを押してください。');return;}if(!D||!D.__estama){alert('エスたまデータが見つかりません。先にキャスト管理で「エスたま」ボタンを押してください。');return;}go(D);}).catch(function(e){alert('クリップボードの読取りに失敗しました。ブラウザの許可ダイアログで「許可」を押してから、もう一度クリックしてください。');});})();`;

const CATEGORY_TAGS = ["ノーステータス", "入店手続き---面談予定", "入店手続き---講習予定", "在籍", "出稼ぎ"] as const;
type CategoryTag = typeof CATEGORY_TAGS[number];

const CATEGORY_LABELS: Record<CategoryTag, { main: string; sub?: string }> = {
  "ノーステータス": { main: "ノーステータス" },
  "入店手続き---面談予定": { main: "入店手続き", sub: "面談予定" },
  "入店手続き---講習予定": { main: "入店手続き", sub: "講習予定" },
  "在籍": { main: "在籍" },
  "出稼ぎ": { main: "出稼ぎ" },
};

const LEVEL_TAGS = ["ビギナーズ", "スタンダード", "ソルジャー", "マスター"] as const;
type LevelTag = typeof LEVEL_TAGS[number];

const LEVEL_BADGES: Record<LevelTag, { icon: string; className: string }> = {
  "ビギナーズ": { icon: "🌱", className: "bg-emerald-100 text-emerald-700 border border-emerald-300" },
  "スタンダード": { icon: "🎖️", className: "bg-blue-100 text-blue-700 border border-blue-300" },
  "ソルジャー": { icon: "🔥", className: "bg-orange-100 text-orange-700 border border-orange-300" },
  "マスター": { icon: "👑", className: "bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm" },
};

// レベル別特典表（習熟度に応じた待遇アップ）
const LEVEL_PERKS: { label: string; values: Record<LevelTag, string> }[] = [
  {
    label: "昇格条件",
    values: {
      "ビギナーズ": "講習中・デビュー前",
      "スタンダード": "初出勤済み・SNS教育中",
      "ソルジャー": "SNS投稿こなし、日7〜8万水準",
      "マスター": "本指名率30%以上・皆勤・クレームなし",
    },
  },
  {
    label: "雑費",
    values: {
      "ビギナーズ": "通常",
      "スタンダード": "通常",
      "ソルジャー": "半額",
      "マスター": "無料",
    },
  },
  {
    label: "姫予約バック",
    values: {
      "ビギナーズ": "—",
      "スタンダード": "+1,000円",
      "ソルジャー": "+3,000円",
      "マスター": "+5,000円",
    },
  },
];

// 特典セルの強調表示（無料・最高額など）
const PERK_HIGHLIGHT = new Set(["無料", "半額", "+5,000円", "+3,000円"]);

const ALL_SYSTEM_TAGS = [...CATEGORY_TAGS, ...LEVEL_TAGS] as readonly string[];

const THERAPIST_EXPERIENCE_OPTIONS = ["1年未満", "1〜3年", "3〜5年", "5年以上"];
const BLOOD_TYPES = ["A", "B", "O", "AB"];
const BUST_SIZES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

interface Cast {
  id: string;
  name: string;
  name_kana: string | null;
  real_name: string | null;
  name_en: string | null;
  type: string;
  status: string;
  photo: string | null;
  photos: string[] | null;
  profile: string | null;
  room: string | null;
  execution_date_start: string | null;
  execution_date_end: string | null;
  hp_notice: string | null;
  upload_check: string | null;
  x_account: string | null;
  message: string | null;
  line_url: string | null;
  litlink_url: string | null;
  o2_url: string | null;
  o2_login_url?: string | null;
  o2_login_email?: string | null;
  o2_login_id?: string | null;
  join_date: string;
  access_token?: string | null;
  therapist_years: number | null;
  therapist_experience: string | null;
  favorite_techniques: string | null;
  favorite_food: string | null;
  ideal_type: string | null;
  celebrity_lookalike: string | null;
  day_off_activities: string | null;
  hobbies: string | null;
  ideal_partner: string | null;
  follow_list: string | null;
  media_registration: string[] | null;
  marks: string[] | null;
  features: string[] | null;
  files: string[] | null;
  registration_sheet: string | null;
  format_type: string | null;
  recent_dispatch_details: string | null;
  memo: string | null;
  dispatch_status: string | null;
  repeat_scheduled: boolean | null;
  is_visible: boolean;
  estama_listed?: boolean | null;
  esuran_listed?: boolean | null;
  o2_created?: boolean | null;
  o2_linkage_requested?: boolean | null;
  x_created?: boolean | null;
  x_list_added?: boolean | null;
  x_ff_completed?: boolean | null;
  self_intro_tweeted?: boolean | null;
  display_order?: number;
  blood_type: string | null;
  height: number | null;
  weight: number | null;
  bust_size: string | null;
  shop_comment: string | null;
  therapist_comment: string | null;
  age: number | null;
  hometown: string | null;
  birth_date: string | null;
  body_size: string | null;
  enrollment_period: string | null;
  hobby: string | null;
  celebrity_like: string | null;
  uses_sns: boolean | null;
  blog_url: string | null;
  estama_profile_url?: string | null;
  skebiy_url: string | null;
  instagram_url: string | null;
  custom_fields: Record<string, string> | null;
  tags: string[] | null;
  customer_base_memo: string | null;
  referral_route: string | null;
  interview_sheet_url: string | null;
  referral_reward_id: string | null;
  profile_format: string | null;
  management_photos: string[] | null;
}

type CastChecklistField =
  | "estama_listed"
  | "esuran_listed"
  | "o2_created"
  | "o2_linkage_requested"
  | "x_created"
  | "x_list_added"
  | "x_ff_completed"
  | "self_intro_tweeted";

const CAST_CHECKLIST_ITEMS: readonly { field: CastChecklistField; label: string }[] = [
  { field: "estama_listed", label: "エスたまに登録" },
  { field: "esuran_listed", label: "エスランに登録" },
  { field: "o2_created", label: "02の作成" },
  { field: "o2_linkage_requested", label: "02の連携申請" },
  { field: "x_created", label: "Xの作成" },
  { field: "x_list_added", label: "Xのリスト入り" },
  { field: "x_ff_completed", label: "XのFF" },
  { field: "self_intro_tweeted", label: "自己紹介ツイート" },
];

interface ReferralReward {
  id: string;
  name: string;
  amount: number;
}

export default function Staff() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [referralRewards, setReferralRewards] = useState<ReferralReward[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEstamaImportOpen, setIsEstamaImportOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCast, setEditingCast] = useState<Cast | null>(null);
  const [mgmtProps, setMgmtProps] = useState<{ key: string; value: string }[]>([]);
  const [categoryTab, setCategoryTab] = useState<CategoryTag>("ノーステータス");
  const [showProfileDetail, setShowProfileDetail] = useState(true);
  const [showProfileDetailAdd, setShowProfileDetailAdd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatingShopComment, setGeneratingShopComment] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");
  const [blogIconUrl, setBlogIconUrl] = useState("");
  const [skebiyIconUrl, setSkebiyIconUrl] = useState("");
  
  const emptyForm = {
    name: "",
    name_kana: "",
    real_name: "",
    name_en: "",
    type: "インルーム",
    room: "インルーム",
    status: "offline",
    profile: "",
    photo: "",
    photos: [] as string[],
    blood_type: "",
    height: "" as string | number,
    weight: "" as string | number,
    bust_size: "",
    shop_comment: "",
    therapist_comment: "",
    features: [] as string[],
    therapist_experience: "",
    favorite_techniques: "",
    age: "" as string | number,
    hometown: "",
    birth_date: "",
    body_size: "",
    enrollment_period: "",
    favorite_food: "",
    ideal_type: "",
    celebrity_lookalike: "",
    day_off_activities: "",
    hobbies: "",
    ideal_partner: "",
    celebrity_like: "",
    uses_sns: false,
    hobby: "",
    blog_url: "",
    x_account: "",
    skebiy_url: "",
    instagram_url: "",
    estama_profile_url: "",
    estama_auto_register: true,
    estama_account_email: "",
    estama_account_password: "",
    therapist_years: 0,
    follow_list: "",
    media_registration: [] as string[],
    marks: [] as string[],
    files: [] as string[],
    registration_sheet: "",
    format_type: "",
    recent_dispatch_details: "",
    memo: "",
    dispatch_status: "none",
    repeat_scheduled: false,
  };
  // フォーム用の状態
  const [formData, setFormData] = useState({ ...emptyForm });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [perksOpen, setPerksOpen] = useState(false);
  const [estamaDialogOpen, setEstamaDialogOpen] = useState(false);
  const [estamaScript, setEstamaScript] = useState("");
  const [estamaData, setEstamaData] = useState("");
  const [estamaCastName, setEstamaCastName] = useState("");
  const [estamaCopied, setEstamaCopied] = useState(false);
  const [estamaShowConsole, setEstamaShowConsole] = useState(false);
  const [estamaAutomationOpen, setEstamaAutomationOpen] = useState(false);
  const [addingCast, setAddingCast] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // AIメモ登録
  const [memoText, setMemoText] = useState("");
  const [parsingMemo, setParsingMemo] = useState(false);
  const [memoMode, setMemoMode] = useState<"new" | "existing">("new");
  const [memoTargetCastId, setMemoTargetCastId] = useState("");
  const dragCastId = useRef<string | null>(null);
  const dragPhotoIdxRef = useRef<number | null>(null);
  const addPhotoInputRef = useRef<HTMLInputElement>(null);
  const editPhotoInputRef = useRef<HTMLInputElement>(null);
  const interviewSheetInputRef = useRef<HTMLInputElement>(null);
  const managementPhotoInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  // 認証チェック
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // キャストデータを取得
  useEffect(() => {
    fetchCasts();
    fetchReferralRewards();

    // リアルタイム更新を購読
    const channel = supabase
      .channel('casts-changes')
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

  // 称号バッジマスタ（HP写真右上のバッジ）
  const [titleBadges, setTitleBadges] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    supabase.from("cast_title_badges" as any).select("id, label").eq("is_active", true)
      .order("display_order").then(({ data }) => setTitleBadges((data || []) as any));
  }, []);

  const fetchCasts = async () => {
    try {
      const { data, error } = await supabase
        .from('casts')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCasts((data || []) as Cast[]);
    } catch (error) {
      console.error('Error fetching casts:', error);
      toast({
        title: "エラー",
        description: "キャスト情報の取得に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchReferralRewards = async () => {
    const { data } = await supabase
      .from('referral_rewards')
      .select('id, name, amount')
      .eq('is_active', true)
      .order('name');
    setReferralRewards((data || []) as ReferralReward[]);
  };

  const getCastCategory = (cast: Cast): CategoryTag => {
    if (!cast.tags || cast.tags.length === 0) return "ノーステータス";
    for (const tag of CATEGORY_TAGS) {
      if (cast.tags.includes(tag)) return tag;
    }
    return "ノーステータス";
  };

  const getCastLevel = (cast: Cast): LevelTag | null => {
    if (!cast.tags) return null;
    for (const tag of LEVEL_TAGS) {
      if (cast.tags.includes(tag)) return tag;
    }
    return null;
  };

  const handleSetLevelTag = async (castId: string, level: LevelTag | "") => {
    const cast = casts.find(c => c.id === castId);
    if (!cast) return;
    const otherTags = (cast.tags || []).filter(t => !LEVEL_TAGS.includes(t as LevelTag));
    const newTags = level ? [...otherTags, level] : otherTags;
    setCasts(prev => prev.map(c => c.id === castId ? { ...c, tags: newTags } : c));
    setEditingCast(prev => prev && prev.id === castId ? { ...prev, tags: newTags } : prev);
    const { error } = await supabase.from('casts').update({ tags: newTags }).eq('id', castId);
    if (error) {
      toast({ title: "エラー", description: "レベルの更新に失敗しました", variant: "destructive" });
      fetchCasts();
    }
  };

  // エステ魂プロフィールURLから写メ日記を取り込む
  const [importingDiary, setImportingDiary] = useState(false);
  const handleImportDiary = async () => {
    if (!editingCast) return;
    if (!editingCast.estama_profile_url) {
      toast({ title: "エステ魂プロフィールURLを入力してください", variant: "destructive" });
      return;
    }
    setImportingDiary(true);
    try {
      // 先にURLを保存（未保存でも取り込めるようにDBを更新）
      await supabase.from("casts").update({ estama_profile_url: editingCast.estama_profile_url }).eq("id", editingCast.id);
      const { data, error } = await supabase.functions.invoke("import-estama-diary", { body: { cast_id: editingCast.id } });
      if (error || (data as any)?.error) {
        toast({ title: "取り込みに…27189 tokens truncated…詳細</Label>
                          <Textarea id="e-recent-dispatch" rows={2} className="mt-1" value={editingCast.recent_dispatch_details || ""} onChange={(e) => setEditingCast({...editingCast, recent_dispatch_details: e.target.value})} />
                        </div>
                        <div>
                          <Label>面談シート（画像）</Label>
                          <input ref={interviewSheetInputRef} type="file" accept="image/*" className="hidden" onChange={handleInterviewSheetUpload} />
                          <div className="mt-1 space-y-2">
                            {editingCast.interview_sheet_url && (
                              <div className="relative inline-block">
                                <img src={editingCast.interview_sheet_url} alt="面談シート" className="max-h-48 rounded border" />
                                <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => setEditingCast({...editingCast, interview_sheet_url: null})}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <Button type="button" variant="outline" size="sm" onClick={() => interviewSheetInputRef.current?.click()} disabled={uploadingPhoto}>
                              <Camera className="h-4 w-4 mr-1.5" />
                              {uploadingPhoto ? "アップロード中..." : editingCast.interview_sheet_url ? "画像を変更" : "画像をアップロード"}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label>画像ストック</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            「プロフィール」タブの画像ストック欄に移動しました（{(editingCast.management_photos || []).length}枚登録済み）
                          </p>
                        </div>
                      </div>

                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">管理プロパティ</Label>
                          <Button type="button" size="sm" variant="outline" onClick={addMgmtProp}>
                            <Plus className="h-3.5 w-3.5 mr-1" />プロパティを追加
                          </Button>
                        </div>
                        {mgmtProps.length === 0 ? (
                          <p className="text-xs text-muted-foreground">「プロパティを追加」で項目名と値を自由に登録できます（例: 媒体登録 / 派遣ステータス / 登録シートURL など）</p>
                        ) : (
                          mgmtProps.map((p, i) => (
                            <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/20">
                              <div className="flex gap-2 items-center">
                                <Input placeholder="項目名（例: 媒体登録）" value={p.key} onChange={(e) => updateMgmtProp(i, "key", e.target.value)} className="flex-1" />
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeMgmtProp(i)}><X className="h-4 w-4" /></Button>
                              </div>
                              <Textarea placeholder="値（長文・複数行も入力できます）" value={p.value} onChange={(e) => updateMgmtProp(i, "value", e.target.value)} rows={3} className="resize-y min-h-[72px]" />
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Button onClick={handleUpdateCast} className="w-full mt-4">
                    更新する
                  </Button>
                </DialogContent>
              </Dialog>
            )}

            <TabsContent value="management" className="space-y-4">
              {/* Category Tabs */}
              <div className="flex gap-0.5 border-b pb-0 overflow-x-auto scrollbar-none">
                {CATEGORY_TAGS.map((cat) => {
                  const count = casts.filter(c => getCastCategory(c) === cat).length;
                  const label = CATEGORY_LABELS[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryTab(cat)}
                      className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors leading-tight text-center min-w-[72px] ${
                        categoryTab === cat
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block">{label.main}</span>
                      {label.sub && <span className="block text-[10px] opacity-80">{label.sub}</span>}
                      <span className="mt-0.5 inline-block text-[11px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* レベル別特典表 */}
              <Card>
                <button
                  type="button"
                  className="w-full px-4 py-3 flex items-center justify-between"
                  onClick={() => setPerksOpen(v => !v)}
                >
                  <span className="font-semibold text-sm flex items-center gap-2">
                    🏆 レベル別特典表
                    <span className="text-xs font-normal text-muted-foreground">習熟度で待遇アップ</span>
                  </span>
                  {perksOpen ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                </button>
                {perksOpen && (
                  <CardContent className="p-0 pb-1">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[640px]">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="px-3 py-2 text-left font-semibold w-24"></th>
                            {LEVEL_TAGS.map(lv => (
                              <th key={lv} className="px-3 py-2 text-center">
                                <span className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold ${LEVEL_BADGES[lv].className}`}>
                                  <span>{LEVEL_BADGES[lv].icon}</span>{lv}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {LEVEL_PERKS.map(row => (
                            <tr key={row.label}>
                              <td className="px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">{row.label}</td>
                              {LEVEL_TAGS.map(lv => {
                                const v = row.values[lv];
                                const hot = PERK_HIGHLIGHT.has(v);
                                return (
                                  <td key={lv} className={`px-3 py-2.5 text-center ${hot ? "font-bold text-amber-600" : row.label === "昇格条件" ? "text-muted-foreground text-[11px]" : ""}`}>
                                    {v}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="px-4 py-2 text-[11px] text-muted-foreground">
                      ※ 姫予約バック＝自分で獲得した予約（専用リンク・SNS経由）1件あたりの追加バック。レベルはセラピスト詳細から設定できます。
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Search and Filter */}
              <Card>
              <CardContent className="p-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="キャスト名で検索..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cast List */}
            <div className="space-y-1">
              {categoryFilteredCasts.map((cast) => (
                <div
                  key={cast.id}
                  draggable={isAdmin}
                  onDragStart={() => { dragCastId.current = cast.id; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropCast(cast.id)}
                  className="rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleEditCast(cast)}
                >
                  <div className="flex items-center gap-3 p-3 pb-2">
                    {isAdmin && (
                      <div
                        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                        title="ドラッグして並び替え"
                      >
                        <GripVertical size={16} />
                      </div>
                    )}
                    {/* Photo */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {cast.photo ? (
                        <img src={cast.photo} alt={cast.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera size={16} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{cast.name}</span>
                        {getCastLevel(cast) && (
                          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${LEVEL_BADGES[getCastLevel(cast)!].className}`}>
                            <span>{LEVEL_BADGES[getCastLevel(cast)!].icon}</span>
                            {getCastLevel(cast)}
                          </span>
                        )}
                        {!cast.is_visible && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            <EyeOff size={10} className="mr-0.5" />非表示
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 詳細へ */}
                    <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground" />
                  </div>

                  {/* 登録・SNS準備チェック（タップで切替） */}
                  <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {CAST_CHECKLIST_ITEMS.map((item) => {
                      const on = !!cast[item.field];
                      return (
                        <button
                          key={item.field}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleChecklist(cast.id, item.field, !on); }}
                          title={on ? `${item.label}済み（タップで解除）` : `${item.label}未完了（タップで完了）`}
                          aria-pressed={on}
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-semibold transition-colors ${
                            on
                          ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                          : "bg-muted text-muted-foreground border-transparent hover:border-border"
                          }`}
                        >
                          <span className={on ? "" : "opacity-40"}>{on ? "✅" : "⬜️"}</span>
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {categoryFilteredCasts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {casts.length === 0
                  ? "キャストが登録されていません"
                  : `「${categoryTab}」のキャストはいません`}
              </div>
            )}
            </TabsContent>

          </Tabs>
          </div>
        </main>
      </div>
      <ImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="casts"
        onSuccess={fetchCasts}
      />
      <EstamaImportModal
        open={isEstamaImportOpen}
        onOpenChange={setIsEstamaImportOpen}
        onImported={handleEstamaProfileImported}
      />
      <EstamaAutomationModal open={estamaAutomationOpen} onOpenChange={setEstamaAutomationOpen} />

      {/* エスたま転記ダイアログ */}
      <Dialog open={estamaDialogOpen} onOpenChange={setEstamaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink size={18} className="text-pink-600" />
              「{estamaCastName}」をエスたまに転記
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              「{estamaCastName}」のデータをコピーしました。下記の手順で転記します（コンソール不要）。
            </p>

            <div className="rounded-lg border border-pink-200 bg-pink-50/50 p-3 space-y-2">
              <p className="font-semibold text-pink-700">① 初回だけ：ブックマークレットを登録</p>
              <p className="text-xs text-muted-foreground">
                下のボタンを<strong>ブックマークバーにドラッグ</strong>して登録してください（一度だけでOK）。
              </p>
              <a
                ref={(el) => { if (el) el.setAttribute("href", ESTAMA_BOOKMARKLET); }}
                onClick={(e) => { e.preventDefault(); toast({ title: "これはドラッグして登録するボタンです", description: "ブックマークバーにドラッグしてください" }); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-pink-600 text-white text-sm font-medium cursor-move select-none no-underline"
                draggable
              >
                <ExternalLink size={14} />★エスたま自動入力
              </a>
            </div>

            <ol className="list-decimal list-inside space-y-2 bg-muted/50 rounded-lg p-3">
              <li>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 mx-1"
                  onClick={() => window.open("https://estama.jp/admin/cast_edit/", "_blank")}
                >
                  <ExternalLink size={14} />エステ魂の登録ページを開く
                </Button>
                <span className="text-muted-foreground text-xs">（要ログイン）</span>
              </li>
              <li>そのページで、登録した<strong>「★エスたま自動入力」ブックマークをクリック</strong></li>
              <li>各項目と写真が自動入力されたら、内容を確認して「保存する」を押す</li>
            </ol>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(estamaData);
                    setEstamaCopied(true);
                    setTimeout(() => setEstamaCopied(false), 2000);
                  } catch { /* noop */ }
                }}
              >
                {estamaCopied ? <Eye size={14} /> : <Copy size={14} />}
                {estamaCopied ? "コピー済" : "データを再コピー"}
              </Button>
              <span className="text-xs text-muted-foreground">クリップボードが上書きされた場合はこちら</span>
            </div>

            <p className="text-xs text-muted-foreground">
              ※名前・コメント・年齢・身長・3サイズ・血液型・特徴・SNS・写真（最大6枚）を転記します。
            </p>

            {/* コンソール方式（上級者向けフォールバック） */}
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setEstamaShowConsole((v) => !v)}
            >
              {estamaShowConsole ? "コンソール方式を隠す" : "うまくいかない場合：コンソール方式を使う"}
            </button>
            {estamaShowConsole && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  エステ魂ページで <kbd className="px-1 py-0.5 bg-background border rounded">F12</kbd> →「コンソール」を開き、下を貼り付けて Enter。
                  初回は <code className="bg-muted px-1 rounded">allow pasting</code> と入力して Enter してから貼り付けてください。
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => { try { await navigator.clipboard.writeText(estamaScript); } catch { /* noop */ } }}
                >
                  <Copy size={14} />スクリプトをコピー
                </Button>
                <Textarea
                  readOnly
                  value={estamaScript}
                  className="font-mono text-[11px] h-28"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

