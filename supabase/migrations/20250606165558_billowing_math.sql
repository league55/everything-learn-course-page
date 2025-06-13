/*
  # Course Configuration Schema

  1. New Tables
    - `course_configuration`
      - `id` (uuid, primary key)
      - `topic` (text, the learning topic)
      - `context` (text, user's learning context)
      - `depth` (int, learning depth level 1-5)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `course_configuration` table
    - Add policy for users to create and read their own configurations
*/

CREATE TABLE IF NOT EXISTS course_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  context text NOT NULL,
  depth int NOT NULL CHECK (depth >= 1 AND depth <= 5),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE course_configuration ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create course configurations"
  ON course_configuration
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own course configurations"
  ON course_configuration
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_course_configuration_user_id ON course_configuration(user_id);
CREATE INDEX IF NOT EXISTS idx_course_configuration_created_at ON course_configuration(created_at DESC);