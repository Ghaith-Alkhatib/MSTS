/*
  # Enable pg_net and fix email notification system

  1. Extensions
    - Enable `pg_net` for async HTTP requests from database

  2. Rewritten Functions (fully qualified schema names for search_path='')
    - `send_email_notification` - uses pg_net with proper headers
    - `generate_report_number` - qualified sequence reference
    - `set_report_number` - qualified function call
    - `increment` - qualified table reference
    - `handle_new_user` - qualified table reference
    - `is_admin` - qualified table reference
    - `notify_admin_on_new_report` - qualified all references
    - `notify_employee_email_on_status_change` - qualified all references
    - `notify_employee_email_on_response` - qualified all references
    - `notify_employee_on_response` - qualified all references
    - `notify_employee_on_status_change` - qualified all references

  3. Notes
    - All functions use SECURITY DEFINER and search_path = ''
    - Email triggers call Edge Function via pg_net HTTP
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ==========================================================
-- Core email sending function
-- ==========================================================

CREATE OR REPLACE FUNCTION public.send_email_notification(
  recipient_email text,
  email_subject text,
  email_html text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_url text := 'https://povmxlxclqzukscpmjio.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvdm14bHhjbHF6dWtzY3BtamlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NTI5MzIsImV4cCI6MjA4NjAyODkzMn0.mu5NtBcYpMdYo2G5WWAhVJBFvTjMsUOXwhSI6j9p5tc';
BEGIN
  PERFORM net.http_post(
    url := base_url || '/functions/v1/send-email-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'to', recipient_email,
      'subject', email_subject,
      'html', email_html
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send email: %', SQLERRM;
END;
$$;

-- ==========================================================
-- generate_report_number
-- ==========================================================

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

-- ==========================================================
-- set_report_number
-- ==========================================================

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

-- ==========================================================
-- update_updated_at
-- ==========================================================

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

-- ==========================================================
-- increment
-- ==========================================================

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

-- ==========================================================
-- handle_new_user
-- ==========================================================

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

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  RETURN NEW;
END;
$$;

-- ==========================================================
-- is_admin
-- ==========================================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = is_admin.user_id
    AND user_roles.role = 'admin'
  );
END;
$$;

-- ==========================================================
-- notify_employee_on_status_change (in-app notification)
-- ==========================================================

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
      'تم تحديث حالة البلاغ رقم ' || NEW.report_number || ' إلى: ' || status_text,
      'status_changed',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================
-- notify_employee_on_response (in-app notification)
-- ==========================================================

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

-- ==========================================================
-- notify_admin_on_new_report (email trigger)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_emails text[];
  admin_email text;
  employee_name text;
  report_type_text text;
BEGIN
  SELECT full_name INTO employee_name
  FROM public.profiles
  WHERE id = NEW.employee_id;

  CASE NEW.report_type
    WHEN 'unsafe_act' THEN report_type_text := 'سلوك غير آمن';
    WHEN 'unsafe_condition' THEN report_type_text := 'وضع غير آمن';
    WHEN 'near_miss' THEN report_type_text := 'حادث كاد أن يقع';
    WHEN 'observation' THEN report_type_text := 'ملاحظة عامة';
    ELSE report_type_text := NEW.report_type;
  END CASE;

  SELECT array_agg(p.email) INTO admin_emails
  FROM public.profiles p
  WHERE p.role = 'admin';

  IF admin_emails IS NOT NULL THEN
    FOREACH admin_email IN ARRAY admin_emails
    LOOP
      BEGIN
        PERFORM public.send_email_notification(
          admin_email,
          'بلاغ سلامة جديد - ' || NEW.report_number,
          '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">بلاغ سلامة جديد</h2>
            <p>تم استلام بلاغ سلامة جديد:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>رقم البلاغ:</strong> ' || NEW.report_number || '</p>
              <p><strong>النوع:</strong> ' || report_type_text || '</p>
              <p><strong>المُبلِّغ:</strong> ' || employee_name || '</p>
              <p><strong>الوصف:</strong> ' || NEW.description || '</p>
              ' || CASE WHEN NEW.location IS NOT NULL THEN '<p><strong>الموقع:</strong> ' || NEW.location || '</p>' ELSE '' END || '
            </div>
            <p>يرجى مراجعة البلاغ واتخاذ الإجراء المناسب.</p>
            <a href="https://msts-safety.app" style="display: inline-block; background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
              عرض البلاغ
            </a>
          </div>'
        );
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to send email to admin %: %', admin_email, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================
-- notify_employee_email_on_status_change (email trigger)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.notify_employee_email_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  employee_email text;
  employee_name text;
  status_text text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT email, full_name INTO employee_email, employee_name
    FROM public.profiles
    WHERE id = NEW.employee_id;

    CASE NEW.status
      WHEN 'pending' THEN status_text := 'قيد الانتظار';
      WHEN 'in_review' THEN status_text := 'قيد المراجعة';
      WHEN 'action_taken' THEN status_text := 'تم اتخاذ إجراء';
      WHEN 'closed' THEN status_text := 'مغلق';
      ELSE status_text := NEW.status;
    END CASE;

    BEGIN
      PERFORM public.send_email_notification(
        employee_email,
        'تحديث حالة البلاغ - ' || NEW.report_number,
        '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">تحديث حالة البلاغ</h2>
          <p>مرحباً ' || employee_name || ',</p>
          <p>تم تحديث حالة بلاغك رقم <strong>' || NEW.report_number || '</strong></p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>الحالة الجديدة:</strong> <span style="color: #1e40af; font-size: 18px;">' || status_text || '</span></p>
          </div>
          <p>يمكنك متابعة البلاغ من خلال النظام.</p>
          <a href="https://msts-safety.app" style="display: inline-block; background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
            عرض البلاغ
          </a>
        </div>'
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send email to employee %: %', employee_email, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================================
-- notify_employee_email_on_response (email trigger)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.notify_employee_email_on_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  employee_email text;
  employee_name text;
  admin_name text;
  v_report_number text;
BEGIN
  SELECT p.email, p.full_name, sr.report_number
  INTO employee_email, employee_name, v_report_number
  FROM public.safety_reports sr
  JOIN public.profiles p ON sr.employee_id = p.id
  WHERE sr.id = NEW.report_id;

  SELECT full_name INTO admin_name
  FROM public.profiles
  WHERE id = NEW.admin_id;

  BEGIN
    PERFORM public.send_email_notification(
      employee_email,
      'رد جديد على بلاغك - ' || v_report_number,
      '<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">رد جديد على بلاغك</h2>
        <p>مرحباً ' || employee_name || ',</p>
        <p>تم إضافة رد على بلاغك رقم <strong>' || v_report_number || '</strong></p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>من:</strong> ' || admin_name || '</p>
          <p><strong>الرد:</strong></p>
          <p style="padding: 10px; background-color: white; border-radius: 5px;">' || NEW.response_text || '</p>
          ' || CASE WHEN NEW.corrective_action IS NOT NULL THEN
            '<p style="margin-top: 10px;"><strong>الإجراء التصحيحي:</strong></p>
            <p style="padding: 10px; background-color: white; border-radius: 5px;">' || NEW.corrective_action || '</p>'
          ELSE '' END || '
        </div>
        <a href="https://msts-safety.app" style="display: inline-block; background-color: #1e40af; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px;">
          عرض البلاغ
        </a>
      </div>'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send email to employee %: %', employee_email, SQLERRM;
  END;

  RETURN NEW;
END;
$$;