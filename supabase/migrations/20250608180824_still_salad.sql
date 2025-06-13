/*
  # Fix RLS policies for community course discovery

  1. Policy Updates
    - Update syllabus table to allow public read access for all courses
    - Update syllabus_generation_jobs table to allow public read access for all courses
    - This enables the getAllCourses() function to return all community courses with their syllabus data

  2. Security
    - Maintain write restrictions - only course owners can modify their syllabi and jobs
    - Allow public read access for course discovery while preserving data integrity
    - Keep existing policies for course owners to manage their own content

  3. Changes
    - Drop restrictive SELECT policies on syllabus and syllabus_generation_jobs
    - Add new public SELECT policies for course discovery
    - Maintain existing INSERT/UPDATE/DELETE policies for security
*/

-- Update syllabus table policies
DROP POLICY IF EXISTS "Users can read syllabi for their course configurations" ON syllabus;

CREATE POLICY "All users can read syllabi for public courses"
  ON syllabus
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Update syllabus_generation_jobs table policies  
DROP POLICY IF EXISTS "Users can read generation jobs for their courses" ON syllabus_generation_jobs;

CREATE POLICY "All users can read generation jobs for public courses"
  ON syllabus_generation_jobs
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Ensure the existing management policies remain intact
-- (These should already exist, but let's verify they're correct)

-- Syllabus management policies
CREATE POLICY "Users can manage syllabi for their courses"
  ON syllabus
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

-- Syllabus generation jobs management policies
CREATE POLICY "Users can manage generation jobs for their courses"
  ON syllabus_generation_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );