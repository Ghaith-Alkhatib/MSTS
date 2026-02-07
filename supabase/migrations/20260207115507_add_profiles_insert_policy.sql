/*
  # إضافة سياسة INSERT لجدول profiles
  
  1. التغييرات
    - إضافة سياسة INSERT تسمح للمستخدمين المصادق عليهم بإنشاء ملفهم الشخصي
    - تتحقق السياسة من أن المستخدم يقوم بإنشاء ملف شخصي لنفسه فقط (id = auth.uid())
  
  2. الأمان
    - يمكن للمستخدم إنشاء ملف شخصي واحد فقط (لنفسه)
    - لا يمكن للمستخدم إنشاء ملفات شخصية لمستخدمين آخرين
*/

CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);