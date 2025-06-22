/*
  # Add Conversation Evaluation Support

  1. New columns for video_conversations table
    - evaluation_result (jsonb) - stores AI evaluation results
    - transcript (jsonb) - stores conversation transcript
    - evaluation_status (text) - tracks evaluation process

  2. New indexes for performance
    - Index on evaluation_status for filtering
    - Index on conversation_type for exam filtering

  3. Functions
    - Function to get conversations ready for evaluation
    - Function to update evaluation results
*/

-- Add new columns to video_conversations table
DO $$ 
BEGIN
  -- Add evaluation_result column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_conversations' AND column_name = 'evaluation_result'
  ) THEN
    ALTER TABLE video_conversations 
    ADD COLUMN evaluation_result jsonb DEFAULT NULL;
  END IF;

  -- Add transcript column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_conversations' AND column_name = 'transcript'
  ) THEN
    ALTER TABLE video_conversations 
    ADD COLUMN transcript jsonb DEFAULT NULL;
  END IF;

  -- Add evaluation_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_conversations' AND column_name = 'evaluation_status'
  ) THEN
    ALTER TABLE video_conversations 
    ADD COLUMN evaluation_status text DEFAULT 'pending' 
    CHECK (evaluation_status IN ('pending', 'evaluating', 'completed', 'failed'));
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_conversations_evaluation_status 
  ON video_conversations(evaluation_status);

CREATE INDEX IF NOT EXISTS idx_video_conversations_type_status 
  ON video_conversations(conversation_type, status);

-- Function to get conversations ready for evaluation
CREATE OR REPLACE FUNCTION get_conversations_for_evaluation()
RETURNS TABLE (
  id uuid,
  tavus_conversation_id text,
  user_id uuid,
  course_id uuid,
  conversation_type text,
  session_log jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vc.id,
    vc.tavus_conversation_id,
    vc.user_id,
    vc.course_id,
    vc.conversation_type,
    vc.session_log,
    vc.created_at
  FROM video_conversations vc
  WHERE vc.conversation_type = 'exam'
    AND vc.status = 'ended'
    AND (vc.evaluation_status IS NULL OR vc.evaluation_status = 'pending')
    AND vc.session_log ? 'transcript'
    AND jsonb_array_length(vc.session_log->'transcript') > 0
  ORDER BY vc.created_at ASC;
END;
$$;

-- Function to update evaluation results
CREATE OR REPLACE FUNCTION update_conversation_evaluation(
  p_conversation_id text,
  p_evaluation_result jsonb,
  p_evaluation_status text DEFAULT 'completed'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE video_conversations 
  SET 
    evaluation_result = p_evaluation_result,
    evaluation_status = p_evaluation_status,
    session_log = jsonb_set(
      COALESCE(session_log, '{}'),
      '{evaluated_at}',
      to_jsonb(now())
    )
  WHERE tavus_conversation_id = p_conversation_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count > 0;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_conversations_for_evaluation() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_conversation_evaluation(text, jsonb, text) TO authenticated, service_role;

-- Add comment for documentation
COMMENT ON COLUMN video_conversations.evaluation_result IS 'AI evaluation results including score, breakdown, strengths, weaknesses, and recommendations';
COMMENT ON COLUMN video_conversations.transcript IS 'Full conversation transcript from Tavus API';
COMMENT ON COLUMN video_conversations.evaluation_status IS 'Status of AI evaluation process: pending, evaluating, completed, failed';