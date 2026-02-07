/*
  # Full Database Schema Setup for MSTS Safety Reporting System

  1. New Tables
    - `profiles` - User profiles (id, email, full_name, role, department, points)
    - `user_roles` - Role assignments (user_id, role)
    - `safety_reports` - Safety reports (report_number, employee_id, report_type, description, location, status, points_awarded, synced)
    - `report_images` - Images attached to reports (report_id, image_url)
    - `report_responses` - Admin responses to reports (report_id, admin_id, response_text, corrective_action)
    - `response_images` - Images attached to responses (response_id, image_url)
    - `notifications` - In-app notifications (user_id, title, message, type, report_id, is_read)

  2. Sequences
    - `report_number_seq` - Auto-generates HSE report numbers

  3. Functions
    - `is_admin` - Checks if user has admin role
    - `handle_new_user` - Auto-creates user_roles entry on signup
    - `increment` - Adds points to a profile
    - `generate_report_number` / `set_report_number` - Auto-generates report numbers
    - `update_updated_at` - Auto-updates timestamps
    - `notify_employee_on_status_change` - In-app notification on status change
    - `notify_employee_on_response` - In-app notification on new response
    - `notify_admins_inapp_on_new_report` - In-app notification for admins on new report

  4. Triggers
    - Auto report number on insert
    - Auto updated_at on update
    - Notification triggers for status changes, responses, and new reports

  5. Security
    - RLS enabled on ALL tables
    - Restrictive policies: employees see own data, admins see all
    - SECURITY DEFINER functions for cross-table operations

  6. Storage
    - `safety-images` public bucket for report photos

  7. Indexes
    - Foreign key indexes for performance
    - Notification lookup indexes
*/

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- 1. Profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  department text,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. User Roles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Safety Reports table
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.report_number_seq START WITH 1000;

CREATE TABLE IF NOT EXISTS public.safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('unsafe_act', 'unsafe_condition', 'near_miss', 'observation')),
  description text NOT NULL,
  location text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'action_taken', 'closed')),
  points_awarded integer NOT NULL DEFAULT 0,
  synced boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_safety_reports_employee_id ON public.safety_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON public.safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_created_at ON public.safety_reports(created_at);

-- ============================================================
-- 4. Report Images table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.report_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.safety_reports(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_report_images_report_id ON public.report_images(report_id);

-- ============================================================
-- 5. Report Responses table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.report_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.safety_reports(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_text text NOT NULL,
  corrective_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_report_responses_report_id ON public.report_responses(report_id);
CREATE INDEX IF NOT EXISTS idx_report_responses_admin_id ON public.report_responses(admin_id);

-- ============================================================
-- 6. Response Images table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.response_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.report_responses(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.response_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_response_images_response_id ON public.response_images(response_id);

-- ============================================================
-- 7. Notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('report_update', 'response_added', 'status_changed')),
  report_id uuid REFERENCES public.safety_reports(id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_report_id ON public.notifications(report_id);

-- ============================================================
-- Helper function: is_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = check_user_id
    AND user_roles.role = 'admin'
  );
END;
$$;

-- ============================================================
-- RLS Policies: profiles
-- ============================================================
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin((select auth.uid())));

CREATE POLICY "Anyone can create profile during signup"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================================
-- RLS Policies: user_roles
-- ============================================================
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own role during signup"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================
-- RLS Policies: safety_reports
-- ============================================================
CREATE POLICY "Employees can view own reports"
  ON public.safety_reports FOR SELECT TO authenticated
  USING (employee_id = (select auth.uid()));

CREATE POLICY "Admins can view all reports"
  ON public.safety_reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

CREATE POLICY "Employees can create reports"
  ON public.safety_reports FOR INSERT TO authenticated
  WITH CHECK (employee_id = (select auth.uid()));

CREATE POLICY "Employees can update own pending reports"
  ON public.safety_reports FOR UPDATE TO authenticated
  USING (employee_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (employee_id = (select auth.uid()));

CREATE POLICY "Admins can update all reports"
  ON public.safety_reports FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

-- ============================================================
-- RLS Policies: report_images
-- ============================================================
CREATE POLICY "Users can view images of their reports"
  ON public.report_images FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.safety_reports
    WHERE safety_reports.id = report_images.report_id
      AND safety_reports.employee_id = (select auth.uid())
  ));

CREATE POLICY "Admins can view all images"
  ON public.report_images FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can insert images to own reports"
  ON public.report_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.safety_reports
    WHERE safety_reports.id = report_images.report_id
      AND safety_reports.employee_id = (select auth.uid())
  ));

-- ============================================================
-- RLS Policies: report_responses
-- ============================================================
CREATE POLICY "Employees can view responses to their reports"
  ON public.report_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.safety_reports
    WHERE safety_reports.id = report_responses.report_id
      AND safety_reports.employee_id = (select auth.uid())
  ));

CREATE POLICY "Admins can view all responses"
  ON public.report_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can create responses"
  ON public.report_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

