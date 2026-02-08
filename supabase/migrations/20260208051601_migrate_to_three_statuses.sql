/*
  # Migrate to 3-Status System

  1. Changes
    - Report statuses simplified to: pending, in_progress, closed
    - Migrate existing 'in_review' records to 'in_progress'
    - Migrate existing 'action_taken' records to 'in_progress'

  2. Important Notes
    - No data loss - existing reports are preserved
    - Status values updated in-place
*/

UPDATE safety_reports SET status = 'in_progress' WHERE status = 'in_review';
UPDATE safety_reports SET status = 'in_progress' WHERE status = 'action_taken';
