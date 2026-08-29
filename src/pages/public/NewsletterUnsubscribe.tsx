import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle, MailX, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type UnsubscribeState = "ready" | "submitting" | "success" | "error";

export default function NewsletterUnsubscribe() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<UnsubscribeState>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage("配信停止リンクが正しくありません。");
    }
  }, [token]);

  const unsubscribe = async () => {
    if (!token || state === "submitting") return;
    setState("submitting");
    setErrorMessage("");
    const { data, error } = await supabase.functions.invoke("unsubscribe-newsletter", {
      body: { token },
    });
    if (error || !data?.success) {
      setState("error");
      setErrorMessage(data?.error === "not_found"
        ? "この配信停止リンクは無効か、すでに利用できません。"
        : "配信停止の処理に失敗しました。時間をおいてもう一度お試しください。");
      return;
    }
    setState("success");
  };

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center">
          {state === "success" ? (
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
          ) : state === "error" ? (
            <TriangleAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          ) : (
            <MailX className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
          )}
          <CardTitle className="mt-3">メルマガ配信の停止</CardTitle>
          <CardDescription>
            {state === "success"
              ? "メルマガの配信を停止しました。"
              : "今後のご案内メールの受信を停止します。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state === "success" ? (
            <p className="text-sm text-muted-foreground">お手続きは完了しています。再登録をご希望の場合は店舗へお問い合わせください。</p>
          ) : state === "error" ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">停止後も予約に関する重要な連絡は、必要に応じて別途お送りする場合があります。</p>
              <Button className="w-full" onClick={unsubscribe} disabled={state === "submitting" || !token}>
                {state === "submitting" && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                メルマガの配信を停止する
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
