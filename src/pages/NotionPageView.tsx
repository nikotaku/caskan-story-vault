import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface NotionPage {
  id: string;
  title: string;
  content: {
    blocks: Array<{
      type: string;
      id: string;
      content: any;
    }>;
  };
  slug: string;
}

export default function NotionPageView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<NotionPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchPage();
    }
  }, [slug]);

  const fetchPage = async () => {
    try {
      const { data, error } = await supabase
        .from('notion_pages')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      setPage(data as unknown as NotionPage);
    } catch (error) {
      console.error('Error fetching page:', error);
      navigate('/public');
    } finally {
      setLoading(false);
    }
  };

  const renderBlock = (block: any) => {
    const { type, content } = block;

    if (!content) return null;

    switch (type) {
      case 'paragraph':
        return content.text ? <p className="mb-4">{content.text}</p> : <br />;
      
      case 'heading_1':
        return <h1 className="text-3xl font-bold mb-4">{content.text}</h1>;
      
      case 'heading_2':
        return <h2 className="text-2xl font-bold mb-3">{content.text}</h2>;
      
      case 'heading_3':
        return <h3 className="text-xl font-bold mb-2">{content.text}</h3>;
      
      case 'bulleted_list_item':
        return <li className="ml-6 mb-2">{content.text}</li>;
      
      case 'numbered_list_item':
        return <li className="ml-6 mb-2 list-decimal">{content.text}</li>;
      
      case 'quote':
        return (
          <blockquote className="border-l-4 border-primary pl-4 italic my-4">
            {content.text}
          </blockquote>
        );
      
      case 'code':
        return (
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4">
            <code>{content.text}</code>
          </pre>
        );
      
      case 'image':
        return (
          <div className="my-6">
            <img 
              src={content.url} 
              alt={content.caption || ''} 
              className="max-w-full h-auto rounded-lg"
            />
            {content.caption && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                {content.caption}
              </p>
            )}
          </div>
        );
      
      case 'divider':
        return <hr className="my-6 border-border" />;
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/public" className="flex items-center space-x-2">
            <img src="/src/assets/caskan-logo.png" alt="Logo" className="h-8 w-auto" />
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link to="/public" className="text-sm font-medium hover:text-primary transition-colors">
              トップ
            </Link>
            <Link to="/page/a" className="text-sm font-medium text-primary transition-colors">
              料金・システム
            </Link>
            <Link to="/public/schedule" className="text-sm font-medium hover:text-primary transition-colors">
              出勤情報
            </Link>
            <Link to="/public/casts" className="text-sm font-medium hover:text-primary transition-colors">
              セラピスト
            </Link>
            <Link to="/public/system" className="text-sm font-medium hover:text-primary transition-colors">
              システム
            </Link>
            <Link to="/public/booking" className="text-sm font-medium hover:text-primary transition-colors">
              WEB予約
            </Link>
          </nav>
        </div>
      </header>

      <main className="container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>

          <article className="prose prose-slate dark:prose-invert max-w-none">
            <h1 className="text-4xl font-bold mb-8">{page.title}</h1>
            
            <div className="space-y-2">
              {page.content.blocks.map((block, index) => (
                <div key={block.id || index}>
                  {renderBlock(block)}
                </div>
              ))}
            </div>
          </article>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t mt-12">
        <div className="container max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          © 2025 全力エステ ZR. All rights reserved.
        </div>
      </footer>
    </div>
  );
}