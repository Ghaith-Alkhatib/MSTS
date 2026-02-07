/*
  # Fix notify_employee_on_response trigger variable shadowing

  1. Problem
    - The `report_number` PL/pgSQL variable shadows the `report_number` column
      in the SELECT query, causing a NULL value
    - NULL concatenation produces NULL for the notification message
    - This violates the NOT NULL constraint on `notifications.message`,
      causing the entire report_responses INSERT to fail

  2. Fix
    - Rename the local variables to avoid column name conflicts
    - Add EXCEPTION handler so trigger errors don't break the main insert
*/

CREATE OR REPLACE FUNCTION notify_employee_on_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id uuid;
  v_report_number text;
BEGIN
  SELECT sr.employee_id, sr.report_number
  INTO v_employee_id, v_report_number
  FROM safety_reports sr
  WHERE sr.id = NEW.report_id;

  INSERT INTO notifications (user_id, title, message, type, report_id)
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