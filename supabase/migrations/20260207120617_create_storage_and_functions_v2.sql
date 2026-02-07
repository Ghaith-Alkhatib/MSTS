/*
  # إنشاء Storage Bucket و Functions

  1. Storage
    - إنشاء bucket للصور (safety-images)
    - تفعيل الوصول العام للصور
    - إضافة سياسات للرفع والعرض

  2. Functions
    - دالة increment لزيادة النقاط
    - دالة لتوليد أرقام البلاغات
*/

-- Create storage bucket for safety images
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-images', 'safety-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Storage policies for authenticated users to upload
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'safety-images');

-- Allow public read access to images
CREATE POLICY "Public can view images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'safety-images');

-- Allow users to update their own images
CREATE POLICY "Users can update own images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'safety-images');

-- Create increment function for points
CREATE OR REPLACE FUNCTION increment(row_id uuid, x integer)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET points = COALESCE(points, 0) + x
  WHERE id = row_id;
END;
$$;

-- Create function to generate report numbers
CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_number text;
BEGIN
  new_number := 'HSE-' || LPAD(nextval('report_number_seq')::text, 6, '0');
  RETURN new_number;
END;
$$;

-- Create sequence for report numbers if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'report_number_seq') THEN
    CREATE SEQUENCE report_number_seq START 1000;
  END IF;
END $$;