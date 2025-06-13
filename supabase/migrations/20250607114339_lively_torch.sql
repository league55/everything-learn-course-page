/*
  # Add Database Trigger for Course Configuration

  1. New Function
    - `notify_course_configuration_created()` - Calls edge function when new course is created
    
  2. New Trigger
    - Fires AFTER INSERT on course_configuration table
    - Calls the edge function asynchronously via HTTP request

  3. Security
    - Uses service role key for edge function authentication
    - Handles errors gracefully without blocking the insert operation
*/

-- Function to call edge function when course configuration is created
CREATE OR REPLACE FUNCTION notify_course_configuration_created()
RETURNS TRIGGER AS $$
DECLARE
  function_url text;
  payload jsonb;
  result text;
BEGIN
  -- Construct the edge function URL
  function_url := current_setting('app.supabase_url') || '/functions/v1/generate-syllabus';
  
  -- Prepare the payload
  payload := jsonb_build_object(
    'table', 'course_configuration',
    'type', 'INSERT',
    'record', row_to_json(NEW)
  );

  -- Make async HTTP request to edge function
  -- Using pg_net extension for HTTP requests
  BEGIN
    SELECT INTO result
      net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := payload
      );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to call edge function: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after course configuration insert
DROP TRIGGER IF EXISTS trigger_course_configuration_created ON course_configuration;

CREATE TRIGGER trigger_course_configuration_created
  AFTER INSERT ON course_configuration
  FOR EACH ROW
  EXECUTE FUNCTION notify_course_configuration_created();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_course_configuration_created() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_course_configuration_created() TO service_role;