import { useState } from "react";
import { RefreshCw, Database, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const NotionSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    
    try {
      console.log('Starting Notion sync...');
      
      const { data, error } = await supabase.functions.invoke('sync-notion', {
        body: {},
      });

      if (error) {
        console.error('Sync function error:', error);
        throw error;
      }

      console.log('Sync result:', data);

      if (data.success) {
        setLastSync(new Date());
        toast({
          title: "同期完了",
          description: `${data.synced}件のキャストデータを同期しました${data.errors > 0 ? `（${data.errors}件のエラー）` : ''}`,
        });

        // エラー詳細がある場合は表示
        if (data.details?.errors?.length > 0) {
          console.warn('Sync errors:', data.details.errors);
        }
      } else {
        throw new Error(data.error || 'Unknown sync error');
      }
    } catch (error) {
      console.error('Error syncing with Notion:', error);
      toast({
        title: "同期エラー",
        description: error instanceof Error ? error.message : "Notionとの同期に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database size={20} />
          Notion連携
        </CardTitle>
        <CardDescription>
          Notionデータベースからキャスト情報と画像を同期します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">データベース同期</p>
            {lastSync && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle size={12} />
                最終同期: {lastSync.toLocaleString('ja-JP')}
              </p>
            )}
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? '同期中...' : '今すぐ同期'}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>同期されるデータ:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>キャスト名、年齢、ランク</li>
                <li>料金、スリーサイズ、プロフィール</li>
                <li>電話番号</li>
                <li>写真（Notionのファイル/外部URL/カバー画像）</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
