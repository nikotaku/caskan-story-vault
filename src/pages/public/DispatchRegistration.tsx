import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/hooks/useStore";
import { supabase } from "@/integrations/supabase/client";

const ENTRY_SOURCES = ["ネット媒体", "エステ魂", "HP"] as const;

export default function DispatchRegistration() {
  const { token = "" } = useParams();
  const { store } = useStore();
  const [name, setName] = useState("");
  const [dispatchStart, setDispatchStart] = useState("");
  const [dispatchEnd, setDispatchEnd] = useState("");
  const [entrySource, setEntrySource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!name.trim() || !dispatchStart || !dispatchEnd || !entrySource) {
      setError("すべての項目を入力してください。");
      return;
    }
    if (dispatchEnd < dispatchStart) {
      setError("派遣期間の終了日は開始日以降にしてください。");
      return;
    }

    setSubmitting(true);
    const { error: submitError } = await supabase.rpc("submit_dispatch_registration", {
      p_token: token,
      p_name: name.trim(),
      p_dispatch_start: dispatchStart,
      p_dispatch_end: dispatchEnd,
      p_entry_source: entrySource,
    });
    setSubmitting(false);

    if (submitError) {
      setError("送信できませんでした。リンクが正しいか確認して、もう一度お試しください。");
      return;
    }
    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-sm text-muted-foreground">{store?.name ?? ""}</p>
          <h1 className="mt-1 text-2xl font-bold">派遣登録フォーム</h1>
        </div>

        <Card>
          {submitted ? (
            <CardContent className="py-14 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h2 className="mt-4 text-xl font-semibold">送信しました</h2>
              <p className="mt-2 text-sm text-muted-foreground">ご入力ありがとうございます。担当者からの連絡をお待ちください。</p>
            </CardContent>
          ) : (
            <>
              <CardHeader><CardTitle className="text-lg">派遣情報を入力してください</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="dispatch-name">お名前</Label>
                    <Input id="dispatch-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">派遣期間</legend>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="dispatch-start" className="text-xs text-muted-foreground">開始日</Label>
                        <Input id="dispatch-start" type="date" value={dispatchStart} onChange={(event) => setDispatchStart(event.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dispatch-end" className="text-xs text-muted-foreground">終了日</Label>
                        <Input id="dispatch-end" type="date" min={dispatchStart} value={dispatchEnd} onChange={(event) => setDispatchEnd(event.target.value)} required />
                      </div>
                    </div>
                  </fieldset>

                  <div className="space-y-2">
                    <Label>入店経由</Label>
                    <Select value={entrySource} onValueChange={setEntrySource} required>
                      <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        {ENTRY_SOURCES.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "送信中..." : "送信する"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
