import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface EstamaProfileData {
  source_url: string;
  name: string;
  age: number | null;
  height: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  cup_size: string | null;
  body_size: string;
  hometown: string;
  blood_type: string;
  therapist_experience: string;
  favorite_techniques: string;
  favorite_food: string;
  ideal_type: string;
  celebrity_lookalike: string;
  day_off_activities: string;
  hobbies: string;
  therapist_comment: string;
  shop_comment: string;
  features: string[];
  photos: string[];
  x_account: string;
  instagram_url: string;
  blog_url: string;
}

interface EstamaImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (profile: EstamaProfileData) => void;
}

const ESTAMA_CAST_URL = /^https:\/\/(?:www\.)?estama\.jp\/shop\/\d+\/cast\/\d+\/?(?:[?#].*)?$/i;

async function readFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "プロフィールを取得できませんでした";
  const response = (error as { context?: Response } | null)?.context;
  if (!response || typeof response.clone !== "function") return fallback;

  try {
    const body = await response.clone().json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function EstamaImportModal({ open, onOpenChange, onImported }: EstamaImportModalProps) {
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setImporting(false);
      setErrorMessage("");
    }
  }, [open]);

  const trimmedUrl = url.trim();
  const isValidUrl = ESTAMA_CAST_URL.test(trimmedUrl);

  const handleImport = async () => {
    if (!isValidUrl) {
      setErrorMessage("エスたまのセラピストページURLを入力してください");
      return;
    }

    setImporting(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("import-estama-profile", {
        body: { url: trimmedUrl },
      });

      if (error) throw new Error(await readFunctionError(error));
      if (!data?.success || !data?.profile?.name) {
        throw new Error(data?.error || "プロフィール情報が見つかりませんでした");
      }

      onImported(data.profile as EstamaProfileData);
      setUrl("");
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "プロフィールを取得できませんでした");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-pink-600" />
            エスたまからインポート
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            エステ魂のセラピストページURLから、名前・プロフィール・写真などを新規登録フォームへ転記します。
          </p>

          <div className="space-y-2">
            <Label htmlFor="estama-import-url">セラピストページURL</Label>
            <Input
              id="estama-import-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://estama.jp/shop/51445/cast/927375/"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (!importing) void handleImport();
                }
              }}
            />
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            取得後に新規追加フォームが開きます。内容を確認・修正してから「追加する」を押してください。
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="justify-start px-0 text-xs text-muted-foreground hover:bg-transparent"
              onClick={() => window.open(trimmedUrl || "https://estama.jp/", "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              入力したページを確認
            </Button>
            <Button type="button" onClick={handleImport} disabled={importing || !trimmedUrl}>
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  取得中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  URLから読み込む
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
