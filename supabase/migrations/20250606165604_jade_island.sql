/*
  # Syllabus Schema

  1. New Tables
    - `syllabus`
      - `id` (uuid, primary key)
      - `course_configuration_id` (uuid, foreign key to course_configuration)
      - `modules` (jsonb, array of modules with topics)
      - `keywords` (jsonb, array of course keywords)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `syllabus` table
    - Add policies for users to read syllabi for their course configurations

  Note: Using JSONB for flexible storage of nested module/topic structure:
  {
    "modules": [
      {
        "summary": "Module title",
        "topics": [
          {
            "summary": "Topic title",
            "keywords": ["keyword1", "keyword2"],
            "content": "Markdown content..."
          }
        ]
      }
    ],
    "keywords": ["course", "keywords"]
  }
*/

CREATE TABLE IF NOT EXISTS syllabus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_configuration_id uuid NOT NULL REFERENCES course_configuration(id) ON DELETE CASCADE,
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one syllabus per course configuration
  UNIQUE(course_configuration_id)
);

-- Enable RLS
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read syllabi for their course configurations"
  ON syllabus
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert syllabi"
  ON syllabus
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update syllabi"
  ON syllabus
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_course_configuration_id ON syllabus(course_configuration_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_status ON syllabus(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_course_configuration_updated_at
  BEFORE UPDATE ON course_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_syllabus_updated_at
  BEFORE UPDATE ON syllabus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();