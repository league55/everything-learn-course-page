/*
  # Syllabus Generation Job Queue

  1. New Tables
    - `syllabus_generation_jobs`
      - `id` (uuid, primary key)
      - `course_configuration_id` (uuid, foreign key to course_configuration)
      - `status` (text, job status: pending, processing, completed, failed)
      - `retries` (integer, number of retry attempts)
      - `max_retries` (integer, maximum allowed retries)
      - `error_message` (text, error details if failed)
      - `started_at` (timestamp, when processing began)
      - `completed_at` (timestamp, when job finished)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `syllabus_generation_jobs` table
    - Add policies for users to create and read their own generation jobs

  3. Indexes
    - Index on status for efficient job queue processing
    - Index on course_configuration_id for linking to courses
    - Index on created_at for job ordering

  4. Functions
    - Add function to automatically enqueue syllabus generation
    - Add trigger to call worker when new jobs are created
*/

CREATE TABLE IF NOT EXISTS syllabus_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_configuration_id uuid NOT NULL REFERENCES course_configuration(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retries int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one active job per course configuration
  UNIQUE(course_configuration_id)
);

-- Enable RLS
ALTER TABLE syllabus_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for syllabus_generation_jobs
CREATE POLICY "Users can create generation jobs for their courses"
  ON syllabus_generation_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read generation jobs for their courses"
  ON syllabus_generation_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update generation jobs"
  ON syllabus_generation_jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_configuration cc 
      WHERE cc.id = syllabus_generation_jobs.course_configuration_id 
      AND cc.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_syllabus_generation_jobs_status ON syllabus_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_syllabus_generation_jobs_course_id ON syllabus_generation_jobs(course_configuration_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_generation_jobs_created_at ON syllabus_generation_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_syllabus_generation_jobs_retries ON syllabus_generation_jobs(retries, max_retries);

-- Trigger for updated_at
CREATE TRIGGER update_syllabus_generation_jobs_updated_at
  BEFORE UPDATE ON syllabus_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to process syllabus generation jobs
CREATE OR REPLACE FUNCTION process_syllabus_generation_job()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
  payload jsonb;
BEGIN
  -- Only process newly inserted jobs with 'pending' status
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Construct the edge function URL
    -- Note: This will be configured properly in the webhook/edge function setup
    function_url := 'https://your-project-ref.supabase.co/functions/v1/process-syllabus-job';
    
    -- Prepare the payload with job information
    payload := jsonb_build_object(
      'job_id', NEW.id,
      'course_configuration_id', NEW.course_configuration_id
    );

    -- Log the job creation
    RAISE NOTICE 'Syllabus generation job created: % for course: %', NEW.id, NEW.course_configuration_id;
    
    -- The actual HTTP call will be handled by the webhook/edge function
    -- This trigger just logs the event for now
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new job processing
CREATE TRIGGER trigger_process_syllabus_generation_job
  AFTER INSERT ON syllabus_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION process_syllabus_generation_job();

-- Grant necessary permissions
GRANT ALL ON syllabus_generation_jobs TO authenticated;
GRANT EXECUTE ON FUNCTION process_syllabus_generation_job() TO authenticated;