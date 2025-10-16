import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NotionSecretDialogProps {
  onSave?: (apiKey: string, databaseId: string) => void;
}

export const NotionSecretDialog = ({ onSave }: NotionSecretDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!apiKey || !databaseId) {
      toast({
        title: "エラー",
        description: "すべてのフィールドを入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-notion-secrets', {
        body: {
          notionApiKey: apiKey,
          notionDatabaseId: databaseId,
        },
      });

      if (error) throw error;

      toast({
        title: "設定を保存しました",
        description: "Notion APIキーとデータベースIDを設定しました。",
      });
      
      if (onSave) {
        onSave(apiKey, databaseId);
      }
      
      setApiKey("");
      setDatabaseId("");
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving secrets:', error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました。管理者権限があることを確認してください。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Key size={16} />
          API設定
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key size={20} />
            Notion API設定
          </DialogTitle>
          <DialogDescription>
            Notionとの連携に必要な認証情報を入力してください
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              入力された情報は安全に暗号化されて保存されます。
              これらの情報は外部に公開されることはありません。
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Notion API キー</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Notionインテグレーションページから取得したInternal Integration Tokenを入力
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="databaseId">データベースID</Label>
            <Input
              id="databaseId"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              データベースURLの32文字のID部分（例: https://notion.so/xxxxx の xxxxx 部分）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            キャンセル
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!apiKey || !databaseId || isLoading}
          >
            {isLoading ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
