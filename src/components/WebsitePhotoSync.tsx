import { useState } from "react";
import { RefreshCw, Image, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SyncResult {
  name: string;
  action: string;
  photoUrl: string;
  profileData?: {
    age?: number;
    height?: number;
    measurements?: string;
  };
}

interface SyncError {
  name: string;
  error: string;
}

export const WebsitePhotoSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResults([]);
    setSyncErrors([]);
    
    try {
      console.log('Starting website photo sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-website-photos', {
        body: {},
      });

      if (error) {
        console.error('Sync function error:', error);
        throw error;
      }

      console.log('Sync result:', data);

      if (data.success) {
        setLastSync(new Date());
        
        // 結果を保存
        if (data.details?.syncResults) {
          setSyncResults(data.details.syncResults);
        }
        if (data.details?.errors) {
          setSyncErrors(data.details.errors);
        }
        
        const successMessage = data.synced > 0 
          ? `${data.synced}/${data.total}件のセラピスト情報を同期しました`
          : `${data.total}件見つかりましたが、データベースに一致するセラピストはありませんでした`;
        
        toast({
          title: "同期完了",
          description: successMessage + (data.errors > 0 ? `\n${data.errors}件のエラーがあります` : ''),
        });

        // 詳細をコンソールに出力
        if (data.details?.syncResults?.length > 0) {
          console.log('✓ 同期成功:', data.details.syncResults);
        }
        
        if (data.details?.errors?.length > 0) {
          console.warn('⚠ 同期エラー:', data.details.errors);
        }
      } else {
        throw new Error(data.error || 'Unknown sync error');
      }
    } catch (error) {
      console.error('Error syncing photos:', error);
      toast({
        title: "同期エラー",
        description: error instanceof Error ? error.message : "ウェブサイトとの同期に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          <CardTitle>エステ魂ウェブサイト連携</CardTitle>
        </div>
        <CardDescription>
          estama.jp/shop/43923/cast/ からセラピストの写真・プロフィール情報を自動取得
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">情報同期</p>
            {lastSync && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                最終同期: {lastSync.toLocaleString('ja-JP')}
              </p>
            )}
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? '同期中...' : '今すぐ同期'}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">同期される情報:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>写真URL、年齢、身長、スリーサイズ、カップサイズ</li>
                <li>体型、エステ歴、得意施術、血液型</li>
                <li>好きな食べ物、好きなタイプ、似ている芸能人</li>
                <li>休日の過ごし方、趣味・特技、メッセージ、Xアカウント</li>
              </ul>
              <p className="mt-2 text-amber-600 dark:text-amber-400 font-medium">
                ⚠ 注意: 名前が一致する既存セラピストのみ更新（新規作成なし）
              </p>
              <a 
                href="https://estama.jp/shop/43923/cast/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
              >
                ソースを確認 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* 同期結果 */}
        {syncResults.length > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">同期成功 ({syncResults.length}件)</p>
                <ScrollArea className="h-[200px] rounded border bg-background p-2">
                  <div className="space-y-2">
                    {syncResults.map((result, idx) => (
                      <div key={idx} className="text-xs p-2 rounded bg-muted/50">
                        <div className="font-medium">{result.name}</div>
                        {result.profileData && (
                          <div className="text-muted-foreground mt-1 space-y-0.5">
                            {result.profileData.age && <div>年齢: {result.profileData.age}歳</div>}
                            {result.profileData.height && <div>身長: {result.profileData.height}cm</div>}
                            {result.profileData.measurements && (
                              <div>サイズ: {result.profileData.measurements}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* エラー */}
        {syncErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">エラー ({syncErrors.length}件)</p>
                <ScrollArea className="h-[150px] rounded border bg-background/50 p-2">
                  <div className="space-y-2">
                    {syncErrors.map((error, idx) => (
                      <div key={idx} className="text-xs p-2 rounded bg-muted/50">
                        <div className="font-medium">{error.name}</div>
                        <div className="text-muted-foreground mt-1">{error.error}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};