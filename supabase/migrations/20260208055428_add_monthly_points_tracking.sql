/*
  # إضافة نظام تتبع النقاط الشهرية

  1. جداول جديدة
    - `monthly_employee_points`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, FK to profiles)
      - `year` (integer) - السنة
      - `month` (integer) - الشهر (1-12)
      - `reporter_points` (integer) - نقاط من البلاغات المنشأة
      - `resolver_points` (integer) - نقاط إضافية من حل البلاغات
      - `total_points` (integer) - مجموع النقاط
      - `report_count` (integer) - عدد البلاغات المنشأة
      - `resolved_count` (integer) - عدد البلاغات المحلولة
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
  2. Indexes
    - فهرس فريد على (employee_id, year, month)
    - فهرس على year, month للبحث السريع
  
  3. Functions
    - `update_monthly_points()` - دالة لتحديث النقاط الشهرية عند تغيير البلاغ
  
  4. Triggers
    - تحديث تلقائي عند إضافة أو تعديل بلاغ
  
  5. Security
    - RLS policies للسماح للموظفين بقراءة نقاطهم
    - السماح للمشرفين بقراءة جميع النقاط
*/

-- إنشاء جدول النقاط الشهرية
CREATE TABLE IF NOT EXISTS monthly_employee_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  reporter_points integer DEFAULT 0,
  resolver_points integer DEFAULT 0,
  total_points integer GENERATED ALWAYS AS (reporter_points + resolver_points) STORED,
  report_count integer DEFAULT 0,
  resolved_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, year, month)
);

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_monthly_points_employee ON monthly_employee_points(employee_id);
CREATE INDEX IF NOT EXISTS idx_monthly_points_period ON monthly_employee_points(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_points_total ON monthly_employee_points(total_points DESC);

-- تفعيل RLS
ALTER TABLE monthly_employee_points ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "الموظفون يمكنهم قراءة نقاطهم"
  ON monthly_employee_points FOR SELECT
  TO authenticated
  USING (auth.uid() = employee_id);

CREATE POLICY "المشرفون يمكنهم قراءة جميع النقاط"
  ON monthly_employee_points FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- دالة لتحديث أو إنشاء سجل النقاط الشهرية
CREATE OR REPLACE FUNCTION upsert_monthly_points(
  p_employee_id uuid,
  p_year integer,
  p_month integer,
  p_reporter_points_delta integer DEFAULT 0,
  p_resolver_points_delta integer DEFAULT 0,
  p_report_count_delta integer DEFAULT 0,
  p_resolved_count_delta integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO monthly_employee_points (
    employee_id, year, month, 
    reporter_points, resolver_points,
    report_count, resolved_count
  )
  VALUES (
    p_employee_id, p_year, p_month,
    GREATEST(0, p_reporter_points_delta),
    GREATEST(0, p_resolver_points_delta),
    GREATEST(0, p_report_count_delta),
    GREATEST(0, p_resolved_count_delta)
  )
  ON CONFLICT (employee_id, year, month)
  DO UPDATE SET
    reporter_points = GREATEST(0, monthly_employee_points.reporter_points + p_reporter_points_delta),
    resolver_points = GREATEST(0, monthly_employee_points.resolver_points + p_resolver_points_delta),
    report_count = GREATEST(0, monthly_employee_points.report_count + p_report_count_delta),
    resolved_count = GREATEST(0, monthly_employee_points.resolved_count + p_resolved_count_delta),
    updated_at = now();
END;
$$;

-- دالة trigger لتحديث النقاط الشهرية عند تغيير البلاغ
CREATE OR REPLACE FUNCTION update_monthly_points_on_report_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_year integer;
  report_month integer;
  old_resolver_id uuid;
  new_resolver_id uuid;
  resolver_bonus integer;
BEGIN
  -- عند إضافة بلاغ جديد
  IF TG_OP = 'INSERT' THEN
    report_year := EXTRACT(YEAR FROM NEW.created_at);
    report_month := EXTRACT(MONTH FROM NEW.created_at);
    
    -- إضافة نقاط المبلغ
    PERFORM upsert_monthly_points(
      NEW.employee_id,
      report_year,
      report_month,
      COALESCE(NEW.points_awarded, 0), -- reporter_points
      0, -- resolver_points
      1, -- report_count
      0  -- resolved_count
    );
    
    RETURN NEW;
  END IF;
  
  -- عند تحديث بلاغ
  IF TG_OP = 'UPDATE' THEN
    report_year := EXTRACT(YEAR FROM NEW.created_at);
    report_month := EXTRACT(MONTH FROM NEW.created_at);
    
    -- تحديث نقاط المبلغ إذا تغيرت النقاط
    IF COALESCE(OLD.points_awarded, 0) != COALESCE(NEW.points_awarded, 0) THEN
      PERFORM upsert_monthly_points(
        NEW.employee_id,
        report_year,
        report_month,
        COALESCE(NEW.points_awarded, 0) - COALESCE(OLD.points_awarded, 0), -- الفرق في النقاط
        0,
        0,
        0
      );
    END IF;
    
    -- التعامل مع تغيير حالة الحل
    old_resolver_id := OLD.resolved_by_id;
    new_resolver_id := NEW.resolved_by_id;
    
    -- إذا تم تعيين حلال جديد
    IF new_resolver_id IS NOT NULL AND (old_resolver_id IS NULL OR old_resolver_id != new_resolver_id) THEN
      -- حساب النقاط الإضافية
      IF new_resolver_id = NEW.employee_id THEN
        resolver_bonus := 1; -- حل البلاغ بنفسه
      ELSE
        resolver_bonus := 2; -- حل بلاغ شخص آخر
      END IF;
      
      -- إضافة نقاط الحلال
      PERFORM upsert_monthly_points(
        new_resolver_id,
        report_year,
        report_month,
        0,
        resolver_bonus,
        0,
        1 -- resolved_count
      );
      
      -- إزالة نقاط الحلال القديم إن وجد
      IF old_resolver_id IS NOT NULL THEN
        IF old_resolver_id = OLD.employee_id THEN
          resolver_bonus := 1;
        ELSE
          resolver_bonus := 2;
        END IF;
        
        PERFORM upsert_monthly_points(
          old_resolver_id,
          report_year,
          report_month,
          0,
          -resolver_bonus,
          0,
          -1
        );
      END IF;
    END IF;
    
    -- إذا تمت إزالة الحلال
    IF old_resolver_id IS NOT NULL AND new_resolver_id IS NULL THEN
      IF old_resolver_id = OLD.employee_id THEN
        resolver_bonus := 1;
      ELSE
        resolver_bonus := 2;
      END IF;
      
      PERFORM upsert_monthly_points(
        old_resolver_id,
        report_year,
        report_month,
        0,
        -resolver_bonus,
        0,
        -1
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- عند حذف بلاغ
  IF TG_OP = 'DELETE' THEN
    report_year := EXTRACT(YEAR FROM OLD.created_at);
    report_month := EXTRACT(MONTH FROM OLD.created_at);
    
    -- إزالة نقاط المبلغ
    PERFORM upsert_monthly_points(
      OLD.employee_id,
      report_year,
      report_month,
      -COALESCE(OLD.points_awarded, 0),
      0,
      -1,
      0
    );
    
    -- إزالة نقاط الحلال إن وجد
    IF OLD.resolved_by_id IS NOT NULL THEN
      IF OLD.resolved_by_id = OLD.employee_id THEN
        resolver_bonus := 1;
      ELSE
        resolver_bonus := 2;
      END IF;
      
      PERFORM upsert_monthly_points(
        OLD.resolved_by_id,
        report_year,
        report_month,
        0,
        -resolver_bonus,
        0,
        -1
      );
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- إنشاء trigger
DROP TRIGGER IF EXISTS trigger_update_monthly_points ON safety_reports;
CREATE TRIGGER trigger_update_monthly_points
  AFTER INSERT OR UPDATE OR DELETE ON safety_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_points_on_report_change();

-- ملء البيانات التاريخية من البلاغات الموجودة
DO $$
DECLARE
  report_record RECORD;
  report_year integer;
  report_month integer;
  resolver_bonus integer;
BEGIN
  -- حذف البيانات القديمة لإعادة البناء
  TRUNCATE monthly_employee_points;
  
  -- المرور على كل البلاغات وحساب النقاط
  FOR report_record IN 
    SELECT * FROM safety_reports ORDER BY created_at
  LOOP
    report_year := EXTRACT(YEAR FROM report_record.created_at);
    report_month := EXTRACT(MONTH FROM report_record.created_at);
    
    -- إضافة نقاط المبلغ
    PERFORM upsert_monthly_points(
      report_record.employee_id,
      report_year,
      report_month,
      COALESCE(report_record.points_awarded, 0),
      0,
      1,
      0
    );
    
    -- إضافة نقاط الحلال إن وجد
    IF report_record.resolved_by_id IS NOT NULL THEN
      IF report_record.resolved_by_id = report_record.employee_id THEN
        resolver_bonus := 1;
      ELSE
        resolver_bonus := 2;
      END IF;
      
      PERFORM upsert_monthly_points(
        report_record.resolved_by_id,
        report_year,
        report_month,
        0,
        resolver_bonus,
        0,
        1
      );
    END IF;
  END LOOP;
END;
$$;