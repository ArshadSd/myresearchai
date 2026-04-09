-- Fix 1: Remove overly broad SELECT policy on shared_chats
DROP POLICY IF EXISTS "Anyone authenticated can read by token" ON public.shared_chats;

-- Fix 2: Remove INSERT and UPDATE policies on subscriptions to prevent privilege escalation
-- Subscriptions should only be managed by service role (triggers + edge functions)
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- Users can still read their own subscription
-- The existing "Users can view own subscription" SELECT policy remains