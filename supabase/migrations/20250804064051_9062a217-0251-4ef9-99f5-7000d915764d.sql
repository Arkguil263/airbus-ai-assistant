-- Drop the current RLS policy that requires authentication
DROP POLICY IF EXISTS "Allow authenticated users to read active secrets" ON public.registration_secrets;

-- Create a new RLS policy that allows anyone to read active secrets
CREATE POLICY "Allow anyone to read active secrets" 
ON public.registration_secrets 
FOR SELECT 
USING (is_active = true);