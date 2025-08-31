-- Assign admin role to the current authenticated user
INSERT INTO public.user_roles (user_id, role)
SELECT 'f150ac34-ebee-4e70-a91c-ad1b7c05546e'::uuid, 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = 'f150ac34-ebee-4e70-a91c-ad1b7c05546e'::uuid 
  AND role = 'admin'::app_role
);