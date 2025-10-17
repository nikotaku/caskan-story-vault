-- Create back_rates table for therapist commission rates
CREATE TABLE IF NOT EXISTS public.back_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_type TEXT NOT NULL, -- 'aroma' or 'zenryoku'
  duration INTEGER NOT NULL, -- in minutes
  customer_price INTEGER NOT NULL,
  therapist_back INTEGER NOT NULL,
  shop_back INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_type, duration)
);

-- Create option_rates table for option pricing
CREATE TABLE IF NOT EXISTS public.option_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_name TEXT NOT NULL UNIQUE,
  customer_price INTEGER NOT NULL,
  therapist_back INTEGER NOT NULL,
  shop_back INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nomination_rates table for nomination fees
CREATE TABLE IF NOT EXISTS public.nomination_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nomination_type TEXT NOT NULL UNIQUE,
  customer_price INTEGER NOT NULL,
  therapist_back INTEGER,
  shop_back INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expense_rates table for daily expenses
CREATE TABLE IF NOT EXISTS public.expense_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_type TEXT NOT NULL UNIQUE,
  therapist_deduction INTEGER NOT NULL,
  shop_income INTEGER NOT NULL,
  min_days INTEGER, -- minimum days required for this expense
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.back_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomination_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies - viewable by everyone, editable by admins only
CREATE POLICY "Back rates are viewable by everyone" ON public.back_rates FOR SELECT USING (true);
CREATE POLICY "Admins can insert back rates" ON public.back_rates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update back rates" ON public.back_rates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete back rates" ON public.back_rates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Option rates are viewable by everyone" ON public.option_rates FOR SELECT USING (true);
CREATE POLICY "Admins can insert option rates" ON public.option_rates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update option rates" ON public.option_rates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete option rates" ON public.option_rates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Nomination rates are viewable by everyone" ON public.nomination_rates FOR SELECT USING (true);
CREATE POLICY "Admins can insert nomination rates" ON public.nomination_rates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update nomination rates" ON public.nomination_rates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete nomination rates" ON public.nomination_rates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Expense rates are viewable by everyone" ON public.expense_rates FOR SELECT USING (true);
CREATE POLICY "Admins can insert expense rates" ON public.expense_rates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update expense rates" ON public.expense_rates FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete expense rates" ON public.expense_rates FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add triggers for updated_at
CREATE TRIGGER update_back_rates_updated_at BEFORE UPDATE ON public.back_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_option_rates_updated_at BEFORE UPDATE ON public.option_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_nomination_rates_updated_at BEFORE UPDATE ON public.nomination_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expense_rates_updated_at BEFORE UPDATE ON public.expense_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert base course rates
INSERT INTO public.back_rates (course_type, duration, customer_price, therapist_back, shop_back) VALUES
('aroma', 80, 12000, 6000, 6000),
('aroma', 100, 15000, 8000, 7000),
('aroma', 120, 18000, 9000, 9000),
('zenryoku', 60, 15000, 8000, 7000),
('zenryoku', 80, 19000, 10000, 9000);

-- Insert option rates
INSERT INTO public.option_rates (option_name, customer_price, therapist_back, shop_back) VALUES
('延長20分', 5000, 3000, 2000),
('DR10分', 1000, 1000, NULL),
('衣装MB', 5000, 5000, NULL),
('極液', 2000, 2000, NULL);

-- Insert nomination rates
INSERT INTO public.nomination_rates (nomination_type, customer_price, therapist_back, shop_back) VALUES
('ネット指名', 1000, NULL, 1000),
('本指名', 2000, 2000, NULL),
('姫予約', 2000, 2000, NULL);

-- Insert expense rates
INSERT INTO public.expense_rates (expense_type, therapist_deduction, shop_income, min_days) VALUES
('雑費', 2000, 2000, 1),
('宿泊費', 2000, 2000, 1),
('交通費3日', -5000, 5000, 3),
('交通費5日', -10000, 10000, 5);

-- Update reservations table to include options and nomination info
ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS course_type TEXT,
  ADD COLUMN IF NOT EXISTS options TEXT[], -- array of option names
  ADD COLUMN IF NOT EXISTS nomination_type TEXT;