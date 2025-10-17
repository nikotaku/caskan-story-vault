import { useState } from "react";
import { RefreshCw, Image, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const WebsitePhotoSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    setIsSyncing(true);
    
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
        toast({
          title: "写真同期完了",
          description: `${data.synced}件の写真を同期しました${data.errors > 0 ? `（${data.errors}件のエラー）` : ''}`,
        });

        if (data.details?.errors?.length > 0) {
          console.warn('Sync errors:', data.details.errors);
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
        <CardTitle className="flex items-center gap-2">
          <Image size={20} />
          ウェブサイト写真同期
        </CardTitle>
        <CardDescription>
          zenryoku-esthe.comからセラピストの写真を自動取得
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">写真URL同期</p>
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
              <p>セラピスト名が一致するキャストの写真URLを更新します</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>大文字小文字を区別せずに照合</li>
                <li>既存のキャストのみ更新（新規作成なし）</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};