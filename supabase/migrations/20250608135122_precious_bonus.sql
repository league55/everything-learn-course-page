/*
  # Content Storage System

  1. New Tables
    - `content_items`
      - `id` (uuid, primary key)
      - `course_configuration_id` (uuid, foreign key)
      - `module_index` (integer, which module this content belongs to)
      - `topic_index` (integer, which topic this content belongs to)
      - `content_type` (text, type of content: text, image, video, audio, document)
      - `title` (text, content title)
      - `description` (text, content description)
      - `content_data` (jsonb, structured content data)
      - `file_path` (text, path to file in Supabase Storage if applicable)
      - `file_size` (bigint, file size in bytes)
      - `mime_type` (text, MIME type of the file)
      - `order_index` (integer, order within the topic)
      - `metadata` (jsonb, additional metadata)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `content_generation_jobs`
      - `id` (uuid, primary key)
      - `course_configuration_id` (uuid, foreign key)
      - `module_index` (integer)
      - `topic_index` (integer)
      - `content_type` (text, type of content to generate)
      - `status` (text, job status: pending, processing, completed, failed)
      - `prompt` (text, generation prompt)
      - `result_content_id` (uuid, foreign key to content_items)
      - `error_message` (text)
      - `retries` (integer)
      - `max_retries` (integer)
      - `started_at` (timestamp)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage content for their courses
    - Add policies for reading public content

  3. Storage
    - Create storage buckets for different content types
    - Set up appropriate policies for file access

  4. Indexes
    - Index on course_configuration_id, module_index, topic_index for fast content retrieval
    - Index on content_type for filtering
    - Index on order_index for proper content ordering
*/

-- Content Items Table
CREATE TABLE IF NOT EXISTS content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_configuration_id uuid NOT NULL REFERENCES course_configuration(id) ON DELETE CASCADE,
  module_index integer NOT NULL,
  topic_index integer NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'audio', 'document', 'interactive')),
  title text NOT NULL,
  description text,
  content_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  file_size bigint,
  mime_type text,
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Content Generation Jobs Table
CREATE TABLE IF NOT EXISTS content_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_configuration_id uuid NOT NULL REFERENCES course_configuration(id) ON DELETE CASCADE,
  module_index integer NOT NULL,
  topic_index integer NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('text', 'image', 'video', 'audio', 'document', 'interactive')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  prompt text NOT NULL,
  result_content_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  error_message text,
  retries integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for content_items
CREATE POLICY "Users can read content for courses they have access to"
  ON content_items
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = content_items.course_configuration_id
    )
  );

CREATE POLICY "Users can manage content for their courses"
  ON content_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = content_items.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = content_items.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

-- Policies for content_generation_jobs
CREATE POLICY "Users can read generation jobs for their courses"
  ON content_generation_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = content_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage generation jobs for their courses"
  ON content_generation_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = content_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = content_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_items_course_module_topic 
  ON content_items(course_configuration_id, module_index, topic_index);
CREATE INDEX IF NOT EXISTS idx_content_items_content_type 
  ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_order 
  ON content_items(course_configuration_id, module_index, topic_index, order_index);
CREATE INDEX IF NOT EXISTS idx_content_items_created_at 
  ON content_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_generation_jobs_course_module_topic 
  ON content_generation_jobs(course_configuration_id, module_index, topic_index);
CREATE INDEX IF NOT EXISTS idx_content_generation_jobs_status 
  ON content_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_content_generation_jobs_content_type 
  ON content_generation_jobs(content_type);
CREATE INDEX IF NOT EXISTS idx_content_generation_jobs_created_at 
  ON content_generation_jobs(created_at);

-- Triggers for updated_at
CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_generation_jobs_updated_at
  BEFORE UPDATE ON content_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage buckets setup (these would typically be created via Supabase dashboard or API)
-- This is for documentation purposes - actual bucket creation happens via Supabase API

/*
  Storage Buckets to create:
  
  1. course-images
     - For images, diagrams, charts
     - Public read access
     - Authenticated write access for course owners
  
  2. course-videos
     - For video content
     - Public read access
     - Authenticated write access for course owners
  
  3. course-audio
     - For audio content, podcasts
     - Public read access
     - Authenticated write access for course owners
  
  4. course-documents
     - For PDFs, presentations, documents
     - Public read access
     - Authenticated write access for course owners
  
  5. course-interactive
     - For interactive content, simulations
     - Public read access
     - Authenticated write access for course owners
*/

-- Function to get content for a specific topic
CREATE OR REPLACE FUNCTION get_topic_content(
  p_course_id uuid,
  p_module_index integer,
  p_topic_index integer
)
RETURNS TABLE (
  id uuid,
  content_type text,
  title text,
  description text,
  content_data jsonb,
  file_path text,
  file_size bigint,
  mime_type text,
  order_index integer,
  metadata jsonb,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.content_type,
    ci.title,
    ci.description,
    ci.content_data,
    ci.file_path,
    ci.file_size,
    ci.mime_type,
    ci.order_index,
    ci.metadata,
    ci.created_at
  FROM content_items ci
  WHERE ci.course_configuration_id = p_course_id
    AND ci.module_index = p_module_index
    AND ci.topic_index = p_topic_index
  ORDER BY ci.order_index ASC, ci.created_at ASC;
END;
$$;

-- Function to create content generation job
CREATE OR REPLACE FUNCTION create_content_generation_job(
  p_course_id uuid,
  p_module_index integer,
  p_topic_index integer,
  p_content_type text,
  p_prompt text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id uuid;
BEGIN
  INSERT INTO content_generation_jobs (
    course_configuration_id,
    module_index,
    topic_index,
    content_type,
    prompt
  ) VALUES (
    p_course_id,
    p_module_index,
    p_topic_index,
    p_content_type,
    p_prompt
  ) RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Grant permissions
GRANT ALL ON content_items TO authenticated;
GRANT ALL ON content_generation_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION get_topic_content(uuid, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_content_generation_job(uuid, integer, integer, text, text) TO authenticated;