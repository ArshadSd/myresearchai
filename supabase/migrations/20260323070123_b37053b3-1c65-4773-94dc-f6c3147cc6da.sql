
-- Create schedulers table
CREATE TABLE public.schedulers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topics TEXT,
  total_days INTEGER NOT NULL,
  current_day INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.schedulers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedulers" ON public.schedulers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedulers" ON public.schedulers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedulers" ON public.schedulers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedulers" ON public.schedulers FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_schedulers_updated_at
  BEFORE UPDATE ON public.schedulers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create scheduler_days table
CREATE TABLE public.scheduler_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduler_id UUID NOT NULL REFERENCES public.schedulers(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  outcomes TEXT[] NOT NULL DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(scheduler_id, day_number)
);

ALTER TABLE public.scheduler_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduler days" ON public.scheduler_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.schedulers s WHERE s.id = scheduler_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can insert own scheduler days" ON public.scheduler_days FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedulers s WHERE s.id = scheduler_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can update own scheduler days" ON public.scheduler_days FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.schedulers s WHERE s.id = scheduler_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can delete own scheduler days" ON public.scheduler_days FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.schedulers s WHERE s.id = scheduler_id AND s.user_id = auth.uid()));

-- Create scheduler_questions table
CREATE TABLE public.scheduler_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduler_day_id UUID NOT NULL REFERENCES public.scheduler_days(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer INTEGER NOT NULL,
  user_answer INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduler_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduler questions" ON public.scheduler_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scheduler_days sd
    JOIN public.schedulers s ON s.id = sd.scheduler_id
    WHERE sd.id = scheduler_day_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own scheduler questions" ON public.scheduler_questions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scheduler_days sd
    JOIN public.schedulers s ON s.id = sd.scheduler_id
    WHERE sd.id = scheduler_day_id AND s.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own scheduler questions" ON public.scheduler_questions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.scheduler_days sd
    JOIN public.schedulers s ON s.id = sd.scheduler_id
    WHERE sd.id = scheduler_day_id AND s.user_id = auth.uid()
  ));
