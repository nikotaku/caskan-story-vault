import { useState, useEffect, useRef } from "react";
import { Plus, Edit, Trash2, Search, Filter, Camera, Clock, TrendingUp, Sparkles, Loader2, Link as LinkIcon, Copy, Eye, EyeOff, CalendarPlus, GripVertical, FileUp, X, ChevronDown, ChevronRight, ExternalLink, Bot, AlertTriangle } from "lucide-react";
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
  const [expandedChecklistIds, setExpandedChecklistIds] = useState<Set<string>>(new Set());
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

  const isSbLinked = (cast: Cast) => Boolean(cast.referral_reward_id);

  const toggleChecklistSection = (castId: string) => {
    setExpandedChecklistIds(prev => {
      const next = new Set(prev);
      if (next.has(castId)) next.delete(castId);
      else next.add(castId);
      return next;
    });
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
        toast({ title: "取り込みに失敗しました", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      } else {
        toast({ title: `写メ日記を${(data as any)?.count ?? 0}件取り込みました` });
      }
    } finally {
      setImportingDiary(false);
    }
  };

  // セラピスト登録・SNS準備のチェック状況を一覧から即切り替え。
  const toggleChecklist = async (castId: string, field: CastChecklistField, next: boolean) => {
    setCasts(prev => prev.map(c => c.id === castId ? { ...c, [field]: next } : c));
    setEditingCast(prev => prev && prev.id === castId ? { ...prev, [field]: next } : prev);
    const { error } = await supabase.from("casts").update({ [field]: next } as any).eq("id", castId);
    if (error) {
      toast({ title: "エラー", description: "チェック状況の更新に失敗しました", variant: "destructive" });
      fetchCasts();
    }
  };

  const filteredCasts = casts.filter(cast =>
    cast.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categoryFilteredCasts = filteredCasts.filter(cast => getCastCategory(cast) === categoryTab);
  const missingSbCasts = categoryFilteredCasts.filter(cast => !isSbLinked(cast));

  const handleAddCast = async () => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみキャストを追加できます",
        variant: "destructive",
      });
      return;
    }

    if (!!formData.estama_account_email !== !!formData.estama_account_password) {
      toast({
        title: "魂セラピスト設定を確認してください",
        description: "メールアドレスと初期パスワードは両方入力するか、両方空欄にしてください",
        variant: "destructive",
      });
      return;
    }

    setAddingCast(true);
    try {
      // Step 1: insert base fields
      const { data: inserted, error } = await supabase
        .from('casts')
        .insert([{
          name: formData.name.trim() || "名称未設定",
          type: formData.type,
          room: formData.room,
          status: formData.status,
          profile: formData.therapist_comment || formData.profile || null,
          photo: formData.photos[0] || null,
          photos: formData.photos.length > 0 ? formData.photos : null,
          x_account: formData.x_account || null,
          therapist_years: formData.therapist_years || null,
          favorite_techniques: formData.favorite_techniques || null,
          favorite_food: formData.favorite_food || null,
          ideal_partner: formData.ideal_partner || null,
          follow_list: formData.follow_list || null,
          media_registration: formData.media_registration.length > 0 ? formData.media_registration : null,
          marks: formData.marks.length > 0 ? formData.marks : null,
          files: formData.files.length > 0 ? formData.files : null,
          registration_sheet: formData.registration_sheet || null,
          format_type: formData.format_type || null,
          recent_dispatch_details: formData.recent_dispatch_details || null,
          memo: formData.memo || null,
          dispatch_status: formData.dispatch_status || 'none',
          repeat_scheduled: formData.repeat_scheduled || false,
          estama_auto_register: formData.estama_auto_register,
        } as never])
        .select('id, store_id')
        .single();

      if (error) throw error;

      // Step 2: update new profile fields (silent fail if migration not run)
      if (inserted?.id) {
        const { error: profileError } = await supabase.from('casts').update({
          name_kana: formData.name_kana || null,
          real_name: formData.real_name || null,
          name_en: formData.name_en || null,
          blood_type: formData.blood_type || null,
          height: formData.height !== "" ? Number(formData.height) : null,
          weight: formData.weight !== "" ? Number(formData.weight) : null,
          bust_size: formData.bust_size || null,
          shop_comment: formData.shop_comment || null,
          therapist_comment: formData.therapist_comment || null,
          features: formData.features.length > 0 ? formData.features : null,
          therapist_experience: formData.therapist_experience || null,
          age: formData.age !== "" ? Number(formData.age) : null,
          hometown: formData.hometown || null,
          birth_date: formData.birth_date || null,
          body_size: formData.body_size || null,
          enrollment_period: formData.enrollment_period || null,
          favorite_food: formData.favorite_food || null,
          ideal_type: formData.ideal_type || null,
          celebrity_lookalike: formData.celebrity_lookalike || null,
          day_off_activities: formData.day_off_activities || null,
          hobbies: formData.hobbies || null,
          hobby: formData.hobby || null,
          celebrity_like: formData.celebrity_like || null,
          uses_sns: formData.uses_sns || false,
          blog_url: formData.blog_url || null,
          skebiy_url: formData.skebiy_url || null,
          instagram_url: formData.instagram_url || null,
          estama_profile_url: formData.estama_profile_url || null,
        }).eq('id', inserted.id);
        if (profileError) throw profileError;
      }

      toast({ title: "追加しました", description: "新しいセラピストが登録されました" });
      setIsAddDialogOpen(false);
      if (inserted?.id && formData.estama_auto_register) {
        try {
          const soulCredentials = formData.estama_account_email && formData.estama_account_password
            ? { email: formData.estama_account_email, password: formData.estama_account_password }
            : undefined;
          const result = await runEstamaCastAutomation({
            storeId: inserted.store_id,
            castId: inserted.id,
            soulCredentials,
          });
          const completed = (result.results || []).some((item) => item.status === "completed");
          if (completed) toast({ title: "エスたまへ自動登録しました" });
          else toast({ title: "エスたま登録を待機中です", description: (result.results || [])[0]?.error || "自動化設定を確認してください" });
        } catch (automationError) {
          toast({
            title: "キャスカンへの追加は完了しました",
            description: `エスたま登録は待機中です：${automationError instanceof Error ? automationError.message : String(automationError)}`,
          });
        }
      }
      setFormData({ ...emptyForm });
    } catch (error: unknown) {
      console.error('Error adding cast:', error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "キャストの追加に失敗しました",
        variant: "destructive",
      });
    } finally {
      setAddingCast(false);
    }
  };

  const handleEstamaProfileImported = (profile: EstamaProfileData) => {
    const photos = (profile.photos || []).filter(Boolean).slice(0, 6);
    const features = (profile.features || [])
      .filter((feature) => THERAPIST_FEATURES.includes(feature))
      .slice(0, MAX_FEATURES);
    const therapistExperience = THERAPIST_EXPERIENCE_OPTIONS.includes(profile.therapist_experience)
      ? profile.therapist_experience
      : "";

    setFormData({
      ...emptyForm,
      name: profile.name || "",
      age: profile.age ?? "",
      height: profile.height ?? "",
      body_size: profile.body_size || "",
      hometown: profile.hometown || "",
      bust_size: profile.cup_size || "",
      blood_type: profile.blood_type || "",
      therapist_experience: therapistExperience,
      favorite_techniques: profile.favorite_techniques || "",
      favorite_food: profile.favorite_food || "",
      ideal_type: profile.ideal_type || "",
      celebrity_lookalike: profile.celebrity_lookalike || "",
      day_off_activities: profile.day_off_activities || "",
      hobbies: profile.hobbies || "",
      therapist_comment: profile.therapist_comment || "",
      profile: profile.therapist_comment || "",
      shop_comment: profile.shop_comment || "",
      features,
      photos,
      photo: photos[0] || "",
      x_account: profile.x_account || "",
      instagram_url: profile.instagram_url || "",
      blog_url: profile.blog_url || "",
      estama_profile_url: profile.source_url || "",
      estama_auto_register: false,
      estama_account_email: "",
      estama_account_password: "",
    });
    setShowProfileDetailAdd(true);
    setIsAddDialogOpen(true);
    toast({
      title: "エスたまから情報を取り込みました",
      description: "内容を確認・修正してから登録してください",
    });
  };

  const handleEditCast = async (cast: Cast) => {
    console.log('handleEditCast called', { cast, isAdmin });
    
    // 最新のデータを取得してから編集ダイアログを開く
    try {
      const { data, error } = await supabase
        .from('casts')
        .select('*')
        .eq('id', cast.id)
        .single();
      
      if (error) throw error;

      setEditingCast(data as Cast);
      const cf = (data as Cast).custom_fields || {};
      setBlogIconUrl(cf.blog_icon || "");
      setSkebiyIconUrl(cf.skebiy_icon || "");
      setCustomTagInput("");
      setMgmtProps(Object.entries(cf).filter(([k]) => !['blog_icon','skebiy_icon'].includes(k)).map(([key, value]) => ({ key, value: String(value) })));
      setIsEditDialogOpen(true);
      console.log('Dialog opened with latest data:', data);
    } catch (error) {
      console.error('Error fetching latest cast data:', error);
      const cf = cast.custom_fields || {};
      setBlogIconUrl(cf.blog_icon || "");
      setSkebiyIconUrl(cf.skebiy_icon || "");
      setCustomTagInput("");
      setEditingCast(cast);
      setMgmtProps(Object.entries(cf).filter(([k]) => !['blog_icon','skebiy_icon'].includes(k)).map(([key, value]) => ({ key, value: String(value) })));
      setIsEditDialogOpen(true);
    }
  };

  const addMgmtProp = () => setMgmtProps((p) => [...p, { key: "", value: "" }]);
  const updateMgmtProp = (i: number, field: "key" | "value", val: string) =>
    setMgmtProps((p) => p.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)));
  const removeMgmtProp = (i: number) => setMgmtProps((p) => p.filter((_, idx) => idx !== i));

  // 02アカウントの案内文をコピー（パスワードは管理画面から共有しない）
  const handleCopyO2Account = (cast: Cast) => {
    const text = [
      `【${cast.name} 02アカウント】`,
      "■管理画面URL",
      cast.o2_login_url || "https://m-sns.net/cast/login/",
      "■登録メールアドレス",
      cast.o2_login_email || "（未登録）",
      "■ID",
      cast.o2_login_id || "（未登録）",
      "■パスワード",
      "セラピスト本人がO2接続設定へ直接入力してください（共有禁止）",
    ].join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "コピーしました", description: "02アカウント情報をクリップボードにコピーしました" }),
      () => toast({ title: "コピーに失敗しました", variant: "destructive" }),
    );
  };

  // ブログ・SNS情報の共有文面をクリップボードへコピー（空欄の項目は省略）
  const handleCopySns = (cast: Cast) => {
    const xUrl = cast.x_account
      ? `https://x.com/${cast.x_account.replace(/^@/, "")}（${cast.x_account.startsWith("@") ? cast.x_account : `@${cast.x_account}`}）`
      : null;
    const lines = [
      `【${cast.name} ブログ・SNS】`,
      cast.blog_url ? `■外部ブログ(02)\n${cast.blog_url}` : null,
      xUrl ? `■X (Twitter)\n${xUrl}` : null,
      cast.skebiy_url ? `■Skebiy\n${cast.skebiy_url}` : null,
      cast.instagram_url ? `■Instagram\n${cast.instagram_url}` : null,
      cast.line_url ? `■LINE\n${cast.line_url}` : null,
      cast.litlink_url ? `■リットリンク\n${cast.litlink_url}` : null,
    ].filter(Boolean);
    if (lines.length <= 1) {
      toast({ title: "コピーする項目がありません", description: "ブログ・SNSが未入力です", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast({ title: "コピーしました", description: "ブログ・SNS情報をクリップボードにコピーしました" }),
      () => toast({ title: "コピーに失敗しました", variant: "destructive" }),
    );
  };

  const handleUpdateCast = async () => {
    if (!isAdmin || !editingCast) {
      toast({
        title: "権限エラー",
        description: "管理者のみキャストを更新できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const photos = editingCast.photos || [];

      // Step 1: update base fields (always exist in DB)
      const basePayload: Record<string, any> = {
        name: editingCast.name?.trim() || "名称未設定",
        type: editingCast.type,
        room: editingCast.room,
        status: editingCast.status,
        profile: editingCast.therapist_comment || editingCast.profile || null,
        photo: photos.length > 0 ? photos[0] : null,
        photos: photos.length > 0 ? photos : null,
        x_account: editingCast.x_account || null,
        message: editingCast.message || null,
        line_url: editingCast.line_url || null,
        litlink_url: editingCast.litlink_url || null,
        o2_url: editingCast.o2_url || null,
        o2_login_url: editingCast.o2_login_url || 'https://m-sns.net/cast/login/',
        o2_login_email: editingCast.o2_login_email || null,
        o2_login_id: editingCast.o2_login_id || null,
        hp_notice: editingCast.hp_notice || null,
        therapist_years: editingCast.therapist_years || null,
        favorite_techniques: editingCast.favorite_techniques || null,
        favorite_food: editingCast.favorite_food || null,
        ideal_partner: editingCast.ideal_partner || null,
        follow_list: editingCast.follow_list || null,
        media_registration: editingCast.media_registration || null,
        marks: editingCast.marks || null,
        files: editingCast.files || null,
        registration_sheet: editingCast.registration_sheet || null,
        format_type: editingCast.format_type || null,
        recent_dispatch_details: editingCast.recent_dispatch_details || null,
        memo: editingCast.memo || null,
        dispatch_status: editingCast.dispatch_status || 'none',
        repeat_scheduled: editingCast.repeat_scheduled || false,
        customer_base_memo: editingCast.customer_base_memo || null,
        referral_route: editingCast.referral_route || null,
        interview_sheet_url: editingCast.interview_sheet_url || null,
        referral_reward_id: editingCast.referral_reward_id || null,
        management_photos: editingCast.management_photos || [],
        is_visible: editingCast.is_visible,
        title_badge_id: (editingCast as any).title_badge_id || null,
        tags: editingCast.tags || [],
        custom_fields: {
          ...Object.fromEntries(
            mgmtProps.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value])
          ),
          ...(blogIconUrl ? { blog_icon: blogIconUrl } : {}),
          ...(skebiyIconUrl ? { skebiy_icon: skebiyIconUrl } : {}),
        },
      };
      const { error: baseError } = await supabase.from('casts').update(basePayload).eq('id', editingCast.id);
      if (baseError) throw baseError;

      // Step 2: update new profile fields (requires migration SQL) — silent fail if columns missing
      const profilePayload: Record<string, any> = {
        name_kana: editingCast.name_kana || null,
        real_name: editingCast.real_name || null,
        name_en: editingCast.name_en || null,
        blood_type: editingCast.blood_type || null,
        height: editingCast.height || null,
        weight: editingCast.weight || null,
        bust_size: editingCast.bust_size || null,
        shop_comment: editingCast.shop_comment || null,
        therapist_comment: editingCast.therapist_comment || null,
        features: editingCast.features || null,
        therapist_experience: editingCast.therapist_experience || null,
        age: editingCast.age || null,
        hometown: editingCast.hometown || null,
        birth_date: editingCast.birth_date || null,
        body_size: editingCast.body_size || null,
        enrollment_period: editingCast.enrollment_period || null,
        favorite_food: editingCast.favorite_food || null,
        ideal_type: editingCast.ideal_type || null,
        celebrity_lookalike: editingCast.celebrity_lookalike || null,
        day_off_activities: editingCast.day_off_activities || null,
        hobbies: editingCast.hobbies || null,
        hobby: editingCast.hobby || null,
        celebrity_like: editingCast.celebrity_like || null,
        uses_sns: editingCast.uses_sns || false,
        blog_url: editingCast.blog_url || null,
        estama_profile_url: editingCast.estama_profile_url || null,
        skebiy_url: editingCast.skebiy_url || null,
        instagram_url: editingCast.instagram_url || null,
        profile_format: editingCast.profile_format || null,
      };
      const { error: profileError } = await supabase.from('casts').update(profilePayload).eq('id', editingCast.id);
      if (profileError) {
        console.warn('Profile fields not saved (migration may be needed):', profileError.message);
        toast({
          title: "基本情報を保存しました",
          description: "新プロフィール項目の保存にはDBマイグレーションが必要です",
        });
      } else {
        toast({ title: "保存しました", description: "セラピスト情報を更新しました" });
      }

      setIsEditDialogOpen(false);
      setEditingCast(null);
    } catch (error: any) {
      console.error('Error updating cast:', error);
      toast({
        title: "エラー",
        description: error?.message || "キャストの更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  // メモをAI解析してJSONを返す共通処理
  const parseMemoToFields = async (): Promise<Record<string, any>> => {
    const { data, error } = await supabase.functions.invoke('generate-cast-content', {
      body: { type: 'parse_memo', memo: memoText.trim() },
    });
    if (error) throw error;
    let raw = (data?.content ?? "").trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("解析結果が不正です");
    return JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  };

  // ① 新規登録: メモから新規追加ダイアログを下書き済みで開く
  const handleMemoNew = async () => {
    if (!memoText.trim()) { toast({ title: "メモを入力してください", variant: "destructive" }); return; }
    setParsingMemo(true);
    try {
      const parsed = await parseMemoToFields();
      const next: any = { ...emptyForm };
      for (const [k, v] of Object.entries(parsed)) {
        if (v === null || v === undefined || v === "") continue;
        if (k in next) next[k] = v as any;
      }
      setFormData(next);
      setShowProfileDetailAdd(true);
      setMemoText("");
      setIsAddDialogOpen(true);
      toast({ title: "AIが新規登録を下書きしました", description: "内容を確認して登録してください" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "解析に失敗しました", description: e?.message ?? "もう一度お試しください", variant: "destructive" });
    } finally {
      setParsingMemo(false);
    }
  };

  // ② 既存に追加: 選択したセラピストの空き項目をメモの内容で補完し、編集ダイアログを開く
  const handleMemoExisting = async () => {
    if (!memoText.trim()) { toast({ title: "メモを入力してください", variant: "destructive" }); return; }
    if (!memoTargetCastId) { toast({ title: "追加先のセラピストを選んでください", variant: "destructive" }); return; }
    setParsingMemo(true);
    try {
      const parsed = await parseMemoToFields();
      const { data: cast, error: fetchErr } = await supabase.from("casts").select("*").eq("id", memoTargetCastId).single();
      if (fetchErr) throw fetchErr;
      // 既存が空の項目のみメモの値で補完（既存の情報は上書きしない）
      const merged: any = { ...(cast as any) };
      for (const [k, v] of Object.entries(parsed)) {
        if (v === null || v === undefined || v === "") continue;
        const cur = merged[k];
        if (cur === null || cur === undefined || cur === "" || (Array.isArray(cur) && cur.length === 0)) {
          merged[k] = v as any;
        }
      }
      setEditingCast(merged as Cast);
      const cf = (cast as any).custom_fields || {};
      setBlogIconUrl(cf.blog_icon || "");
      setSkebiyIconUrl(cf.skebiy_icon || "");
      setCustomTagInput("");
      setMgmtProps(Object.entries(cf).filter(([k]) => !['blog_icon','skebiy_icon'].includes(k)).map(([key, value]) => ({ key, value: String(value) })));
      setShowProfileDetail(true);
      setMemoText("");
      setIsEditDialogOpen(true);
      toast({ title: "既存セラピストに反映しました", description: "空き項目を補完しました。確認して保存してください" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "反映に失敗しました", description: e?.message ?? "もう一度お試しください", variant: "destructive" });
    } finally {
      setParsingMemo(false);
    }
  };

  const handleGenerateShopComment = async (mode: 'add' | 'edit') => {
    const castName = mode === 'add' ? formData.name : editingCast?.name;
    const castType = mode === 'add' ? formData.type : editingCast?.type;
    const existingProfile = mode === 'add' ? formData.profile : editingCast?.profile;
    const features = mode === 'add' ? formData.features : editingCast?.features;
    if (!castName) {
      toast({ title: "エラー", description: "名前を先に入力してください", variant: "destructive" });
      return;
    }
    setGeneratingShopComment(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cast-content', {
        body: { type: 'shop_comment', castName, castType, existingProfile, features: (features || []).join('、') }
      });
      if (error) throw error;
      if (data?.content) {
        if (mode === 'add') {
          setFormData((prev) => ({ ...prev, shop_comment: data.content }));
        } else if (editingCast) {
          setEditingCast({ ...editingCast, shop_comment: data.content });
        }
        toast({ title: "AI生成完了", description: "ショップコメントを生成しました" });
      }
    } catch {
      toast({ title: "エラー", description: "ショップコメントの生成に失敗しました", variant: "destructive" });
    } finally {
      setGeneratingShopComment(false);
    }
  };

  const handleGenerateContent = async (type: 'profile' | 'announcement' | 'catchphrase') => {
    if (!editingCast) return;
    
    setGeneratingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-cast-content', {
        body: {
          type,
          castName: editingCast.name,
          castType: editingCast.type,
          existingProfile: type === 'profile' ? editingCast.profile : null
        }
      });

      if (error) throw error;

      if (data?.content) {
        if (type === 'profile') {
          setEditingCast({ ...editingCast, profile: data.content });
        } else if (type === 'announcement') {
          setEditingCast({ ...editingCast, hp_notice: data.content });
        }
        
        toast({
          title: "AI生成完了",
          description: `${type === 'profile' ? 'プロフィール' : type === 'announcement' ? 'お知らせ' : 'キャッチコピー'}を生成しました`,
        });
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast({
        title: "エラー",
        description: "コンテンツの生成に失敗しました",
        variant: "destructive",
      });
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleDeleteCast = async (id: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみキャストを削除できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('casts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // ローカルステートから削除されたキャストを除外
      setCasts(prevCasts => prevCasts.filter(cast => cast.id !== id));

      toast({
        title: "キャスト削除",
        description: "キャストが削除されました",
      });

      setDeleteConfirmId(null);
      setIsEditDialogOpen(false);
      setEditingCast(null);
    } catch (error) {
      console.error('Error deleting cast:', error);
      toast({
        title: "エラー",
        description: "キャストの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleDropCast = async (targetId: string) => {
    if (!isAdmin || !dragCastId.current || dragCastId.current === targetId) return;
    const fromIdx = casts.findIndex(c => c.id === dragCastId.current);
    const toIdx = casts.findIndex(c => c.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...casts];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setCasts(reordered);
    dragCastId.current = null;
    try {
      await Promise.all(
        reordered.map((c, i) =>
          supabase.from('casts').update({ display_order: i + 1 }).eq('id', c.id)
        )
      );
    } catch (e) {
      console.error('reorder failed', e);
      toast({ title: '並び替えに失敗しました', variant: 'destructive' });
      fetchCasts();
    }
  };

  const handleSetCategoryTag = async (castId: string, category: CategoryTag) => {
    const cast = casts.find(c => c.id === castId);
    if (!cast) return;
    const otherTags = (cast.tags || []).filter(t => !CATEGORY_TAGS.includes(t as CategoryTag));
    const newTags = [...otherTags, category];
    setCasts(prev => prev.map(c => c.id === castId ? { ...c, tags: newTags } : c));
    setEditingCast(prev => prev && prev.id === castId ? { ...prev, tags: newTags } : prev);
    const { error } = await supabase.from('casts').update({ tags: newTags }).eq('id', castId);
    if (error) {
      toast({ title: "エラー", description: "タグの更新に失敗しました", variant: "destructive" });
      fetchCasts();
    }
  };

  const generateAccessToken = async (castId: string) => {
    if (!isAdmin) {
      toast({
        title: "権限エラー",
        description: "管理者のみトークンを生成できます",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from('casts')
        .update({ access_token: token })
        .eq('id', castId);

      if (error) throw error;

      setEditingCast(prev => prev && prev.id === castId ? { ...prev, access_token: token } : prev);
      toast({
        title: "トークン生成完了",
        description: "専用リンクが生成されました",
      });
      fetchCasts();
    } catch (error) {
      console.error('Error generating token:', error);
      toast({
        title: "エラー",
        description: "トークンの生成に失敗しました",
        variant: "destructive",
      });
    }
  };

  const copyPortalLink = (token: string) => {
    const link = `${import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin}/therapist/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "リンクをコピーしました",
      description: "専用ページのリンクがクリップボードにコピーされました",
    });
  };

  // キャスト情報をエステ魂フォームの各フィールド値へマッピング
  const buildEstamaData = (cast: Cast) => {
    // バストサイズ "85B" / "B85" → cm + cup
    let sizeB = "", sizeCup = "";
    if (cast.bust_size) {
      const bs = String(cast.bust_size).trim();
      const m1 = bs.match(/^(\d+)\s*([A-La-l])$/);
      const m2 = bs.match(/^([A-La-l])\s*(\d+)$/);
      if (m1) { sizeB = m1[1]; sizeCup = m1[2].toUpperCase(); }
      else if (m2) { sizeCup = m2[1].toUpperCase(); sizeB = m2[2]; }
      else if (/^[A-La-l]$/.test(bs)) { sizeCup = bs.toUpperCase(); }
      else sizeB = bs.replace(/[^0-9]/g, "").slice(0, 3);
    }
    // ボディサイズ "58-85" → ウエスト / ヒップ
    let sizeW = "", sizeH = "";
    if (cast.body_size) {
      const parts = String(cast.body_size).split(/[-–/／]/);
      if (parts.length >= 2) { sizeW = parts[0].replace(/[^0-9]/g, ""); sizeH = parts[1].replace(/[^0-9]/g, ""); }
    }
    // 特徴 → type id（最大4つ）
    const types: string[] = [];
    if (Array.isArray(cast.features)) {
      for (const f of cast.features) {
        const id = ESTAMA_FEATURE_MAP[f];
        if (id && types.length < MAX_FEATURES) types.push(id);
      }
    }
    const cut = (v: string | number | null | undefined, max: number) => String(v ?? "").slice(0, max);
    // 写真（最大6枚）。Drive等を直URLに正規化し、CORS用に image-proxy 経由にする
    const proxyBase = `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/image-proxy?url=`;
    const rawPhotos = (cast.photos && cast.photos.length > 0 ? cast.photos : (cast.photo ? [cast.photo] : []))
      .filter(Boolean)
      .slice(0, 6)
      .map((p) => proxyBase + encodeURIComponent(driveImgUrl(p, 800)));
    return {
      name: cut(cast.name, 10),
      description: cut(cast.shop_comment, 500),
      cast_pr: cut(cast.therapist_comment, 500),
      experience: String(cast.therapist_years ?? "").replace(/[^0-9]/g, "").slice(0, 2),
      age: cut(cast.age, 2),
      tall: cut(cast.height, 3),
      size_b: sizeB.slice(0, 3),
      size_cup: sizeCup,
      size_w: sizeW.slice(0, 3),
      size_h: sizeH.slice(0, 3),
      blood: cast.blood_type && BLOOD_TYPES.includes(cast.blood_type) ? cast.blood_type : "",
      forte_procedure: cut(cast.favorite_techniques, 20),
      food: cut(cast.favorite_food, 20),
      man_like_type: cut(cast.ideal_type, 20),
      like_talent: cut(cast.celebrity_lookalike ?? cast.celebrity_like, 20),
      holiday: cut(cast.day_off_activities, 20),
      vogue: cut(cast.hobby ?? cast.hobbies, 20),
      blog: cut(cast.blog_url, 255),
      twitter: cut(cast.x_account, 255),
      instagram: cut(cast.instagram_url, 255),
      types,
      photos: rawPhotos,
    };
  };

  // エステ魂 cast_edit ページ上で実行する自動入力スクリプトを生成
  const buildEstamaScript = (cast: Cast): string => {
    const D = buildEstamaData(cast);
    return `(function(){
  var D = ${JSON.stringify(D)};
  function fire(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('keyup',{bubbles:true}));}
  function setSel(sel,val){if(val==null||val==='')return;var el=document.querySelector(sel);if(el){el.value=val;fire(el);}}
  setSel('#Name',D.name);setSel('#Description',D.description);setSel('#CastPr',D.cast_pr);
  setSel('[name="experience"]',D.experience);setSel('[name="age"]',D.age);setSel('[name="tall"]',D.tall);
  setSel('[name="size_w"]',D.size_w);setSel('[name="size_h"]',D.size_h);
  setSel('[name="blood"]',D.blood);
  setSel('#ForteProcedure',D.forte_procedure);setSel('#Food',D.food);setSel('#ManLikeType',D.man_like_type);
  setSel('#LikeTalent',D.like_talent);setSel('#Holiday',D.holiday);setSel('#Vogue',D.vogue);
  setSel('#Blog',D.blog);setSel('#Twitter',D.twitter);setSel('#Instagram',D.instagram);
  // バストcm入力後にカップ数セレクトが出るため遅延設定
  setSel('[name="size_b"]',D.size_b);
  setTimeout(function(){setSel('[name="size_cup"]',D.size_cup);},500);
  // 特徴チェックボックス（最大4つ）
  (D.types||[]).forEach(function(v){var c=document.getElementById('type_'+v);if(c&&!c.checked){c.checked=true;fire(c);}});
  // 写真（最大6枚）を image-proxy 経由で取得し file input に割当て
  var photos = D.photos||[];
  var fileInputs = Array.prototype.slice.call(document.querySelectorAll('input[type=file]'));
  var done = 0, fail = 0;
  function report(){
    if(done+fail < photos.length) return;
    var msg = 'エスたま転記:「'+D.name+'」テキスト入力完了。';
    if(photos.length){ msg += '\\n写真: '+done+'/'+photos.length+'枚を設定'+(fail?'（'+fail+'枚は失敗）':'')+'。'; }
    msg += '\\n内容を確認して「保存する」を押してください。';
    alert(msg);
  }
  if(!photos.length){ report(); }
  photos.forEach(function(u,i){
    var input = fileInputs[i];
    if(!input){ fail++; report(); return; }
    fetch(u).then(function(r){ if(!r.ok) throw new Error('http '+r.status); return r.blob(); }).then(function(b){
      var ext = (b.type&&b.type.indexOf('png')>=0)?'png':'jpg';
      var file = new File([b], 'photo'+(i+1)+'.'+ext, {type: b.type||'image/jpeg'});
      var dt = new DataTransfer(); dt.items.add(file);
      input.files = dt.files; fire(input);
      done++; report();
    }).catch(function(e){ console.error('photo '+(i+1)+' failed', e); fail++; report(); });
  });
})();`;
  };

  const handleSyncEstama = async (cast: Cast) => {
    const data = buildEstamaData(cast);
    if (!data.name) {
      toast({ title: "転記できません", description: "キャスト名が未設定です", variant: "destructive" });
      return;
    }
    setEstamaScript(buildEstamaScript(cast));
    setEstamaData(JSON.stringify({ __estama: true, ...data }));
    setEstamaCastName(data.name);
    setEstamaDialogOpen(true);
    // ブックマークレット方式用にキャストデータ(JSON)をクリップボードへコピー
    try {
      await navigator.clipboard.writeText(JSON.stringify({ __estama: true, ...data }));
      toast({ title: `「${data.name}」のデータをコピーしました`, description: "エステ魂を開いてブックマークレットをクリックしてください" });
    } catch { /* ダイアログ内ボタンから再コピー可 */ }
  };

  const copyShiftLink = (token: string) => {
    const link = `${window.location.origin}/therapist/${token}/shift`;
    navigator.clipboard.writeText(link);
    toast({
      title: "シフト提出URLをコピーしました",
      description: "セラピストに送付してください",
    });
  };

  const addPhotoUrl = (url: string, isEdit: boolean) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (isEdit && editingCast) {
      const updated = [...(editingCast.photos || []), trimmed];
      setEditingCast({ ...editingCast, photos: updated, photo: updated[0] });
    } else {
      const updated = [...formData.photos, trimmed];
      setFormData({ ...formData, photos: updated, photo: updated[0] });
    }
    setNewPhotoUrl("");
  };

  const handlePhotoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("cast-photos")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast({
            title: "エラー",
            description: `${file.name}のアップロードに失敗しました`,
            variant: "destructive",
          });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("cast-photos")
          .getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0) {
        if (isEdit && editingCast) {
          const updated = [...(editingCast.photos || []), ...uploadedUrls];
          setEditingCast({ ...editingCast, photos: updated, photo: updated[0] });
        } else {
          const updated = [...formData.photos, ...uploadedUrls];
          setFormData({ ...formData, photos: updated, photo: updated[0] });
        }
        toast({
          title: "アップロード完了",
          description: `${uploadedUrls.length}枚の写真をアップロードしました`,
        });
      }
    } catch (error) {
      console.error("Error uploading photos:", error);
      toast({
        title: "エラー",
        description: "写真のアップロードに失敗しました",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      if (isEdit) {
        if (editPhotoInputRef.current) editPhotoInputRef.current.value = "";
      } else {
        if (addPhotoInputRef.current) addPhotoInputRef.current.value = "";
      }
    }
  };

  const handleInterviewSheetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCast) return;
    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `interview-sheets/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("cast-photos").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("cast-photos").getPublicUrl(fileName);
      setEditingCast({ ...editingCast, interview_sheet_url: publicUrl });
      toast({ title: "アップロード完了", description: "面談シートをアップロードしました" });
    } catch (error: any) {
      console.error("Error uploading interview sheet:", error);
      toast({ title: "エラー", description: "面談シートのアップロードに失敗しました", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (interviewSheetInputRef.current) interviewSheetInputRef.current.value = "";
    }
  };

  const handleManagementPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editingCast) return;
    setUploadingPhoto(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `management-photos/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("cast-photos").upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("cast-photos").getPublicUrl(fileName);
        uploaded.push(publicUrl);
      }
      setEditingCast({ ...editingCast, management_photos: [...(editingCast.management_photos || []), ...uploaded] });
      toast({ title: "アップロード完了", description: "管理用写真をアップロードしました" });
    } catch (error: any) {
      console.error("Error uploading management photo:", error);
      toast({ title: "エラー", description: "管理用写真のアップロードに失敗しました", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (managementPhotoInputRef.current) managementPhotoInputRef.current.value = "";
    }
  };

  const handleRemoveManagementPhoto = (index: number) => {
    if (!editingCast) return;
    const updated = (editingCast.management_photos || []).filter((_, i) => i !== index);
    setEditingCast({ ...editingCast, management_photos: updated });
  };

  const handleRemovePhoto = (index: number, isEdit: boolean = false) => {
    if (isEdit && editingCast) {
      const updatedPhotos = (editingCast.photos || []).filter((_, i) => i !== index);
      setEditingCast({
        ...editingCast,
        photos: updatedPhotos,
        photo: updatedPhotos[0] || null
      });
    } else {
      const updatedPhotos = formData.photos.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        photos: updatedPhotos,
        photo: updatedPhotos[0] || ""
      });
    }
    
    toast({
      title: "写真削除",
      description: "写真を削除しました",
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      
      <div className="flex pt-[60px]">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6 md:ml-[240px] overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {isAdmin && (
              <div className="mb-6 rounded-xl border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <p className="font-bold text-rose-600">AIメモ登録</p>
                  <span className="text-xs text-muted-foreground">メモを貼るだけでAIが下書きします</span>
                </div>

                {/* モード切替 */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setMemoMode("new")}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                      memoMode === "new" ? "bg-rose-500 text-white border-rose-500" : "bg-white text-rose-500 border-pink-200 hover:bg-pink-100"
                    }`}
                  >
                    新規登録
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemoMode("existing")}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                      memoMode === "existing" ? "bg-rose-500 text-white border-rose-500" : "bg-white text-rose-500 border-pink-200 hover:bg-pink-100"
                    }`}
                  >
                    既存のセラピストに追加
                  </button>
                </div>

                {/* 既存モード時は追加先を選択 */}
                {memoMode === "existing" && (
                  <div className="mb-2">
                    <Select value={memoTargetCastId} onValueChange={setMemoTargetCastId}>
                      <SelectTrigger className="bg-white/80 border-pink-200">
                        <SelectValue placeholder="追加先のセラピストを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...casts].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Textarea
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  rows={3}
                  placeholder={memoMode === "new"
                    ? "例）さくら 25歳 158cm B84W58H84 Dカップ 出身宮城 趣味カフェ巡り アロマ得意 X:@sakura ..."
                    : "追加・更新したい情報を入力（例）SNS追加 X:@sakura / 得意な施術：リンパ / 好きな食べ物：抹茶 ..."}
                  className="bg-white/80 border-pink-200"
                />
                <div className="flex justify-end mt-2">
                  {memoMode === "new" ? (
                    <Button onClick={handleMemoNew} disabled={parsingMemo || !memoText.trim()} className="bg-rose-500 hover:bg-rose-600">
                      {parsingMemo ? "AI解析中..." : "AIで新規登録を下書き"}
                    </Button>
                  ) : (
                    <Button onClick={handleMemoExisting} disabled={parsingMemo || !memoText.trim() || !memoTargetCastId} className="bg-rose-500 hover:bg-rose-600">
                      {parsingMemo ? "AI解析中..." : "AIで既存に追加"}
                    </Button>
                  )}
                </div>
                {memoMode === "existing" && (
                  <p className="text-[11px] text-muted-foreground mt-1">※ 既存の情報は上書きせず、空いている項目だけをメモの内容で補完します。</p>
                )}
              </div>
            )}
            <Tabs defaultValue="management" className="w-full">
              <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <h1 className="text-2xl font-bold">キャスト管理</h1>
                  <p className="text-muted-foreground">キャストの登録・管理</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="col-span-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 sm:col-auto"
                      onClick={() => setEstamaAutomationOpen(true)}
                    >
                      <Bot size={16} />
                      エスたま自動化
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="col-span-2 border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 sm:col-auto"
                      onClick={() => setIsEstamaImportOpen(true)}
                    >
                      <ExternalLink size={16} />
                      エスたまからインポート
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                      <FileUp size={16} />
                      CSVインポート
                    </Button>
                  )}
                  {isAdmin && (
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus size={16} />
                          新規追加
                        </Button>
                      </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新しいセラピストを追加</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 pb-4">
                      {/* 写真 */}
                      <div>
                        <Label className="font-semibold">セラピスト写真</Label>
                        <div className="mt-2 space-y-2">
                          <input
                            ref={addPhotoInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handlePhotoFileUpload(e, false)}
                          />
                          <Button type="button" variant="outline" className="w-full" onClick={() => addPhotoInputRef.current?.click()} disabled={uploadingPhoto}>
                            <Camera className="h-4 w-4 mr-1.5" />
                            {uploadingPhoto ? "アップロード中..." : "写真をアップロード"}
                          </Button>
                          <div className="flex gap-2">
                            <Input
                              placeholder="またはGoogleドライブURL / ファイルID"
                              value={newPhotoUrl}
                              onChange={(e) => setNewPhotoUrl(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhotoUrl(newPhotoUrl, false))}
                            />
                            <Button type="button" variant="outline" onClick={() => addPhotoUrl(newPhotoUrl, false)} disabled={!newPhotoUrl.trim()}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 6 }).map((_, index) => {
                              const photo = formData.photos[index];
                              return (
                                <div key={index} className="relative aspect-square border-2 border-dashed border-muted rounded-md overflow-hidden flex items-center justify-center bg-muted/30">
                                  {photo ? (
                                    <>
                                      <img src={driveImgUrl(photo)} alt={`写真${index + 1}`} className="w-full h-full object-cover" />
                                      <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => handleRemovePhoto(index, false)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                      <Badge variant="secondary" className="absolute bottom-1 left-1 text-[10px] px-1">{index + 1}</Badge>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">写真{index + 1}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 基本情報 */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <Label className="font-semibold">基本情報</Label>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <Label htmlFor="add-name">名前 <span className="text-destructive">*</span></Label>
                            <Input id="add-name" placeholder="例：さくら" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                          </div>
                          <div>
                            <Label htmlFor="add-name-kana">フリガナ</Label>
                            <Input id="add-name-kana" placeholder="例：サクラ" value={formData.name_kana} onChange={(e) => setFormData({...formData, name_kana: e.target.value})} />
                          </div>
                          <div>
                            <Label htmlFor="add-real-name">本名</Label>
                            <Input id="add-real-name" placeholder="例：佐藤 花子" value={formData.real_name} onChange={(e) => setFormData({...formData, real_name: e.target.value})} />
                            <p className="text-[10px] text-muted-foreground mt-0.5">紹介費明細などの内部書類に使用（公開されません）</p>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="add-age">年齢</Label>
                          <Input id="add-age" type="number" placeholder="25" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="add-height">身長 (cm)</Label>
                          <Input id="add-height" type="number" placeholder="158" value={formData.height} onChange={(e) => setFormData({...formData, height: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="add-body-size">3サイズ (B/W/H)</Label>
                          <Input id="add-body-size" placeholder="84/58/84" value={formData.body_size} onChange={(e) => setFormData({...formData, body_size: e.target.value})} />
                        </div>
                        <div>
                          <Label>バストのカップ数</Label>
                          <Select value={formData.bust_size} onValueChange={(v) => setFormData({...formData, bust_size: v})}>
                            <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                            <SelectContent>{BUST_SIZES.map(b => <SelectItem key={b} value={b}>{b}カップ</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* お店からのコメント（ショップコメント） */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor="add-shop-comment" className="font-semibold">お店からのコメント</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleGenerateShopComment('add')} disabled={generatingShopComment} className="h-7 px-2 text-xs text-pink-600 border-pink-300 hover:bg-pink-50">
                            {generatingShopComment ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Sparkles size={12} className="mr-1" />}AI生成
                          </Button>
                        </div>
                        <Textarea id="add-shop-comment" rows={3} value={formData.shop_comment} onChange={(e) => setFormData({...formData, shop_comment: e.target.value})} />
                      </div>

                      {/* セラピストインタビュー（トグル） */}
                      <div className="border rounded-lg">
                        <button type="button" className="w-full flex items-center justify-between p-4" onClick={() => setShowProfileDetailAdd(v => !v)}>
                          <span className="font-semibold">セラピストインタビュー</span>
                          {showProfileDetailAdd ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {showProfileDetailAdd && (
                          <div className="px-4 pb-4 space-y-3">
                            <div>
                              <Label htmlFor="add-techniques">得意な施術</Label>
                              <Textarea id="add-techniques" rows={2} className="mt-1" placeholder="得意な施術..." value={formData.favorite_techniques} onChange={(e) => setFormData({...formData, favorite_techniques: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="add-favfood">好きな食べ物</Label>
                              <Input id="add-favfood" className="mt-1" value={formData.favorite_food} onChange={(e) => setFormData({...formData, favorite_food: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="add-idealtype">好きな男性のタイプ</Label>
                              <Input id="add-idealtype" className="mt-1" value={formData.ideal_type} onChange={(e) => setFormData({...formData, ideal_type: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="add-celeb">似ている芸能人</Label>
                              <Input id="add-celeb" className="mt-1" value={formData.celebrity_lookalike} onChange={(e) => setFormData({...formData, celebrity_lookalike: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="add-dayoff">休みの日は何してる？</Label>
                              <Textarea id="add-dayoff" rows={2} className="mt-1" value={formData.day_off_activities} onChange={(e) => setFormData({...formData, day_off_activities: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="add-hobbies">趣味・特技</Label>
                              <Textarea id="add-hobbies" rows={2} className="mt-1" value={formData.hobbies} onChange={(e) => setFormData({...formData, hobbies: e.target.value})} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* セラピストコメント */}
                      <div>
                        <Label htmlFor="add-therapist-comment" className="font-semibold">セラピストコメント</Label>
                        <Textarea id="add-therapist-comment" rows={3} className="mt-1" value={formData.therapist_comment} onChange={(e) => setFormData({...formData, therapist_comment: e.target.value})} />
                      </div>

                      {/* セラピストの特徴 */}
                      <div>
                        <Label className="font-semibold">セラピストの特徴（4つまで）</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {THERAPIST_FEATURES.map((f) => {
                            const checked = formData.features.includes(f);
                            return (
                              <button key={f} type="button"
                                className={`px-2 py-1 text-xs rounded-full border transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary"}`}
                                onClick={() => {
                                  if (checked) { setFormData({...formData, features: formData.features.filter(x => x !== f)}); }
                                  else if (formData.features.length >= MAX_FEATURES) { toast({ title: "特徴は4つまで選択できます", variant: "destructive" }); }
                                  else { setFormData({...formData, features: [...formData.features, f]}); }
                                }}>
                                {f}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* エステ歴 */}
                      <div>
                        <Label className="font-semibold">エステ歴</Label>
                        <Select value={formData.therapist_experience} onValueChange={(v) => setFormData({...formData, therapist_experience: v})}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="選択" /></SelectTrigger>
                          <SelectContent>{THERAPIST_EXPERIENCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>

                      {/* ブログ・SNS */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <Label className="font-semibold">ブログ・SNS</Label>
                        <div>
                          <Label htmlFor="add-blog">外部ブログ(02)</Label>
                          <div className="flex items-center gap-0 mt-1">
                            <span className="text-xs text-muted-foreground bg-muted rounded-l px-2 h-9 flex items-center border border-r-0 whitespace-nowrap">https://m-sns.net/profile/</span>
                            <Input
                              id="add-blog"
                              placeholder="@username"
                              value={(formData.blog_url || "").replace("https://m-sns.net/profile/", "")}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData({...formData, blog_url: val ? `https://m-sns.net/profile/${val}` : ""});
                              }}
                              className="rounded-l-none"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="add-x">X (Twitter)</Label>
                          <Input id="add-x" placeholder="@username" value={formData.x_account} onChange={(e) => setFormData({...formData, x_account: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="add-skebiy">Skebiy</Label>
                          <Input id="add-skebiy" placeholder="https://..." value={formData.skebiy_url} onChange={(e) => setFormData({...formData, skebiy_url: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="add-instagram">Instagram</Label>
                          <Input id="add-instagram" placeholder="https://..." value={formData.instagram_url} onChange={(e) => setFormData({...formData, instagram_url: e.target.value})} />
                        </div>
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4"
                            checked={formData.estama_auto_register}
                            onChange={(e) => setFormData({ ...formData, estama_auto_register: e.target.checked })}
                          />
                          <span>
                            <span className="block text-sm font-semibold text-blue-800">追加後、エスたまへ自動登録</span>
                            <span className="block text-xs text-muted-foreground">写真・プロフィールを転記し、登録処理まで自動で行います。</span>
                          </span>
                        </label>
                        {formData.estama_auto_register && (
                          <div className="grid grid-cols-1 gap-3 border-t border-blue-100 pt-3 sm:grid-cols-2">
                            <div>
                              <Label htmlFor="add-estama-email" className="text-xs">魂セラピスト用メール（任意）</Label>
                              <Input
                                id="add-estama-email"
                                type="email"
                                autoComplete="off"
                                placeholder="therapist@example.jp"
                                value={formData.estama_account_email}
                                onChange={(e) => setFormData({ ...formData, estama_account_email: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="add-estama-password" className="text-xs">初期パスワード（任意）</Label>
                              <Input
                                id="add-estama-password"
                                type="password"
                                autoComplete="new-password"
                                value={formData.estama_account_password}
                                onChange={(e) => setFormData({ ...formData, estama_account_password: e.target.value })}
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground sm:col-span-2">魂セラピスト初期設定に一度だけ使用し、パスワードは保存しません。</p>
                          </div>
                        )}
                      </div>


                      <Button onClick={handleAddCast} className="w-full" disabled={addingCast}>
                        {addingCast && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {addingCast ? "登録処理中..." : "追加する"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              </div>
            </div>

            {/* Edit Dialog */}
            {editingCast && (
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
                      セラピスト編集
                      {getCastLevel(editingCast) && (
                        <span className={`inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full font-semibold ${LEVEL_BADGES[getCastLevel(editingCast)!].className}`}>
                          <span>{LEVEL_BADGES[getCastLevel(editingCast)!].icon}</span>
                          {getCastLevel(editingCast)}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                        isSbLinked(editingCast)
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-rose-50 text-rose-700 border-rose-300"
                      }`}>
                        {isSbLinked(editingCast) ? <LinkIcon size={11} /> : <AlertTriangle size={11} />}
                        {isSbLinked(editingCast) ? "SB紐付け済み" : "SB未紐付け"}
                      </span>
                    </DialogTitle>
                  </DialogHeader>

                  {/* ステータス・操作（一覧から移設） */}
                  {isAdmin && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">レベル</Label>
                          <Select
                            value={getCastLevel(editingCast) ?? "__none__"}
                            onValueChange={(v) => handleSetLevelTag(editingCast.id, v === "__none__" ? "" : v as LevelTag)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5">
                              <SelectValue placeholder="レベル" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">未設定</SelectItem>
                              {LEVEL_TAGS.map(lv => (
                                <SelectItem key={lv} value={lv}>{LEVEL_BADGES[lv].icon} {lv}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">ステータス</Label>
                          <Select
                            value={getCastCategory(editingCast)}
                            onValueChange={(v) => handleSetCategoryTag(editingCast.id, v as CategoryTag)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_TAGS.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {editingCast.access_token ? (
                          <>
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => copyPortalLink(editingCast.access_token!)}>
                              <Copy size={13} />ポータルURL
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => copyShiftLink(editingCast.access_token!)}>
                              <CalendarPlus size={13} />シフト提出URL
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => generateAccessToken(editingCast.id)}>
                            <LinkIcon size={13} />専用リンク発行
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 text-pink-600 border-pink-200 hover:bg-pink-50 hover:text-pink-700"
                          onClick={() => handleSyncEstama(editingCast)}
                        >
                          <ExternalLink size={13} />エスたま転記
                        </Button>
                        {deleteConfirmId === editingCast.id ? (
                          <>
                            <Button type="button" variant="destructive" size="sm" className="h-8 text-xs" onClick={() => handleDeleteCast(editingCast.id)}>削除を確定</Button>
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteConfirmId(null)}>キャンセル</Button>
                          </>
                        ) : (
                          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground ml-auto" onClick={() => setDeleteConfirmId(editingCast.id)}>
                            <Trash2 size={13} />削除
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-2">
                      <TabsTrigger value="profile">プロフィール</TabsTrigger>
                      <TabsTrigger value="mgmt">管理情報</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-5 pb-4">
                      {/* 写真 */}
                      <div>
                        <Label className="font-semibold">セラピスト写真</Label>
                        <div className="mt-2 space-y-2">
                          <input
                            ref={editPhotoInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handlePhotoFileUpload(e, true)}
                          />
                          <Button type="button" variant="outline" className="w-full" onClick={() => editPhotoInputRef.current?.click()} disabled={uploadingPhoto}>
                            <Camera className="h-4 w-4 mr-1.5" />
                            {uploadingPhoto ? "アップロード中..." : "写真をアップロード"}
                          </Button>
                          <div className="flex gap-2">
                            <Input
                              placeholder="またはGoogleドライブURL / ファイルID"
                              value={newPhotoUrl}
                              onChange={(e) => setNewPhotoUrl(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPhotoUrl(newPhotoUrl, true))}
                            />
                            <Button type="button" variant="outline" onClick={() => addPhotoUrl(newPhotoUrl, true)} disabled={!newPhotoUrl.trim()}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">ドラッグで順番を変更できます</p>
                          <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 6 }).map((_, index) => {
                              const photos = editingCast.photos || [];
                              const photo = photos[index];
                              return (
                                <div
                                  key={index}
                                  draggable={!!photo}
                                  onDragStart={() => { if (photo) dragPhotoIdxRef.current = index; }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => {
                                    const from = dragPhotoIdxRef.current;
                                    dragPhotoIdxRef.current = null;
                                    if (from === null || from === index) return;
                                    const arr = [...photos];
                                    const [moved] = arr.splice(from, 1);
                                    arr.splice(index, 0, moved);
                                    const cleaned = arr.filter(Boolean);
                                    setEditingCast({ ...editingCast, photos: cleaned, photo: cleaned[0] || null });
                                  }}
                                  className={`relative aspect-square border-2 border-dashed border-muted rounded-md overflow-hidden flex items-center justify-center bg-muted/30 ${photo ? "cursor-grab active:cursor-grabbing" : ""}`}
                                >
                                  {photo ? (
                                    <>
                                      <img src={driveImgUrl(photo)} alt={`写真${index + 1}`} className="w-full h-full object-cover" />
                                      <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => handleRemovePhoto(index, true)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                      <div className="absolute bottom-1 left-1 flex items-center gap-0.5">
                                        <Badge variant="secondary" className="text-[10px] px-1">{index + 1}</Badge>
                                        <GripVertical size={12} className="text-white/80 drop-shadow" />
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">写真{index + 1}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 画像ストック（非公開・枚数無制限） */}
                      <div className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">
                            画像ストック
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {(editingCast.management_photos || []).length}枚
                            </span>
                          </Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => managementPhotoInputRef.current?.click()} disabled={uploadingPhoto}>
                            <Camera className="h-4 w-4 mr-1.5" />
                            {uploadingPhoto ? "アップロード中..." : "画像を追加"}
                          </Button>
                        </div>
                        <input ref={managementPhotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleManagementPhotoUpload} />
                        <p className="text-xs text-muted-foreground">
                          投稿・広告用などの画像を何枚でもストックできます（複数選択OK）。HPには公開されません。タップで拡大表示。
                        </p>
                        {(editingCast.management_photos || []).length === 0 ? (
                          <p className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded-md">
                            まだ画像がありません
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {(editingCast.management_photos || []).map((url, i) => (
                              <div key={i} className="relative aspect-square rounded-md overflow-hidden border bg-muted/30">
                                <img
                                  src={url}
                                  alt={`ストック画像${i + 1}`}
                                  loading="lazy"
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => window.open(url, "_blank")}
                                />
                                <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => handleRemoveManagementPhoto(i)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 称号バッジ（HPの写真右上に表示） */}
                      <div className="border rounded-lg p-4 space-y-2">
                        <Label className="font-semibold">称号バッジ</Label>
                        <p className="text-xs text-muted-foreground">
                          HPの出勤情報・セラピスト一覧の写真右上に表示されます（電撃入店⚡️など）
                        </p>
                        <Select
                          value={(editingCast as any).title_badge_id ?? "none"}
                          onValueChange={(v) => setEditingCast({ ...(editingCast as any), title_badge_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger><SelectValue placeholder="なし" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">なし</SelectItem>
                            {titleBadges.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 基本情報 */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <Label className="font-semibold">基本情報</Label>
                        <div>
                          <Label htmlFor="e-name">名前</Label>
                          <Input id="e-name" value={editingCast.name} onChange={(e) => setEditingCast({...editingCast, name: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="e-name-kana">フリガナ</Label>
                          <Input id="e-name-kana" value={editingCast.name_kana || ""} onChange={(e) => setEditingCast({...editingCast, name_kana: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="e-real-name">本名</Label>
                          <Input id="e-real-name" placeholder="例：佐藤 花子" value={editingCast.real_name || ""} onChange={(e) => setEditingCast({...editingCast, real_name: e.target.value})} />
                          <p className="text-[10px] text-muted-foreground mt-0.5">紹介費明細などの内部書類に使用（公開されません）</p>
                        </div>
                        <div>
                          <Label htmlFor="e-age">年齢</Label>
                          <Input id="e-age" type="number" value={editingCast.age || ""} onChange={(e) => setEditingCast({...editingCast, age: parseInt(e.target.value) || null})} />
                        </div>
                        <div>
                          <Label htmlFor="e-height">身長 (cm)</Label>
                          <Input id="e-height" type="number" value={editingCast.height || ""} onChange={(e) => setEditingCast({...editingCast, height: parseInt(e.target.value) || null})} />
                        </div>
                        <div>
                          <Label htmlFor="e-body-size">3サイズ (B/W/H)</Label>
                          <Input id="e-body-size" placeholder="84/58/84" value={editingCast.body_size || ""} onChange={(e) => setEditingCast({...editingCast, body_size: e.target.value})} />
                        </div>
                        <div>
                          <Label>バストのカップ数</Label>
                          <Select value={editingCast.bust_size || ""} onValueChange={(v) => setEditingCast({...editingCast, bust_size: v})}>
                            <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                            <SelectContent>{BUST_SIZES.map(b => <SelectItem key={b} value={b}>{b}カップ</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* お店からのコメント（ショップコメント） */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor="e-shop-comment" className="font-semibold">お店からのコメント</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleGenerateShopComment('edit')} disabled={generatingShopComment} className="h-7 px-2 text-xs text-pink-600 border-pink-300 hover:bg-pink-50">
                            {generatingShopComment ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Sparkles size={12} className="mr-1" />}AI生成
                          </Button>
                        </div>
                        <Textarea id="e-shop-comment" rows={3} value={editingCast.shop_comment || ""} onChange={(e) => setEditingCast({...editingCast, shop_comment: e.target.value})} />
                      </div>

                      {/* セラピストインタビュー（トグル） */}
                      <div className="border rounded-lg">
                        <button type="button" className="w-full flex items-center justify-between p-4" onClick={() => setShowProfileDetail(v => !v)}>
                          <span className="font-semibold">セラピストインタビュー</span>
                          {showProfileDetail ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {showProfileDetail && (
                          <div className="px-4 pb-4 space-y-3">
                            <div>
                              <Label htmlFor="e-techniques">得意な施術</Label>
                              <Textarea id="e-techniques" rows={2} className="mt-1" value={editingCast.favorite_techniques || ""} onChange={(e) => setEditingCast({...editingCast, favorite_techniques: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="e-favfood">好きな食べ物</Label>
                              <Input id="e-favfood" className="mt-1" value={editingCast.favorite_food || ""} onChange={(e) => setEditingCast({...editingCast, favorite_food: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="e-idealtype">好きな男性のタイプ</Label>
                              <Input id="e-idealtype" className="mt-1" value={editingCast.ideal_type || ""} onChange={(e) => setEditingCast({...editingCast, ideal_type: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="e-celeb">似ている芸能人</Label>
                              <Input id="e-celeb" className="mt-1" value={editingCast.celebrity_lookalike || ""} onChange={(e) => setEditingCast({...editingCast, celebrity_lookalike: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="e-dayoff">休みの日は何してる？</Label>
                              <Textarea id="e-dayoff" rows={2} className="mt-1" value={editingCast.day_off_activities || ""} onChange={(e) => setEditingCast({...editingCast, day_off_activities: e.target.value})} />
                            </div>
                            <div>
                              <Label htmlFor="e-hobbies">趣味・特技</Label>
                              <Textarea id="e-hobbies" rows={2} className="mt-1" value={editingCast.hobbies || ""} onChange={(e) => setEditingCast({...editingCast, hobbies: e.target.value})} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* セラピストコメント */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label htmlFor="e-therapist-comment" className="font-semibold">セラピストコメント</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleGenerateContent('profile')} disabled={generatingContent}>
                            <Sparkles className="w-4 h-4 mr-1" />AI生成
                          </Button>
                        </div>
                        <Textarea id="e-therapist-comment" rows={3} value={editingCast.therapist_comment || editingCast.profile || ""} onChange={(e) => setEditingCast({...editingCast, therapist_comment: e.target.value, profile: e.target.value})} />
                      </div>

                      {/* セラピストの特徴 */}
                      <div>
                        <Label className="font-semibold">セラピストの特徴（4つまで）</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {THERAPIST_FEATURES.map((f) => {
                            const cur = editingCast.features || [];
                            const checked = cur.includes(f);
                            return (
                              <button key={f} type="button"
                                className={`px-2 py-1 text-xs rounded-full border transition-colors ${checked ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary"}`}
                                onClick={() => {
                                  if (checked) { setEditingCast({...editingCast, features: cur.filter(x => x !== f)}); }
                                  else if (cur.length >= MAX_FEATURES) { toast({ title: "特徴は4つまで選択できます", variant: "destructive" }); }
                                  else { setEditingCast({...editingCast, features: [...cur, f]}); }
                                }}>
                                {f}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* エステ歴 */}
                      <div>
                        <Label className="font-semibold">エステ歴</Label>
                        <Select value={editingCast.therapist_experience || ""} onValueChange={(v) => setEditingCast({...editingCast, therapist_experience: v})}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="選択" /></SelectTrigger>
                          <SelectContent>{THERAPIST_EXPERIENCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>

                      {/* ブログ・SNS */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">ブログ・SNS</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleCopySns(editingCast)}
                          >
                            📋 コピペ用にコピー
                          </Button>
                        </div>
                        <div>
                          <Label htmlFor="e-blog">外部ブログ(02)</Label>
                          <div className="flex items-center gap-0 mt-1">
                            <span className="text-xs text-muted-foreground bg-muted rounded-l px-2 h-9 flex items-center border border-r-0 whitespace-nowrap">https://m-sns.net/profile/</span>
                            <Input
                              id="e-blog"
                              placeholder="@username"
                              value={(editingCast.blog_url || "").replace("https://m-sns.net/profile/", "")}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingCast({...editingCast, blog_url: val ? `https://m-sns.net/profile/${val}` : ""});
                              }}
                              className="rounded-l-none"
                            />
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Input placeholder="ブログアイコン画像URL（任意）" value={blogIconUrl} onChange={(e) => setBlogIconUrl(e.target.value)} className="h-7 text-xs" />
                            {blogIconUrl && <img src={blogIconUrl} alt="preview" className="w-6 h-6 rounded object-contain shrink-0 border" />}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="e-x">X (Twitter)</Label>
                          <Input id="e-x" placeholder="@username" value={editingCast.x_account || ""} onChange={(e) => setEditingCast({...editingCast, x_account: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="e-skebiy">Skebiy</Label>
                          <Input id="e-skebiy" placeholder="https://..." value={editingCast.skebiy_url || ""} onChange={(e) => setEditingCast({...editingCast, skebiy_url: e.target.value})} />
                          <div className="mt-1 flex items-center gap-2">
                            <Input placeholder="Skebiyアイコン画像URL（任意）" value={skebiyIconUrl} onChange={(e) => setSkebiyIconUrl(e.target.value)} className="h-7 text-xs" />
                            {skebiyIconUrl && <img src={skebiyIconUrl} alt="preview" className="w-6 h-6 rounded object-contain shrink-0 border" />}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="e-instagram">Instagram</Label>
                          <Input id="e-instagram" placeholder="https://..." value={editingCast.instagram_url || ""} onChange={(e) => setEditingCast({...editingCast, instagram_url: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="e-line-url">LINE URL</Label>
                          <Input id="e-line-url" placeholder="https://lin.ee/..." value={editingCast.line_url || ""} onChange={(e) => setEditingCast({...editingCast, line_url: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="e-litlink">リットリンク URL</Label>
                          <Input id="e-litlink" placeholder="https://lit.link/..." value={editingCast.litlink_url || ""} onChange={(e) => setEditingCast({...editingCast, litlink_url: e.target.value})} />
                        </div>
                      </div>

                      {/* セラピストレベル */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <Label className="font-semibold">セラピストレベル</Label>
                        <Select
                          value={getCastLevel(editingCast) ?? "__none__"}
                          onValueChange={(v) => {
                            const otherTags = (editingCast.tags || []).filter(t => !LEVEL_TAGS.includes(t as LevelTag));
                            setEditingCast({...editingCast, tags: v !== "__none__" ? [...otherTags, v] : otherTags});
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="レベル未設定" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">未設定</SelectItem>
                            {LEVEL_TAGS.map(lv => (
                              <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>1.ビギナーズ — 講習中・デビュー前</p>
                          <p>2.スタンダード — 初出勤済み・SNS教育中</p>
                          <p>3.ソルジャー — SNS投稿こなし、日7〜8万水準</p>
                          <p>4.マスター — 本指名率30%以上・皆勤・クレームなし達成</p>
                        </div>
                      </div>

                      {/* カスタムタグ */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <Label className="font-semibold">カスタムタグ</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="タグ名を入力してEnter"
                            value={customTagInput}
                            onChange={(e) => setCustomTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const t = customTagInput.trim();
                                if (t && !(editingCast.tags || []).includes(t)) {
                                  setEditingCast({...editingCast, tags: [...(editingCast.tags || []), t]});
                                  setCustomTagInput("");
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const t = customTagInput.trim();
                              if (t && !(editingCast.tags || []).includes(t)) {
                                setEditingCast({...editingCast, tags: [...(editingCast.tags || []), t]});
                                setCustomTagInput("");
                              }
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                          {(editingCast.tags || []).filter(t => !ALL_SYSTEM_TAGS.includes(t)).map((tag) => (
                            <span key={tag} className="flex items-center gap-1 bg-[#f5e6e0] text-[#7a706c] text-xs px-2 py-1 rounded-full">
                              {tag}
                              <button
                                type="button"
                                onClick={() => setEditingCast({...editingCast, tags: (editingCast.tags || []).filter(t => t !== tag)})}
                                className="text-[#c49480] hover:text-[#a87b65] leading-none"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {(editingCast.tags || []).filter(t => !ALL_SYSTEM_TAGS.includes(t)).length === 0 && (
                            <p className="text-xs text-muted-foreground">タグなし</p>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="mgmt" className="space-y-4 pb-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          {editingCast.is_visible ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                          <Label>HP表示</Label>
                        </div>
                        <Button type="button" variant={editingCast.is_visible ? "default" : "outline"} size="sm" onClick={() => setEditingCast({...editingCast, is_visible: !editingCast.is_visible})}>
                          {editingCast.is_visible ? "ON" : "OFF"}
                        </Button>
                      </div>

                      <div>
                        <Label>口コミ（O2）URL</Label>
                        <Input placeholder="https://..." value={editingCast.o2_url || ""} onChange={(e) => setEditingCast({...editingCast, o2_url: e.target.value})} />
                      </div>

                      {/* エステ魂 写メ日記 取り込み */}
                      <div className="border rounded-lg p-4 space-y-2">
                        <Label className="font-semibold">エステ魂 写メ日記</Label>
                        <p className="text-xs text-muted-foreground">
                          エステ魂のプロフィールページURLを設定して取り込むと、HPの「写メ日記を見る」に写真と本文が表示されます。
                        </p>
                        <Input
                          placeholder="https://estama.jp/shop/●●/cast/●●/"
                          value={editingCast.estama_profile_url || ""}
                          onChange={(e) => setEditingCast({ ...editingCast, estama_profile_url: e.target.value })}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={handleImportDiary} disabled={importingDiary}>
                          {importingDiary ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1.5" />}
                          {importingDiary ? "取り込み中..." : "写メ日記を取り込む"}
                        </Button>
                      </div>

                      {/* 02アカウント情報（パスワードは本人だけがポータルで設定） */}
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">02アカウント案内</Label>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleCopyO2Account(editingCast)}>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />共有用にコピー
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          URL・登録メール・IDだけを共有します。パスワードは管理画面に保存せず、セラピスト本人がポータルのO2接続設定へ入力します。
                        </p>
                        <div>
                          <Label className="text-xs">管理画面URL</Label>
                          <Input className="mt-1" placeholder="https://m-sns.net/cast/login/" value={editingCast.o2_login_url ?? "https://m-sns.net/cast/login/"} onChange={(e) => setEditingCast({...editingCast, o2_login_url: e.target.value})} />
                        </div>
                        <div>
                          <Label className="text-xs">登録メールアドレス</Label>
                          <Input className="mt-1" placeholder="info@example.com" value={editingCast.o2_login_email || ""} onChange={(e) => setEditingCast({...editingCast, o2_login_email: e.target.value})} />
                        </div>
                        <div>
                          <Label className="text-xs">ID</Label>
                          <Input className="mt-1" placeholder="hana_sendai" value={editingCast.o2_login_id || ""} onChange={(e) => setEditingCast({...editingCast, o2_login_id: e.target.value})} />
                        </div>
                        <a href="/marketing/o2" className="inline-flex text-xs text-primary hover:underline">O2連携管理を開く</a>
                      </div>

                      <div className="border rounded-lg p-4 space-y-3">
                        <Label className="font-semibold">管理情報</Label>
                        <div>
                          <Label htmlFor="e-profile-format">プロフィールフォーマット</Label>
                          <Textarea
                            id="e-profile-format"
                            rows={8}
                            className="mt-1 font-mono text-sm whitespace-pre leading-relaxed"
                            placeholder={"名前：\n年齢：\n身長：\nスリーサイズ：\n出身：\n趣味：\n..."}
                            value={editingCast.profile_format || ""}
                            onChange={(e) => setEditingCast({...editingCast, profile_format: e.target.value})}
                          />
                          <p className="text-xs text-muted-foreground mt-1">縦に改行されたプロフィール文章をそのまま貼り付け・編集できます</p>
                        </div>
                        <div>
                          <Label htmlFor="e-customer-base">客層メモ</Label>
                          <Textarea id="e-customer-base" rows={2} className="mt-1" value={editingCast.customer_base_memo || ""} onChange={(e) => setEditingCast({...editingCast, customer_base_memo: e.target.value})} />
                        </div>
                        <div>
                          <Label htmlFor="e-referral-route">紹介経由</Label>
                          <Input id="e-referral-route" className="mt-1" value={editingCast.referral_route || ""} onChange={(e) => setEditingCast({...editingCast, referral_route: e.target.value})} />
                        </div>
                        <div>
                          <Label>紹介報酬（広告費）</Label>
                          <Select
                            value={editingCast.referral_reward_id || "none"}
                            onValueChange={(v) => setEditingCast({...editingCast, referral_reward_id: v === "none" ? null : v})}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="適用なし" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">適用なし</SelectItem>
                              {referralRewards.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.name}（予約1本¥{r.amount.toLocaleString()}）
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">ルールはシステム＞給与＞広告費で登録できます</p>
                        </div>
                        <div>
                          <Label htmlFor="e-recent-dispatch">直近確定詳細</Label>
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

            {missingSbCasts.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-rose-800" role="alert">
                <AlertTriangle size={17} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">SB未紐付けが{missingSbCasts.length}名います</p>
                  <p className="mt-0.5 text-xs leading-relaxed">
                    {missingSbCasts.map(cast => cast.name).join("、")}。カードを開き、「管理情報」の紹介報酬を設定してください。
                  </p>
                </div>
              </div>
            )}

            {/* Cast List */}
            <div className="space-y-1">
              {categoryFilteredCasts.map((cast) => {
                const checklistExpanded = expandedChecklistIds.has(cast.id);
                const completedChecklistCount = CAST_CHECKLIST_ITEMS.filter(item => !!cast[item.field]).length;
                return (
                  <div
                  key={cast.id}
                  draggable={isAdmin}
                  onDragStart={() => { dragCastId.current = cast.id; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropCast(cast.id)}
                  className={`rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors ${
                    isSbLinked(cast) ? "" : "border-rose-300"
                  }`}
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
                        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${
                          isSbLinked(cast)
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-rose-50 text-rose-700 border-rose-300"
                        }`}>
                          {isSbLinked(cast) ? <LinkIcon size={10} /> : <AlertTriangle size={10} />}
                          {isSbLinked(cast) ? "SB紐付け済み" : "SB未紐付け"}
                        </span>
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

                  {/* 登録・SNS準備チェック（開閉式） */}
                  <button
                    type="button"
                    className="flex w-full items-center justify-between border-t px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/40"
                    onClick={(e) => { e.stopPropagation(); toggleChecklistSection(cast.id); }}
                    aria-expanded={checklistExpanded}
                    aria-controls={`cast-checklist-${cast.id}`}
                  >
                    <span className="font-semibold">登録・SNS準備 {completedChecklistCount}/{CAST_CHECKLIST_ITEMS.length}</span>
                    {checklistExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>

                  {checklistExpanded && (
                    <div id={`cast-checklist-${cast.id}`} className="flex flex-wrap gap-1.5 px-3 pb-3">
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
                  )}
                </div>
                );
              })}
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
