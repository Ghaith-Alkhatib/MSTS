/*
  # Add in-app notifications for admins on new report creation

  1. New Function
    - `notify_admins_inapp_on_new_report()` - creates a notification row
      for every admin user when a new safety report is inserted

  2. New Trigger
    - `on_new_report_inapp_notify` on `safety_reports` AFTER INSERT
      fires the new function

  3. Notes
    - Uses SECURITY DEFINER to bypass RLS for inserting notifications
    - Fully schema-qualified references (search_path = '')
    - Uses 'report_update' type which is already allowed by the CHECK constraint
    - Exception handler prevents trigger errors from blocking report creation
*/

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