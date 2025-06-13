/*
  # Fix notify_course_configuration_created function

  1. Updates
    - Fix the notify_course_configuration_created function to remove invalid configuration parameter reference
    - Replace 'app.supabase_url' with proper Supabase function or remove if not needed

  2. Security
    - Maintains existing trigger functionality
    - Ensures function executes without configuration parameter errors
*/

-- Drop and recreate the notify function to fix the configuration parameter issue
DROP FUNCTION IF EXISTS notify_course_configuration_created() CASCADE;

CREATE OR REPLACE FUNCTION notify_course_configuration_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple notification without trying to access invalid configuration parameters
  -- If you need the Supabase URL, use environment variables in your application instead
  PERFORM pg_notify('course_configuration_created', json_build_object(
    'id', NEW.id,
    'topic', NEW.topic,
    'user_id', NEW.user_id,
    'created_at', NEW.created_at
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_course_configuration_created ON course_configuration;

CREATE TRIGGER trigger_course_configuration_created
  AFTER INSERT ON course_configuration
  FOR EACH ROW
  EXECUTE FUNCTION notify_course_configuration_created();