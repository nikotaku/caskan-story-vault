-- Add unique constraint to casts.name for proper upsert functionality
ALTER TABLE public.casts ADD CONSTRAINT casts_name_unique UNIQUE (name);

-- Create table for storing Notion page content
CREATE TABLE IF NOT EXISTS public.notion_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notion_page_id text NOT NULL UNIQUE,
  title text NOT NULL,
  content jsonb NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notion_pages ENABLE ROW LEVEL SECURITY;

-- Policies for notion_pages
CREATE POLICY "Notion pages are viewable by everyone"
  ON public.notion_pages
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert notion pages"
  ON public.notion_pages
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update notion pages"
  ON public.notion_pages
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete notion pages"
  ON public.notion_pages
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_notion_pages_updated_at
  BEFORE UPDATE ON public.notion_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();