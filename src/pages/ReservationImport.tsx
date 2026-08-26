import { useState, useRef, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";

interface ParsedRow {
  reservation_date: string;
  start_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  cast_name: string;
  cast_id: string | null;
  course: string;
  duration: number;
  room: string | null;
  price: number;
  payment_method: string | null;
  status: string;
  route: string;
}

function parsePrice(s: string): number {
  if (!s) return 0;
  return parseInt(s.replace(/[¥,\s円]/g, "") || "0", 10) || 0;
}

function parseDuration(course: string): number {
  const m = course.match(/(\d+)分/);
  return m ? parseInt(m[1], 10) : 60;
}

// Handles formats: "YYYY/MM/DD HH:MM:SS" or "YYYY/MM/DD HH:MM" or "MM/DD 曜日 HH:MM"
function parseDate(s: string): { date: string; time: string } | null {
  if (!s || !s.trim()) return null;
  const str = s.trim();

  // YYYY-MM-DD HH:MM(:SS)
  const m0 = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (m0) {
    return {
      date: `${m0[1]}-${m0[2].padStart(2, "0")}-${m0[3].padStart(2, "0")}`,
      time: `${m0[4].padStart(2, "0")}:${m0[5]}`,
    };
  }

  // YYYY/MM/DD HH:MM(:SS)
  const m1 = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (m1) {
    return {
      date: `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`,
      time: `${m1[4].padStart(2, "0")}:${m1[5]}`,
    };
  }

  // MM/DD 曜日? HH:MM (legacy format — assume year from month)
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\s*[月火水木金土日]?\s*(\d{1,2}):(\d{2})/);
  if (m2) {
    const month = parseInt(m2[1], 10);
    const year = month >= 10 ? 2025 : 2026;
    return {
      date: `${year}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`,
      time: `${m2[3].padStart(2, "0")}:${m2[4]}`,
    };
  }

  return null;
}

function parseCastName(s: string): string {
  if (!s) return "";
  const name = s.trim().split(/\s+/)[0];
  if (["写真指名", "本指名", "講習", ""].includes(name)) return "";
  return name.replace(/^[？🌊🚢]+/, "");
}

function parseStatus(s: string): string {
  switch (s) {
    case "完了": return "completed";
    case "キャンセル": return "cancelled";
    case "予約確定": return "confirmed";
    case "新規予約": return "pending";
    default: return "pending";
  }
}

function parsePayment(s: string): string | null {
  if (!s) return null;
  if (s.includes("カード") || s.includes("クレジット")) return "card";
  if (s.includes("PayPay") || s.includes("paypay")) return "paypay";
  if (s.includes("現金")) return "cash";
  return s || null;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === "," && !inQuote) {
        cols.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  // UTF-8 (strict) first — throws on invalid sequences
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    // Not valid UTF-8 → try Shift-JIS (caskan default)
  }
  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    // last resort
  }
  return new TextDecoder("utf-8").decode(buffer);
}

