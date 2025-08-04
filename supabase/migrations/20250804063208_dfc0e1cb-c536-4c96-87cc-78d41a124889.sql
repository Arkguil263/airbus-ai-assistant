-- Create registration_secrets table to store valid secret words
CREATE TABLE public.registration_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  secret_word TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.registration_secrets ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can manage secrets (for now, allowing all authenticated users to read for verification)
CREATE POLICY "Allow authenticated users to read active secrets" 
ON public.registration_secrets 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_registration_secrets_updated_at
BEFORE UPDATE ON public.registration_secrets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert a default secret word for testing (you can change this later)
INSERT INTO public.registration_secrets (secret_word, description, is_active) 
VALUES ('welcome123', 'Default secret word for registration', true);