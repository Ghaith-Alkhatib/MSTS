/*
  # دعم عدة موظفين لإغلاق البلاغ

  1. جداول جديدة
    - `report_resolvers` - جدول لتتبع الموظفين الذين أغلقوا البلاغ
      - `id` (uuid, primary key)
      - `report_id` (uuid, FK to safety_reports)
      - `resolver_id` (uuid, FK to profiles)
      - `points_awarded` (integer) - النقاط الممنوحة
      - `created_at` (timestamp)

  2. الحقول المحذوفة من safety_reports
    - `resolved_by_id` سيتم استخدام جدول report_resolvers بدلاً منه

  3. Functions
    - `calculate_resolver_points()` - حساب نقاط الحلال
    - `get_report_resolvers()` - الحصول على قائمة الحلالين

  4. Security
    - RLS policies للمشرفين فقط
    - إتاحة الموظفين لقراءة معلومات من أغلق بلاغهم
*/

-- إنشاء جدول report_resolvers
CREATE TABLE IF NOT EXISTS report_resolvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES safety_reports(id) ON DELETE CASCADE,
  resolver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_awarded integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(report_id, resolver_id)
);

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_report_resolvers_report ON report_resolvers(report_id);
CREATE INDEX IF NOT EXISTS idx_report_resolvers_resolver ON report_resolvers(resolver_id);
CREATE INDEX IF NOT EXISTS idx_report_resolvers_created ON report_resolvers(created_at DESC);

-- تفعيل RLS
ALTER TABLE report_resolvers ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "المشرفون يمكنهم إدارة الحلالين"
  ON report_resolvers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "الموظفون يمكنهم قراءة من أغلق بلاغهم"
  ON report_resolvers FOR SELECT
  TO authenticated
  USING (
    resolver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM safety_reports
      WHERE safety_reports.id = report_resolvers.report_id
      AND safety_reports.employee_id = auth.uid()
    )
  );

-- دالة لحساب نقاط الحلال
CREATE OR REPLACE FUNCTION calculate_resolver_points(
  p_resolver_id uuid,
  p_report_creator_id uuid
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- إذا أغلق نفسه البلاغ: 1 نقطة، إذا أغلق بلاغ شخص آخر: 2 نقطة
  RETURN CASE WHEN p_resolver_id = p_report_creator_id THEN 1 ELSE 2 END;
END;
$$;