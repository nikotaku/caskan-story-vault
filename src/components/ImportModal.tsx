import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle, AlertCircle, FileText, RefreshCw } from "lucide-react";
import { parseCSVText, mapCustomerRows, mapReservationRows, batchInsert } from "@/lib/importMappers";

function parseCastCSV(text: string): { name: string; is_active: boolean }[] {
  const rows = parseCSVText(text);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => ({ name: (r[headers.indexOf("名前")] || r[0] || "").trim(), is_active: true }))
    .filter((r) => r.name);
}

function parseCustomerCSV(text: string) {
  const rows = parseCSVText(text);
  if (!rows.length) return [];
  return mapCustomerRows(rows[0], rows.slice(1));
}

function parseReservationCSV(text: string, castMap: Map<string, string>) {
  const rows = parseCSVText(text);
  if (!rows.length) return [];
  return mapReservationRows(rows[0], rows.slice(1), castMap);
}

// ─── Props ────────────────────────────────────────────────────
interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  type: "casts" | "customers" | "reservations";
  storeId?: string;
  onSuccess?: () => void;
}

const LABELS = {
  casts:        { title: "キャストCSVインポート",   hint: "casts_all.csv" },
  customers:    { title: "顧客CSVインポート",        hint: "customers_all.csv" },
  reservations: { title: "予約CSVインポート",        hint: "reservations_all.csv" },
};

type ImportRow = Record<string, unknown>;

export function ImportModal({ open, onClose, type, storeId, onSuccess }: ImportModalProps) {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [castMap, setCastMap] = useState<Map<string, string>>(new Map());
  const [overwrite, setOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFileName(""); setParsed([]); setProgress(0); setDone(false); setErrorMsg(""); setOverwrite(false); };

  const handleOpen = async (isOpen: boolean) => {
    if (!isOpen) { onClose(); reset(); return; }
    if (type === "reservations") {
      let query = supabase.from("casts").select("id, name").eq("is_active", true);
      if (storeId) query = query.eq("store_id", storeId);
      const { data } = await query;
      const m = new Map<string, string>();
      (data || []).forEach((c) => m.set(c.name, c.id));
      setCastMap(m);
    }
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let rows: ImportRow[] = [];
      if (type === "casts") rows = parseCastCSV(text);
      else if (type === "customers") rows = parseCustomerCSV(text);
      else rows = parseReservationCSV(text, castMap);
      setParsed(rows);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    setImporting(true);
    setErrorMsg("");
    try {
      if (type === "reservations" && overwrite) {
        const dates = [...new Set(
          parsed
            .map((row) => row.reservation_date)
            .filter((date): date is string => typeof date === "string" && date.length > 0),
        )];
        for (const date of dates) {
          let query = supabase.from("reservations").delete().eq("reservation_date", date);
          if (storeId) query = query.eq("store_id", storeId);
          const { error } = await query;
          if (error) throw new Error(`削除失敗 (${date}): ${error.message}`);
        }
      }
      const rows = storeId ? parsed.map((row) => ({ ...row, store_id: storeId })) : parsed;
      const count = await batchInsert(type, rows, setProgress);
      toast.success(`${count}件をインポートしました`);
      setDone(true);
      onSuccess?.();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      toast.error("インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  const label = LABELS[type];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{label.title}</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload size={28} className="mx-auto mb-2 text-muted-foreground" />
          {fileName ? (
            <div className="flex items-center justify-center gap-2">
              <FileText size={15} className="text-primary" />
              <span className="font-medium text-primary text-sm">{fileName}</span>
            </div>
          ) : (
            <>
              <p className="font-medium text-sm">CSVをドロップ、またはクリックして選択</p>
              <p className="text-xs text-muted-foreground mt-1">{label.hint}</p>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {parsed.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
              <span className="text-2xl font-bold">{parsed.length}</span>
              <span className="text-sm text-muted-foreground">件を読み込みました</span>
              {type === "reservations" && (
                <>
                  <span className="text-sm text-green-700 ml-auto">
                    キャスト紐付け: {parsed.filter((r) => r.cast_id).length}件
                  </span>
                  {parsed.filter((r) => !r.cast_id && r.customer_name).length > 0 && (
                    <span className="text-sm text-orange-600">
                      未紐付け: {parsed.filter((r) => !r.cast_id).length}件
                    </span>
                  )}
                </>
              )}
              {type === "customers" && (
                <div className="flex gap-3 ml-auto text-xs">
                  <span className="text-green-700">良好: {parsed.filter((r) => r.status === "active").length}</span>
                  <span className="text-orange-600">要注意: {parsed.filter((r) => r.status === "caution").length}</span>
                  <span className="text-red-600">出禁: {parsed.filter((r) => r.status === "banned").length}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-semibold text-sm">エラーが発生しました</p>
                  <p className="text-red-700 text-xs mt-1 break-all">{errorMsg}</p>
                </div>
              </div>
            )}

            {type === "reservations" && !done && (
              <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="h-4 w-4"
                />
                <RefreshCw size={14} className={overwrite ? "text-orange-500" : "text-muted-foreground"} />
                <span className={overwrite ? "text-orange-700 font-medium" : "text-muted-foreground"}>
                  同日の既存データを削除して上書き
                </span>
              </label>
            )}

            {done ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle size={18} className="text-green-600" />
                <span className="text-green-800 font-medium text-sm">{progress}件のインポートが完了しました</span>
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={handleImport} disabled={importing}>
                {importing
                  ? <><Loader2 size={15} className="mr-2 animate-spin" />インポート中... ({progress}/{parsed.length})</>
                  : overwrite ? <><RefreshCw size={15} className="mr-2" />{parsed.length}件を上書きインポートする</> : `${parsed.length}件をインポートする`}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
