/*
  # Auto-assign admin role to admin@msts.jo

  1. Changes
    - Update the handle_new_user function to check if email is admin@msts.jo
    - If yes, assign 'admin' role instead of 'employee'
*/

-- Update function to automatically assign admin role to admin@msts.jo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
BEGIN
  -- Check if the user email is admin@msts.jo
  IF NEW.email = 'admin@msts.jo' THEN
    user_role := 'admin';
  ELSE
    user_role := 'employee';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;