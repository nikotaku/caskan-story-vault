import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignatureCanvas from "react-signature-canvas";
import { X, Pen } from "lucide-react";
import { toast } from "sonner";

export default function Agreement() {
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const signatureRef = useRef<SignatureCanvas>(null);

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleSaveSignature = () => {
    if (signatureRef.current?.isEmpty()) {
      toast.error("署名を入力してください");
      return;
    }
    
    const dataUrl = signatureRef.current?.toDataURL();
    if (dataUrl) {
      setSignatureData(dataUrl);
      setIsSignatureOpen(false);
      toast.success("署名を保存しました");
    }
  };

  const handleRemoveSignature = () => {
    setSignatureData(null);
    toast.success("署名を削除しました");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">誓約書</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ご利用にあたっての注意事項</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <h3 className="text-lg font-semibold text-foreground">1. サービスのご利用について</h3>
              <p className="text-muted-foreground">
                当店のサービスをご利用いただくにあたり、以下の注意事項をご確認いただき、同意いただく必要があります。
              </p>

              <h3 className="text-lg font-semibold text-foreground mt-4">2. 禁止事項</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>セラピストへの暴言、暴力行為</li>
                <li>無理な要求や本番行為の強要</li>
                <li>施術中の撮影、録音、録画</li>
                <li>泥酔状態でのご来店</li>
                <li>感染症の疑いがある場合のご来店</li>
                <li>その他、他のお客様やスタッフに迷惑をかける行為</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground mt-4">3. キャンセルポリシー</h3>
              <p className="text-muted-foreground">
                予約のキャンセルは、ご予約時間の24時間前までにご連絡ください。
                無断キャンセルや当日キャンセルの場合、今後のご予約をお断りする場合がございます。
              </p>

              <h3 className="text-lg font-semibold text-foreground mt-4">4. 個人情報の取り扱い</h3>
              <p className="text-muted-foreground">
                お客様の個人情報は、サービス提供の目的でのみ使用し、適切に管理いたします。
              </p>

              <h3 className="text-lg font-semibold text-foreground mt-4">5. 同意</h3>
              <p className="text-muted-foreground">
                上記の注意事項を理解し、同意いただける場合は、下記の署名欄にご署名ください。
              </p>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">署名欄</h3>
                {signatureData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveSignature}
                  >
                    <X className="h-4 w-4 mr-2" />
                    削除
                  </Button>
                )}
              </div>

              {signatureData ? (
                <div className="border-2 border-muted rounded-lg p-4 bg-muted/20">
                  <img 
                    src={signatureData} 
                    alt="署名" 
                    className="w-full h-32 object-contain"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    署名がまだ入力されていません
                  </p>
                  <Button onClick={() => setIsSignatureOpen(true)}>
                    <Pen className="h-4 w-4 mr-2" />
                    署名する
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isSignatureOpen} onOpenChange={setIsSignatureOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>署名を入力してください</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col h-[calc(95vh-80px)]">
            <div className="flex-1 p-4">
              <div className="border-2 border-primary rounded-lg overflow-hidden bg-white h-full">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: "w-full h-full",
                  }}
                  backgroundColor="white"
                  penColor="black"
                />
              </div>
            </div>
            <div className="flex gap-2 p-4 pt-2 border-t">
              <Button
                variant="outline"
                onClick={handleClearSignature}
                className="flex-1"
              >
                クリア
              </Button>
              <Button
                onClick={handleSaveSignature}
                className="flex-1"
              >
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
