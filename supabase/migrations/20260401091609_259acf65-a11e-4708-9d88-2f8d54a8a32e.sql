
CREATE TABLE public.shared_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own shared chats" ON public.shared_chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own shared chats" ON public.shared_chats
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can read by token" ON public.shared_chats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can delete own shared chats" ON public.shared_chats
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
