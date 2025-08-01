-- Add aircraft_model column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN aircraft_model text NOT NULL DEFAULT 'A320';

-- Create aircraft_assistants table to store OpenAI Assistant IDs for each aircraft model
CREATE TABLE public.aircraft_assistants (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aircraft_model text NOT NULL UNIQUE,
    assistant_id text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.aircraft_assistants ENABLE ROW LEVEL SECURITY;

-- Create policy for aircraft_assistants (readable by all authenticated users)
CREATE POLICY "Authenticated users can view aircraft assistants" 
ON public.aircraft_assistants 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Insert default aircraft models (you'll need to update with actual Assistant IDs)
INSERT INTO public.aircraft_assistants (aircraft_model, assistant_id) VALUES 
('A320', 'asst_placeholder_a320'),
('A330', 'asst_placeholder_a330'),
('A350', 'asst_placeholder_a350');

-- Add index for better performance
CREATE INDEX idx_conversations_aircraft_model ON public.conversations(aircraft_model);
CREATE INDEX idx_aircraft_assistants_model ON public.aircraft_assistants(aircraft_model);