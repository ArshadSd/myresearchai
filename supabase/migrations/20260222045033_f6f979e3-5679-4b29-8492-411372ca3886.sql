-- Add message_content column to feedback for tracking what was helpful/unhelpful
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS message_content text DEFAULT '';

-- Add message_index column to feedback to track which message got feedback
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS message_index integer DEFAULT 0;