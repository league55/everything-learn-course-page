/*
  # Remove problematic database trigger function

  1. Changes
    - Drop the database trigger that was causing configuration errors
    - Remove the trigger function that relied on unavailable settings
    - Clean up the failed approach for calling edge functions from database

  2. Rationale
    - Database triggers with HTTP calls are complex and error-prone
    - Frontend-initiated edge function calls are more reliable
    - Eliminates dependency on database configuration parameters
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS trigger_course_configuration_created ON course_configuration;

-- Drop the function
DROP FUNCTION IF EXISTS notify_course_configuration_created();

-- Note: The pg_net extension can remain as it might be useful for other purposes
-- but we're not using it for this trigger approach anymore