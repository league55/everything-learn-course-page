/*
  # Allow Course Re-enrollment

  1. Changes
    - Remove unique constraint preventing multiple enrollments in same course
    - Add logic to handle previous enrollments gracefully
    - Allow users to retake courses for skill improvement

  2. New Approach
    - Users can enroll in the same course multiple times
    - Previous enrollments are marked as 'dropped' when new enrollment is created
    - Only one 'active' enrollment per user per course at a time

  3. Functions
    - Add function to handle enrollment with proper cleanup
    - Maintain data integrity while allowing course retakes

  4. Rationale
    - Educational value: Users may want to refresh knowledge or improve scores
    - Flexibility: Allows for course retakes without losing historical data
    - Maintains progress tracking for each attempt
*/

-- Drop the unique constraint that prevents re-enrollment
DROP INDEX IF EXISTS user_enrollments_user_course_unique;
ALTER TABLE user_enrollments DROP CONSTRAINT IF EXISTS user_enrollments_user_course_unique;

-- Create a function to handle smart enrollment
CREATE OR REPLACE FUNCTION smart_course_enrollment(
  p_user_id uuid,
  p_course_configuration_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enrollment_id uuid;
  existing_active_count integer;
BEGIN
  -- Check for existing active enrollments
  SELECT COUNT(*) INTO existing_active_count
  FROM user_enrollments
  WHERE user_id = p_user_id 
    AND course_configuration_id = p_course_configuration_id 
    AND status = 'active';

  -- If there's an active enrollment, complete it first
  IF existing_active_count > 0 THEN
    UPDATE user_enrollments 
    SET 
      status = 'dropped',
      updated_at = now()
    WHERE user_id = p_user_id 
      AND course_configuration_id = p_course_configuration_id 
      AND status = 'active';
      
    RAISE NOTICE 'Previous active enrollment marked as dropped for user % in course %', p_user_id, p_course_configuration_id;
  END IF;

  -- Create new enrollment
  INSERT INTO user_enrollments (
    user_id,
    course_configuration_id,
    status,
    current_module_index,
    enrolled_at
  ) VALUES (
    p_user_id,
    p_course_configuration_id,
    'active',
    0,
    now()
  ) RETURNING id INTO enrollment_id;

  RETURN enrollment_id;
END;
$$;

-- Update the database operations to use smart enrollment
-- This will be handled in the application code

-- Add index for better performance on course discovery
CREATE INDEX IF NOT EXISTS idx_user_enrollments_user_course_status 
  ON user_enrollments(user_id, course_configuration_id, status);

-- Add index for getting user's latest enrollment per course
CREATE INDEX IF NOT EXISTS idx_user_enrollments_latest 
  ON user_enrollments(user_id, course_configuration_id, enrolled_at DESC);

-- Function to get user's current enrollment for a course
CREATE OR REPLACE FUNCTION get_current_enrollment(
  p_user_id uuid,
  p_course_configuration_id uuid
)
RETURNS TABLE (
  id uuid,
  enrolled_at timestamptz,
  current_module_index integer,
  completed_at timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.enrolled_at,
    ue.current_module_index,
    ue.completed_at,
    ue.status,
    ue.created_at,
    ue.updated_at
  FROM user_enrollments ue
  WHERE ue.user_id = p_user_id 
    AND ue.course_configuration_id = p_course_configuration_id
    AND ue.status = 'active'
  ORDER BY ue.enrolled_at DESC
  LIMIT 1;
END;
$$;

-- Function to get user's enrollment history for a course
CREATE OR REPLACE FUNCTION get_enrollment_history(
  p_user_id uuid,
  p_course_configuration_id uuid
)
RETURNS TABLE (
  id uuid,
  enrolled_at timestamptz,
  current_module_index integer,
  completed_at timestamptz,
  status text,
  attempt_number bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ue.id,
    ue.enrolled_at,
    ue.current_module_index,
    ue.completed_at,
    ue.status,
    ROW_NUMBER() OVER (ORDER BY ue.enrolled_at) as attempt_number
  FROM user_enrollments ue
  WHERE ue.user_id = p_user_id 
    AND ue.course_configuration_id = p_course_configuration_id
  ORDER BY ue.enrolled_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION smart_course_enrollment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_enrollment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrollment_history(uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION smart_course_enrollment(uuid, uuid) IS 'Handle course enrollment with automatic cleanup of previous active enrollments';
COMMENT ON FUNCTION get_current_enrollment(uuid, uuid) IS 'Get the current active enrollment for a user in a specific course';
COMMENT ON FUNCTION get_enrollment_history(uuid, uuid) IS 'Get the complete enrollment history for a user in a specific course';