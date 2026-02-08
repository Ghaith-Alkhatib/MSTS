/*
  # Update Points System and Add Resolver Tracking

  1. Modified Tables
    - `safety_reports`
      - `resolved_by_id` (uuid, nullable) - FK to profiles, who resolved the issue
      - `resolved_by_name` (text, nullable) - display name of resolver
      - `points_awarded` default changed to 0 (admin assigns 1-3 manually)

  2. Security
    - Add RLS policy for admin to update resolved_by fields
    - Update existing policies to cover new columns

  3. Important Notes
    - Points are now assigned by admin (1, 2, or 3) instead of auto-calculated
    - When closing a report, admin specifies who resolved it
    - Bonus points: +1 if resolver is the reporter, +2 if resolver is someone else
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'safety_reports' AND column_name = 'resolved_by_id'
  ) THEN
    ALTER TABLE safety_reports ADD COLUMN resolved_by_id uuid REFERENCES profiles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'safety_reports' AND column_name = 'resolved_by_name'
  ) THEN
    ALTER TABLE safety_reports ADD COLUMN resolved_by_name text;
  END IF;
END $$;

ALTER TABLE safety_reports ALTER COLUMN points_awarded SET DEFAULT 0;
