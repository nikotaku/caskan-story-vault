import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface SocialPostingProps {
  title: string;
  defaultContent: string;
  twitterUrl: string;
  hpUrl: string;
}

export const SocialPosting = ({ title, defaultContent, twitterUrl, hpUrl }: SocialPostingProps) => {
  const [content, setContent] = useState(defaultContent);
  const { toast } = useToast();

  const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.select();
  };

  const handleTwitterPost = () => {
    window.open(twitterUrl, '_blank');
    toast({
      title: "Twitter投稿",
      description: "Twitterの投稿画面を開きました",
    });
  };

  const handleHpPost = () => {
    window.open(hpUrl, '_blank');
    toast({
      title: "HP投稿",
      description: "ホームページの投稿画面を開きました", 
    });
  };

  return (
    <div className="mb-6">
      <div className="mb-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          rows={5}
          className="resize-none font-mono text-sm"
        />
      </div>
      
      <div className="flex gap-2 flex-wrap">
        <Button 
          onClick={handleTwitterPost}
          className="bg-primary hover:bg-primary/90"
          size="sm"
        >
          𝕏（旧Twitter）に投稿
        </Button>
        <Button 
          onClick={handleHpPost}
          className="bg-primary hover:bg-primary/90"
          size="sm"
        >
          HPに投稿
        </Button>
      </div>
    </div>
  );
};