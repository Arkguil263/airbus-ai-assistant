-- Add user_email column to messages table
ALTER TABLE public.messages ADD COLUMN user_email TEXT;

-- Backfill existing messages with user email from conversations and auth.users
UPDATE public.messages 
SET user_email = (
  SELECT auth.users.email 
  FROM public.conversations 
  JOIN auth.users ON conversations.user_id = auth.users.id 
  WHERE conversations.id = messages.conversation_id
);

-- Make the column NOT NULL after backfilling
ALTER TABLE public.messages ALTER COLUMN user_email SET NOT NULL;

-- Add index for efficient filtering by user email
CREATE INDEX idx_messages_user_email ON public.messages(user_email);