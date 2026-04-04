
-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic',
  billing_cycle TEXT DEFAULT 'monthly',
  razorpay_subscription_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Daily usage tracking
CREATE TABLE public.daily_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chats_used INTEGER NOT NULL DEFAULT 0,
  schedulers_created INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Subscription RLS policies
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Daily usage RLS policies
CREATE POLICY "Users can view own usage" ON public.daily_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON public.daily_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.daily_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Auto-create basic subscription for new users trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'basic', 'active');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();
