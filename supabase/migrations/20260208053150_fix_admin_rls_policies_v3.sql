/*
  # Fix Admin RLS Policies - Complete Fix

  1. Changes
    - Drop old is_admin() function with CASCADE
    - Create new is_admin() function that checks profiles.role
    - Recreate dependent policies with correct syntax
    
  2. Security
    - Maintains proper RLS for all tables
    - Admins identified by profiles.role = 'admin'
*/

-- Drop the old is_admin function with CASCADE
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;

-- Create new is_admin function that checks profiles.role
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = check_user_id
    AND profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the profiles admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Recreate the notifications system policy
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);
