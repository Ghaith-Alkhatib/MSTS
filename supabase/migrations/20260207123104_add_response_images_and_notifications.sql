/*
  # إضافة جداول صور الردود والإشعارات

  1. جداول جديدة
    - `response_images`: لتخزين صور الردود
      - `id` (uuid, primary key)
      - `response_id` (uuid, foreign key)
      - `image_url` (text)
      - `created_at` (timestamptz)
    
    - `notifications`: لتخزين الإشعارات
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `title` (text)
      - `message` (text)
      - `type` (text) - report_update, response_added, status_changed
      - `report_id` (uuid, foreign key - optional)
      - `is_read` (boolean)
      - `created_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على الجداول
    - إضافة سياسات الوصول المناسبة

  3. Functions
    - دالة لإنشاء إشعار عند إضافة رد
    - دالة لإنشاء إشعار عند تغيير الحالة
*/

-- Create response_images table
CREATE TABLE IF NOT EXISTS response_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES report_responses(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE response_images ENABLE ROW LEVEL SECURITY;

-- Response images policies
CREATE POLICY "Authenticated users can view response images"
  ON response_images
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can upload response images"
  ON response_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM report_responses
      WHERE report_responses.id = response_id
      AND report_responses.admin_id = auth.uid()
    )
  );

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('report_update', 'response_added', 'status_changed')),
  report_id uuid REFERENCES safety_reports(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Function to create notification when response is added
CREATE OR REPLACE FUNCTION notify_employee_on_response()
RETURNS TRIGGER AS $$
DECLARE
  report_employee_id uuid;
  report_number text;
BEGIN
  SELECT employee_id, report_number INTO report_employee_id, report_number
  FROM safety_reports
  WHERE id = NEW.report_id;

  INSERT INTO notifications (user_id, title, message, type, report_id)
  VALUES (
    report_employee_id,
    'رد جديد على بلاغك',
    'تم إضافة رد على البلاغ رقم ' || report_number,
    'response_added',
    NEW.report_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for response notifications
DROP TRIGGER IF EXISTS on_response_added ON report_responses;
CREATE TRIGGER on_response_added
  AFTER INSERT ON report_responses
  FOR EACH ROW
  EXECUTE FUNCTION notify_employee_on_response();

-- Function to create notification when status changes
CREATE OR REPLACE FUNCTION notify_employee_on_status_change()
RETURNS TRIGGER AS $$
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

    INSERT INTO notifications (user_id, title, message, type, report_id)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for status change notifications
DROP TRIGGER IF EXISTS on_status_changed ON safety_reports;
CREATE TRIGGER on_status_changed
  AFTER UPDATE ON safety_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_employee_on_status_change();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_response_images_response_id ON response_images(response_id);