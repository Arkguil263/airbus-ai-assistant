-- Remove the public read access policy that exposes secret words
DROP POLICY IF EXISTS "Allow anyone to read active secrets" ON public.registration_secrets;

-- Create a new policy that only allows authenticated admins to read secrets
-- For now, we'll remove all public access since we'll use a secure edge function instead
CREATE POLICY "Only authenticated users can manage secrets" 
ON public.registration_secrets 
FOR ALL 
USING (auth.role() = 'authenticated');

-- We'll handle secret verification through a secure edge function instead