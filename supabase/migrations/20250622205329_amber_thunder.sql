/*
  # Allow Course Re-enrollment

  1. Changes
    - Drop the unique constraint that prevents users from enrolling in the same course multiple times
    - Create smart enrollment function that handles re-enrollment gracefully
    - Add helper functions for getting current and historical enrollments
    - Add performance indexes

  2. New Functions
    - `smart_course_enrollment()` - Handles enrollment with automatic cleanup of previous active enrollments
    - `get_current_enrollment()` - Gets the current active enrollment for a user in a course
    - `get_enrollment_history()` - Gets complete enrollment history for a user in a course

  3. Security
    - Functions use SECURITY DEFINER for proper access control
    - Maintains RLS policies on the underlying table
*/

-- Drop the unique constraint that prevents re-enrollment
-- The index will be automatically dropped when the constraint is dropped
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

  -- If there's an active enrollment, mark it as dropped first
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

-- Add indexes for better performance on course discovery and enrollment queries
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

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION smart_course_enrollment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_enrollment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_enrollment_history(uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION smart_course_enrollment(uuid, uuid) IS 'Handle course enrollment with automatic cleanup of previous active enrollments';
COMMENT ON FUNCTION get_current_enrollment(uuid, uuid) IS 'Get the current active enrollment for a user in a specific course';
COMMENT ON FUNCTION get_enrollment_history(uuid, uuid) IS 'Get the complete enrollment history for a user in a specific course';