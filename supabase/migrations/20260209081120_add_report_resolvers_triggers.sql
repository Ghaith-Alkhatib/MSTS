/*
  # إضافة triggers لتحديث النقاط الشهرية عند إضافة/حذف حلال

  1. Triggers
    - trigger_update_points_on_resolver_insert - عند إضافة حلال
    - trigger_update_points_on_resolver_delete - عند حذف حلال

  2. يحدث النقاط الشهرية تلقائياً للموظف الذي أغلق البلاغ
*/

-- دالة trigger لتحديث النقاط عند إضافة حلال
CREATE OR REPLACE FUNCTION handle_resolver_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_year integer;
  report_month integer;
  report_creator_id uuid;
  resolver_bonus integer;
BEGIN
  -- الحصول على معلومات البلاغ
  SELECT sr.employee_id, EXTRACT(YEAR FROM sr.created_at), EXTRACT(MONTH FROM sr.created_at)
  INTO report_creator_id, report_year, report_month
  FROM safety_reports sr
  WHERE sr.id = NEW.report_id;

  -- حساب النقاط
  resolver_bonus := calculate_resolver_points(NEW.resolver_id, report_creator_id);
  NEW.points_awarded := resolver_bonus;

  -- تحديث النقاط الشهرية
  PERFORM upsert_monthly_points(
    NEW.resolver_id,
    report_year,
    report_month,
    0,
    resolver_bonus,
    0,
    1
  );

  RETURN NEW;
END;
$$;

-- دالة trigger لتحديث النقاط عند حذف حلال
CREATE OR REPLACE FUNCTION handle_resolver_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_year integer;
  report_month integer;
  report_creator_id uuid;
BEGIN
  -- الحصول على معلومات البلاغ
  SELECT sr.employee_id, EXTRACT(YEAR FROM sr.created_at), EXTRACT(MONTH FROM sr.created_at)
  INTO report_creator_id, report_year, report_month
  FROM safety_reports sr
  WHERE sr.id = OLD.report_id;

  -- إزالة النقاط الشهرية
  PERFORM upsert_monthly_points(
    OLD.resolver_id,
    report_year,
    report_month,
    0,
    -COALESCE(OLD.points_awarded, 0),
    0,
    -1
  );

  RETURN OLD;
END;
$$;

-- إنشاء triggers
DROP TRIGGER IF EXISTS trigger_resolver_insert ON report_resolvers;
CREATE TRIGGER trigger_resolver_insert
  BEFORE INSERT ON report_resolvers
  FOR EACH ROW
  EXECUTE FUNCTION handle_resolver_insert();

DROP TRIGGER IF EXISTS trigger_resolver_delete ON report_resolvers;
CREATE TRIGGER trigger_resolver_delete
  AFTER DELETE ON report_resolvers
  FOR EACH ROW
  EXECUTE FUNCTION handle_resolver_delete();