-- Add thread_id column to conversations table to persist OpenAI thread IDs
ALTER TABLE public.conversations 
ADD COLUMN thread_id TEXT;