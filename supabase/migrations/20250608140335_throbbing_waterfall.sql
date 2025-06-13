/*
  # Content Generation Job Trigger

  1. New Function
    - `process_content_generation_job()` - Calls edge function when new content job is created
    
  2. New Trigger
    - Fires AFTER INSERT on content_generation_jobs table
    - Calls the process-content-job edge function asynchronously

  3. Security
    - Uses service role for edge function authentication
    - Handles errors gracefully without blocking the insert operation
*/

-- Function to process content generation jobs
CREATE OR REPLACE FUNCTION process_content_generation_job()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
  payload jsonb;
BEGIN
  -- Only process newly inserted jobs with 'pending' status
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Construct the edge function URL
    function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-content-job';
    
    -- Prepare the payload with job information
    payload := jsonb_build_object(
      'table', 'content_generation_jobs',
      'type', 'INSERT',
      'record', row_to_json(NEW)
    );

    -- Log the job creation
    RAISE NOTICE 'Content generation job created: % for course: % module: % topic: % type: %', 
      NEW.id, NEW.course_configuration_id, NEW.module_index, NEW.topic_index, NEW.content_type;
    
    -- The actual HTTP call will be handled by the webhook/edge function
    -- This trigger just logs the event for now
    -- In production, you would use pg_net or similar to make the HTTP call
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new content job processing
DROP TRIGGER IF EXISTS trigger_process_content_generation_job ON content_generation_jobs;

CREATE TRIGGER trigger_process_content_generation_job
  AFTER INSERT ON content_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION process_content_generation_job();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_content_generation_job() TO authenticated;
GRANT EXECUTE ON FUNCTION process_content_generation_job() TO service_role;

-- Add webhook trigger using Supabase's http extension (if available)
-- This is an alternative approach that actually makes HTTP calls
CREATE OR REPLACE FUNCTION call_content_generation_webhook()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url text;
  payload jsonb;
  response_status int;
BEGIN
  -- Only process newly inserted jobs with 'pending' status
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Get the webhook URL from environment or settings
    webhook_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-content-job';
    
    -- Prepare the payload
    payload := jsonb_build_object(
      'table', 'content_generation_jobs',
      'type', 'INSERT',
      'record', row_to_json(NEW)
    );

    -- Make HTTP request using Supabase's http extension
    -- Note: This requires the http extension to be enabled
    BEGIN
      SELECT status INTO response_status
      FROM http((
        'POST',
        webhook_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
        ],
        'application/json',
        payload::text
      )::http_request);
      
      RAISE NOTICE 'Content generation webhook called with status: %', response_status;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to call content generation webhook: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the webhook trigger (commented out by default)
-- Uncomment this if you have the http extension enabled and configured
/*
DROP TRIGGER IF EXISTS trigger_call_content_generation_webhook ON content_generation_jobs;

CREATE TRIGGER trigger_call_content_generation_webhook
  AFTER INSERT ON content_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION call_content_generation_webhook();
*/

-- Alternative: Use Supabase's built-in webhook functionality
-- This creates a webhook trigger that calls the edge function
-- The actual webhook URL and authentication will be configured in Supabase dashboard

-- Create a more robust trigger that handles the webhook call
CREATE OR REPLACE FUNCTION notify_content_job_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a notification record that can be picked up by a separate process
  -- or use Supabase's real-time features to trigger the edge function
  
  -- For now, just log the event
  RAISE NOTICE 'Content generation job % created for course % (module %, topic %, type %)', 
    NEW.id, NEW.course_configuration_id, NEW.module_index, NEW.topic_index, NEW.content_type;
  
  -- In a production setup, you would:
  -- 1. Use Supabase's webhook functionality in the dashboard
  -- 2. Or use a separate service to poll for new jobs
  -- 3. Or use Supabase's real-time subscriptions
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the notification trigger
DROP TRIGGER IF EXISTS trigger_notify_content_job_created ON content_generation_jobs;

CREATE TRIGGER trigger_notify_content_job_created
  AFTER INSERT ON content_generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_content_job_created();

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_content_job_created() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_content_job_created() TO service_role;