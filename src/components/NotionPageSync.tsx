import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2 } from "lucide-react";

export const NotionPageSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [pageId, setPageId] = useState("");
  const [slug, setSlug] = useState("");
  const { toast } = useToast();

  const handleSync = async () => {
    if (!pageId || !slug) {
      toast({
        title: "入力エラー",
        description: "NotionページIDとスラッグを入力してください",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    console.log('Starting Notion page sync...', { pageId, slug });

    try {
      const { data, error } = await supabase.functions.invoke('sync-notion-page', {
        body: { pageId, slug }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "同期完了",
          description: `ページ「${data.page.title}」を同期しました`,
        });
        setPageId("");
        setSlug("");
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "同期エラー",
        description: error.message || "Notionページの同期に失敗しました",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText size={20} />
          Notionページ同期
        </CardTitle>
        <CardDescription>
          NotionページをWebサイトに表示するために同期します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="page-id">NotionページID</Label>
          <Input
            id="page-id"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="例: 27df9507f0cf80a2ab6be385d8570292"
            disabled={syncing}
          />
          <p className="text-xs text-muted-foreground mt-1">
            ページURLの最後の32文字（ハイフンなし）
          </p>
        </div>

        <div>
          <Label htmlFor="slug">スラッグ（URL用）</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="例: about-us"
            disabled={syncing}
          />
          <p className="text-xs text-muted-foreground mt-1">
            表示URL: /page/スラッグ
          </p>
        </div>

        <Button 
          onClick={handleSync} 
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              同期中...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              同期
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};