export default function ReservationImport() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [castMap, setCastMap] = useState<Map<string, string>>(new Map());
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) loadCasts();
  }, [user]);

  const loadCasts = async () => {
    const { data } = await supabase.from("casts").select("id, name").eq("is_active", true);
    const map = new Map<string, string>();
    (data || []).forEach((c: any) => map.set(c.name, c.id));
    setCastMap(map);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParsed([]);
    setImportedCount(0);
    setParseError("");
    setDetectedHeaders([]);

    const text = await readFileAsText(file);
    const cleaned = text.replace(/^﻿/, ""); // strip BOM
    const rows = parseCSV(cleaned);
    if (rows.length < 2) {
      setParseError("データが見つかりません（行数が足りません）");
      return;
    }

    const headers = rows[0].map((h) => h.trim());
    setDetectedHeaders(headers);

    const REQUIRED = ["開始日時", "予約名", "キャスト", "コース"];
    const missing = REQUIRED.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      setParseError(`列が見つかりません: ${missing.join(", ")}\n検出された列: ${headers.slice(0, 8).join(", ")}...`);
      return;
    }

    const getCol = (row: string[], name: string) => (row[headers.indexOf(name)] || "").trim();

    const result: ParsedRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((c) => !c.trim())) continue;

      // 開始日時 contains both date and start time
      const dateStr = getCol(row, "開始日時") || getCol(row, "予約日");
      const parsedDate = parseDate(dateStr);
      if (!parsedDate) continue;

      const castRaw = getCol(row, "キャスト");
      const castName = parseCastName(castRaw);

      result.push({
        reservation_date: parsedDate.date,
        start_time: parsedDate.time,
        customer_name: getCol(row, "予約名") || getCol(row, "氏名") || "不明",
        customer_phone: getCol(row, "電話番号").replace(/^'/, "") || "",
        customer_email: getCol(row, "メールアドレス") || "",
        cast_name: castName,
        cast_id: castName ? (castMap.get(castName) || null) : null,
        course: getCol(row, "コース"),
        duration: parseDuration(getCol(row, "コース")),
        room: getCol(row, "ルーム") || null,
        price: parsePrice(getCol(row, "売上") || getCol(row, "料金")),
        payment_method: parsePayment(getCol(row, "決済方法") || getCol(row, "支払方法") || getCol(row, "決済")),
        status: parseStatus(getCol(row, "ステータス")),
        route: getCol(row, "予約経路") || getCol(row, "予約出路") || getCol(row, "経路") || "",
      });
    }
    setParsed(result);
  };

  const unmatchedCasts = [...new Set(
    parsed.filter((r) => r.cast_name && !r.cast_id).map((r) => r.cast_name)
  )];

  const validRows = parsed.filter((r) => r.reservation_date && r.cast_id);
  const skippedRows = parsed.filter((r) => !r.cast_id);

  const handleImport = async () => {
    if (!window.confirm(`既存の予約データをすべて削除してから、${validRows.length}件を取り込みます。よろしいですか？`)) {
      return;
    }
    setImporting(true);
    setImportedCount(0);
    try {
      // 重複防止: 既存の予約をすべて削除してから入れ替える
      const { error: delError } = await supabase
        .from("reservations")
        .delete()
        .not("id", "is", null);
      if (delError) {
        console.error("Delete error:", delError);
        toast.error(`既存データの削除に失敗しました: ${delError.message}`);
        setImporting(false);
        return;
      }

      const BATCH = 100;
      let count = 0;
      for (let i = 0; i < validRows.length; i += BATCH) {
        const batch = validRows.slice(i, i + BATCH).map((r) => ({
          reservation_date: r.reservation_date,
          start_time: r.start_time,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          customer_email: r.customer_email || null,
          cast_id: r.cast_id,
          course_name: r.course,
          duration: r.duration,
          room: r.room || null,
          price: r.price,
          payment_method: r.payment_method,
          status: r.status,
          booking_origin: "csv_import",
          notes: r.route ? `経路: ${r.route}` : null,
        }));
        const { error } = await supabase.from("reservations").insert(batch);
        if (error) {
          console.error("Batch error:", error);
          toast.error(`エラー: ${error.message}`);
          break;
        }
        count += batch.length;
        setImportedCount(count);
      }
      if (count > 0) toast.success(`${count}件をインポートしました`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="pt-[60px] md:ml-[240px] p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-2">予約データインポート</h1>
          <p className="text-muted-foreground text-sm mb-6">
            キャスカンのCSVエクスポート（Shift-JIS・UTF-8両対応）から予約データを一括インポートします
          </p>

          {/* Upload area */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <span className="font-medium text-primary">{fileName}</span>
                  </div>
                ) : (
                  <>
                    <p className="font-medium">CSVファイルをドロップ、またはクリックして選択</p>
                    <p className="text-sm text-muted-foreground mt-1">キャスカン予約CSV（Shift-JIS可）</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Parse error */}
          {parseError && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="pt-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-red-800 font-medium text-sm">ファイルの読み込みに失敗しました</p>
                  <p className="text-red-700 text-xs mt-1 whitespace-pre-wrap">{parseError}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {parsed.length > 0 && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold">{parsed.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">読込件数</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{validRows.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">取込対象</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-orange-500">{skippedRows.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">スキップ（キャスト不明）</p>
                  </CardContent>
                </Card>
              </div>

              {/* Unmatched casts */}
              {unmatchedCasts.length > 0 && (
                <Card className="mb-6 border-orange-200 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle size={16} className="text-orange-600" />
                      キャスト名が一致しません（これらの行はスキップされます）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {unmatchedCasts.map((n) => (
                        <span key={n} className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                          {n}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Preview table */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-sm">プレビュー（先頭10件）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-2 py-1 text-left">予約日</th>
                          <th className="px-2 py-1 text-left">時間</th>
                          <th className="px-2 py-1 text-left">顧客名</th>
                          <th className="px-2 py-1 text-left">キャスト</th>
                          <th className="px-2 py-1 text-left">コース</th>
                          <th className="px-2 py-1 text-right">料金</th>
                          <th className="px-2 py-1 text-left">ステータス</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validRows.slice(0, 10).map((r, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="px-2 py-1">{r.reservation_date}</td>
                            <td className="px-2 py-1">{r.start_time}</td>
                            <td className="px-2 py-1">{r.customer_name}</td>
                            <td className="px-2 py-1 text-green-700">{r.cast_name || "—"}</td>
                            <td className="px-2 py-1">{r.course}</td>
                            <td className="px-2 py-1 text-right">¥{r.price.toLocaleString()}</td>
                            <td className="px-2 py-1">{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Import button */}
              {importedCount > 0 ? (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-4 flex items-center gap-3">
                    <CheckCircle className="text-green-600" size={20} />
                    <p className="text-green-800 font-medium">{importedCount}件のインポートが完了しました</p>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleImport}
                  disabled={importing || validRows.length === 0}
                >
                  {importing ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" />インポート中... ({importedCount}/{validRows.length})</>
                  ) : (
                    `既存データを削除して${validRows.length}件を取り込む`
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
