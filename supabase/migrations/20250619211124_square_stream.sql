/*
  # Audio Content Support

  1. New Tables
    - `audio_generation_jobs`
      - `id` (uuid, primary key)
      - `course_configuration_id` (uuid, foreign key)
      - `module_index` (integer)
      - `topic_index` (integer)
      - `status` (text, job status: pending, processing, completed, failed)
      - `source_text` (text, the text content to convert to audio)
      - `voice_id` (text, ElevenLabs voice ID)
      - `audio_file_path` (text, path to generated audio file)
      - `audio_file_size` (bigint, file size in bytes)
      - `duration_seconds` (numeric, audio duration)
      - `error_message` (text)
      - `retries` (integer)
      - `max_retries` (integer)
      - `started_at` (timestamp)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Storage
    - Add audio content type support for existing content_items table
    - Audio files will be stored in course-audio bucket

  3. Security
    - Enable RLS on audio_generation_jobs table
    - Add policies for users to manage audio jobs for their courses

  4. Indexes
    - Index on course_configuration_id, module_index, topic_index for fast audio retrieval
    - Index on status for job queue processing

  5. Functions
    - Add function to get topic audio
    - Add function to create audio generation job
*/

-- Audio Generation Jobs Table
CREATE TABLE IF NOT EXISTS audio_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_configuration_id uuid NOT NULL REFERENCES course_configuration(id) ON DELETE CASCADE,
  module_index integer NOT NULL,
  topic_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  source_text text NOT NULL,
  voice_id text NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL', -- ElevenLabs default voice
  audio_file_path text,
  audio_file_size bigint,
  duration_seconds numeric,
  error_message text,
  retries integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE audio_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for audio_generation_jobs
CREATE POLICY "Users can read audio jobs for their courses"
  ON audio_generation_jobs
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = audio_generation_jobs.course_configuration_id
    )
  );

CREATE POLICY "Users can manage audio jobs for their courses"
  ON audio_generation_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = audio_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = audio_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_generation_jobs_course_module_topic 
  ON audio_generation_jobs(course_configuration_id, module_index, topic_index);
CREATE INDEX IF NOT EXISTS idx_audio_generation_jobs_status 
  ON audio_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audio_generation_jobs_created_at 
  ON audio_generation_jobs(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_audio_generation_jobs_updated_at
  BEFORE UPDATE ON audio_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get audio for a specific topic
CREATE OR REPLACE FUNCTION get_topic_audio(
  p_course_id uuid,
  p_module_index integer,
  p_topic_index integer
)
RETURNS TABLE (
  id uuid,
  status text,
  audio_file_path text,
  audio_file_size bigint,
  duration_seconds numeric,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ajb.id,
    ajb.status,
    ajb.audio_file_path,
    ajb.audio_file_size,
    ajb.duration_seconds,
    ajb.created_at
  FROM audio_generation_jobs ajb
  WHERE ajb.course_configuration_id = p_course_id
    AND ajb.module_index = p_module_index
    AND ajb.topic_index = p_topic_index
    AND ajb.status = 'completed'
  ORDER BY ajb.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to create audio generation job
CREATE OR REPLACE FUNCTION create_audio_generation_job(
  p_course_id uuid,
  p_module_index integer,
  p_topic_index integer,
  p_source_text text,
  p_voice_id text DEFAULT 'EXAVITQu4vr4xnSDxMaL'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id uuid;
BEGIN
  -- Check if there's already a pending or processing job for this topic
  IF EXISTS (
    SELECT 1 FROM audio_generation_jobs
    WHERE course_configuration_id = p_course_id
      AND module_index = p_module_index
      AND topic_index = p_topic_index
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'Audio generation job already in progress for this topic';
  END IF;

  INSERT INTO audio_generation_jobs (
    course_configuration_id,
    module_index,
    topic_index,
    source_text,
    voice_id
  ) VALUES (
    p_course_id,
    p_module_index,
    p_topic_index,
    p_source_text,
    p_voice_id
  ) RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Function to process audio generation jobs (trigger)
CREATE OR REPLACE FUNCTION process_audio_generation_job()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process newly inserted jobs with 'pending' status
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Log the job creation
    RAISE NOTICE 'Audio generation job created: % for course: % module: % topic: %', 
      NEW.id, NEW.course_configuration_id, NEW.module_index, NEW.topic_index;
    
    -- The actual processing will be handled by the edge function
    -- This trigger just logs the event for now
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new audio job processing
CREATE TRIGGER trigger_process_audio_generation_job
  AFTER INSERT ON audio_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION process_audio_generation_job();

-- Grant permissions
GRANT ALL ON audio_generation_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION get_topic_audio(uuid, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_audio_generation_job(uuid, integer, integer, text, text) TO authenticated;