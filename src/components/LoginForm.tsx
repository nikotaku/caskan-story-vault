import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const LoginForm = () => {
  const [storeId, setStoreId] = useState("");
  const [loginId, setLoginId] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeId || !loginId) {
      toast({
        title: "入力エラー",
        description: "すべての項目を入力してください",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "ログイン処理中",
      description: "認証を実行しています...",
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-card">
      <CardHeader className="text-center pb-6">
        <h2 className="text-lg font-medium text-foreground">スタッフログイン</h2>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-id" className="text-sm font-normal text-foreground">
              店舗ID
            </Label>
            <Input
              id="store-id"
              type="text"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="h-11 bg-input border-border"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="login-id" className="text-sm font-normal text-foreground">
              ログインIDまたはメールアドレス
            </Label>
            <Input
              id="login-id"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-input border-border"
              required
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-normal rounded-md mt-6"
          >
            次へ
          </Button>
        </form>
        
        <div className="text-center pt-4">
          <a 
            href="#" 
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            キャストのログインはこちら
          </a>
        </div>
      </CardContent>
    </Card>
  );
};