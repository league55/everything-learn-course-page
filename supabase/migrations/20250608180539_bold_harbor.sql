/*
  # Fix Course Discovery Policy

  1. Changes
    - Update the course_configuration RLS policy to allow reading all courses for discovery
    - Keep write operations restricted to course owners
    - Ensure users can still manage their own courses

  2. Security
    - Read access: Allow all users to discover courses created by the community
    - Write access: Only course owners can modify their courses
    - User privacy: No sensitive user data is exposed through course configurations
*/

-- Drop the existing restrictive read policy
DROP POLICY IF EXISTS "Users can read their own course configurations" ON course_configuration;
DROP POLICY IF EXISTS "All users can read course configurations for discovery" ON course_configuration;

-- Create a new policy that allows reading all course configurations for discovery
CREATE POLICY "All users can read course configurations for discovery"
  ON course_configuration
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Keep the existing policy for users to read their own courses (for management)
CREATE POLICY "Users can read their own course configurations"
  ON course_configuration
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure users can still create courses
-- (This policy should already exist, but let's make sure)
DROP POLICY IF EXISTS "Users can create course configurations" ON course_configuration;
CREATE POLICY "Users can create course configurations"
  ON course_configuration
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add policy for users to update their own courses
CREATE POLICY "Users can update their own course configurations"
  ON course_configuration
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add policy for users to delete their own courses
CREATE POLICY "Users can delete their own course configurations"
  ON course_configuration
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);