
CREATE TABLE public.board_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name TEXT NOT NULL,
  author_id UUID,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board posts are viewable by everyone"
ON public.board_posts FOR SELECT USING (true);

CREATE POLICY "Admins can insert board posts"
ON public.board_posts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update board posts"
ON public.board_posts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete board posts"
ON public.board_posts FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_board_posts_updated_at
BEFORE UPDATE ON public.board_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
