-- Add RLS policies to allow authenticated users to manage aircraft assistants
CREATE POLICY "Authenticated users can insert aircraft assistants" 
ON public.aircraft_assistants 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update aircraft assistants" 
ON public.aircraft_assistants 
FOR UPDATE 
TO authenticated
USING (true);

-- Insert default records for each aircraft model if they don't exist
INSERT INTO public.aircraft_assistants (aircraft_model, assistant_id) 
VALUES 
  ('A320', 'asst_placeholder_a320'),
  ('A330', 'asst_placeholder_a330'),
  ('A350', 'asst_placeholder_a350')
ON CONFLICT (aircraft_model) DO NOTHING;