/*
  # User Enrollments and Progress Tracking

  1. New Tables
    - `user_enrollments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `course_configuration_id` (uuid, foreign key to course_configuration)
      - `enrolled_at` (timestamp)
      - `current_module_index` (int, tracks progress through modules)
      - `completed_at` (timestamp, nullable)
      - `status` (text, enrollment status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_enrollments` table
    - Add policies for users to manage their own enrollments
    - Add policy for users to read public course configurations

  3. Indexes
    - Index on user_id for fast user enrollment queries
    - Index on course_configuration_id for course enrollment counts
    - Index on status for filtering active enrollments

  Note: Users can re-enroll in the same course multiple times.
  Progress is tracked at the module level to support future exam gating.
*/

CREATE TABLE IF NOT EXISTS user_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_configuration_id uuid NOT NULL REFERENCES course_configuration(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  current_module_index int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_enrollments ENABLE ROW LEVEL SECURITY;

-- Policies for user_enrollments
CREATE POLICY "Users can create their own enrollments"
  ON user_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own enrollments"
  ON user_enrollments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own enrollments"
  ON user_enrollments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for reading public course configurations (for course discovery)
CREATE POLICY "All users can read course configurations for discovery"
  ON course_configuration
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_enrollments_user_id ON user_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_enrollments_course_id ON user_enrollments(course_configuration_id);
CREATE INDEX IF NOT EXISTS idx_user_enrollments_status ON user_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_user_enrollments_enrolled_at ON user_enrollments(enrolled_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_user_enrollments_updated_at
  BEFORE UPDATE ON user_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();