-- ============================================================
-- RLS Policies: response_images
-- ============================================================
CREATE POLICY "Authenticated users can view response images"
  ON public.response_images FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.report_responses rr
    JOIN public.safety_reports sr ON sr.id = rr.report_id
    WHERE rr.id = response_images.response_id
      AND (rr.admin_id = (select auth.uid()) OR sr.employee_id = (select auth.uid()))
  ));

CREATE POLICY "Admins can upload response images"
  ON public.response_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.report_responses
    WHERE report_responses.id = response_images.response_id
      AND report_responses.admin_id = (select auth.uid())
  ));

-- ============================================================
-- RLS Policies: notifications
-- ============================================================
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((select auth.uid())));

-- ============================================================
-- Function: handle_new_user
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_role text;
BEGIN
  IF NEW.email = 'admin@msts.jo' THEN
    user_role := 'admin';
  ELSE
    user_role := 'employee';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    user_role
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Function: increment points
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment(row_id uuid, x integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET points = COALESCE(points, 0) + x
  WHERE id = row_id;
END;
$$;

-- ============================================================
-- Function: generate_report_number / set_report_number
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_report_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_number text;
BEGIN
  new_number := 'HSE-' || LPAD(nextval('public.report_number_seq')::text, 6, '0');
  RETURN new_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_report_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.report_number IS NULL OR NEW.report_number = '' THEN
    NEW.report_number := public.generate_report_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_report_number_trigger ON public.safety_reports;
CREATE TRIGGER set_report_number_trigger
  BEFORE INSERT ON public.safety_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_report_number();

-- ============================================================
-- Function: update_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_safety_reports_updated_at ON public.safety_reports;
CREATE TRIGGER update_safety_reports_updated_at
  BEFORE UPDATE ON public.safety_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Notification Functions & Triggers
-- ============================================================

-- In-app: notify employee on status change
CREATE OR REPLACE FUNCTION public.notify_employee_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  status_text text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'pending' THEN status_text := 'قيد الانتظار';
      WHEN 'in_review' THEN status_text := 'قيد المراجعة';
      WHEN 'action_taken' THEN status_text := 'تم اتخاذ إجراء';
      WHEN 'closed' THEN status_text := 'مغلق';
      ELSE status_text := NEW.status;
    END CASE;

    INSERT INTO public.notifications (user_id, title, message, type, report_id)
    VALUES (
      NEW.employee_id,
      'تحديث حالة البلاغ',
      'تم تحديث حالة البلاغ رقم ' || COALESCE(NEW.report_number, '') || ' إلى: ' || status_text,
      'status_changed',
      NEW.id
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_employee_on_status_change failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_status_changed ON public.safety_reports;
CREATE TRIGGER on_status_changed
  AFTER UPDATE ON public.safety_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employee_on_status_change();

-- In-app: notify employee on response
CREATE OR REPLACE FUNCTION public.notify_employee_on_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_employee_id uuid;
  v_report_number text;
BEGIN
  SELECT sr.employee_id, sr.report_number
  INTO v_employee_id, v_report_number
  FROM public.safety_reports sr
  WHERE sr.id = NEW.report_id;

  INSERT INTO public.notifications (user_id, title, message, type, report_id)
  VALUES (
    v_employee_id,
    'رد جديد على بلاغك',
    'تم إضافة رد على البلاغ رقم ' || COALESCE(v_report_number, ''),
    'response_added',
    NEW.report_id
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_employee_on_response failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_response_added ON public.report_responses;
CREATE TRIGGER on_response_added
  AFTER INSERT ON public.report_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_employee_on_response();

-- In-app: notify ALL admins on new report
CREATE OR REPLACE FUNCTION public.notify_admins_inapp_on_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin RECORD;
  v_employee_name text;
  v_report_type_text text;
BEGIN
  SELECT full_name INTO v_employee_name
  FROM public.profiles
  WHERE id = NEW.employee_id;

  CASE NEW.report_type
    WHEN 'unsafe_act' THEN v_report_type_text := 'سلوك غير آمن';
    WHEN 'unsafe_condition' THEN v_report_type_text := 'وضع غير آمن';
    WHEN 'near_miss' THEN v_report_type_text := 'حادث كاد أن يقع';
    WHEN 'observation' THEN v_report_type_text := 'ملاحظة عامة';
    ELSE v_report_type_text := NEW.report_type;
  END CASE;

  FOR v_admin IN
    SELECT p.id
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, report_id)
    VALUES (
      v_admin.id,
      'بلاغ سلامة جديد',
      'بلاغ جديد رقم ' || COALESCE(NEW.report_number, '') || ' من ' || COALESCE(v_employee_name, 'موظف') || ' - ' || v_report_type_text,
      'report_update',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_admins_inapp_on_new_report failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_report_inapp_notify ON public.safety_reports;
CREATE TRIGGER on_new_report_inapp_notify
  AFTER INSERT ON public.safety_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_inapp_on_new_report();

-- ============================================================
-- Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-images', 'safety-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'safety-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public can view images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'safety-images');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'safety-images');
  END IF;
END $$;