/*
  # إصلاح قيم حالة البلاغ وتحديث الهيكل

  1. Changes to safety_reports
    - تصحيح قيم status المسموح بها من (pending, in_review, action_taken, closed) 
      إلى (pending, in_progress, closed)
    - تحديث القيم الحالية في الجدول

  2. Security
    - الحفاظ على جميع سياسات RLS الموجودة
*/

-- إزالة constraint القديم
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'safety_reports' AND constraint_name LIKE '%status%check%'
  ) THEN
    ALTER TABLE safety_reports DROP CONSTRAINT IF EXISTS safety_reports_status_check;
  END IF;
END $$;

-- تحديث القيم الموجودة لتتوافق مع النظام الجديد
UPDATE safety_reports 
SET status = 'in_progress' 
WHERE status = 'in_review' OR status = 'action_taken';

-- إضافة constraint جديد بالقيم الصحيحة
ALTER TABLE safety_reports 
ADD CONSTRAINT safety_reports_status_check 
CHECK (status IN ('pending', 'in_progress', 'closed'));
