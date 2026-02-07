/*
  # Security and Performance Fixes

  1. Missing Foreign Key Indexes
    - Add index on `notifications.report_id`
    - Add index on `report_responses.admin_id`

  2. RLS Policy Optimization
    - Replace `auth.uid()` with `(select auth.uid())` in all policies
      to avoid re-evaluating per row (tables: safety_reports, report_images,
      report_responses, user_roles, profiles, response_images, notifications)

  3. Function Search Path Security
    - Set `search_path = ''` on all public functions to prevent
      search_path injection attacks

  4. Restrict user_roles INSERT Policy
    - Replace the always-true INSERT policy on user_roles with one
      that only allows users to insert their own user_id
*/

-- ============================================================
-- 1. Add missing foreign key indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_report_id
  ON public.notifications (report_id);

CREATE INDEX IF NOT EXISTS idx_report_responses_admin_id
  ON public.report_responses (admin_id);


-- ============================================================
-- 2. Recreate RLS policies with (select auth.uid())
-- ============================================================

-- --- safety_reports ---

DROP POLICY IF EXISTS "Employees can view own reports" ON public.safety_reports;
CREATE POLICY "Employees can view own reports"
  ON public.safety_reports FOR SELECT TO authenticated
  USING (employee_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can view all reports" ON public.safety_reports;
CREATE POLICY "Admins can view all reports"
  ON public.safety_reports FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Employees can create reports" ON public.safety_reports;
CREATE POLICY "Employees can create reports"
  ON public.safety_reports FOR INSERT TO authenticated
  WITH CHECK (employee_id = (select auth.uid()));

DROP POLICY IF EXISTS "Employees can update own pending reports" ON public.safety_reports;
CREATE POLICY "Employees can update own pending reports"
  ON public.safety_reports FOR UPDATE TO authenticated
  USING (employee_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (employee_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update all reports" ON public.safety_reports;
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


-- --- report_images ---

DROP POLICY IF EXISTS "Users can view images of their reports" ON public.report_images;
CREATE POLICY "Users can view images of their reports"
  ON public.report_images FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.safety_reports
    WHERE safety_reports.id = report_images.report_id
      AND safety_reports.employee_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Admins can view all images" ON public.report_images;
CREATE POLICY "Admins can view all images"
  ON public.report_images FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can insert images to own reports" ON public.report_images;
CREATE POLICY "Users can insert images to own reports"
  ON public.report_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.safety_reports
    WHERE safety_reports.id = report_images.report_id
      AND safety_reports.employee_id = (select auth.uid())
  ));


-- --- report_responses ---

DROP POLICY IF EXISTS "Employees can view responses to their reports" ON public.report_responses;
CREATE POLICY "Employees can view responses to their reports"
  ON public.report_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.safety_reports
    WHERE safety_reports.id = report_responses.report_id
      AND safety_reports.employee_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Admins can view all responses" ON public.report_responses;
CREATE POLICY "Admins can view all responses"
  ON public.report_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can create responses" ON public.report_responses;
CREATE POLICY "Admins can create responses"
  ON public.report_responses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));


-- --- user_roles ---

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Anyone can insert during signup" ON public.user_roles;
CREATE POLICY "Users can insert own role during signup"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);


-- --- profiles ---

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_admin((select auth.uid())));

DROP POLICY IF EXISTS "Anyone can create profile during signup" ON public.profiles;
CREATE POLICY "Anyone can create profile during signup"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);


-- --- response_images ---

DROP POLICY IF EXISTS "Admins can upload response images" ON public.response_images;
CREATE POLICY "Admins can upload response images"
  ON public.response_images FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.report_responses
    WHERE report_responses.id = response_images.response_id
      AND report_responses.admin_id = (select auth.uid())
  ));


-- --- notifications ---

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
CREATE POLICY "Admins can create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin((select auth.uid())));


-- ============================================================
-- 3. Fix mutable search_path on all public functions
-- ============================================================

ALTER FUNCTION public.notify_employee_on_status_change()
  SET search_path = '';

ALTER FUNCTION public.send_email_notification(text, text, text)
  SET search_path = '';

ALTER FUNCTION public.generate_report_number()
  SET search_path = '';

ALTER FUNCTION public.set_report_number()
  SET search_path = '';

ALTER FUNCTION public.update_updated_at()
  SET search_path = '';

ALTER FUNCTION public.handle_new_user()
  SET search_path = '';

ALTER FUNCTION public.increment(uuid, integer)
  SET search_path = '';

ALTER FUNCTION public.is_admin(uuid)
  SET search_path = '';

ALTER FUNCTION public.notify_admin_on_new_report()
  SET search_path = '';

ALTER FUNCTION public.notify_employee_email_on_status_change()
  SET search_path = '';

ALTER FUNCTION public.notify_employee_email_on_response()
  SET search_path = '';

ALTER FUNCTION public.notify_employee_on_response()
  SET search_path = '';