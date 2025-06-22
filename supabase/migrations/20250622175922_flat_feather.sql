/*
  # Add Webhook Support for Transcript Processing

  1. New Columns
    - Update video_conversations table to better support webhook-based transcript processing
    - Add indexes for efficient webhook processing

  2. Functions
    - Add helper functions for webhook processing
    - Add function to check evaluation status

  3. Indexes
    - Add indexes for efficient webhook queries
    - Add composite indexes for evaluation processing
*/

-- Add additional columns if they don't exist
DO $$ 
BEGIN
  -- Add webhook tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_conversations' AND column_name = 'webhook_events_received'
  ) THEN
    ALTER TABLE video_conversations 
    ADD COLUMN webhook_events_received jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Add transcript processing status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'video_conversations' AND column_name = 'transcript_status'
  ) THEN
    ALTER TABLE video_conversations 
    ADD COLUMN transcript_status text DEFAULT 'pending' 
    CHECK (transcript_status IN ('pending', 'processing', 'ready', 'failed'));
  END IF;
END $$;

-- Create indexes for webhook processing efficiency
CREATE INDEX IF NOT EXISTS idx_video_conversations_tavus_id 
  ON video_conversations(tavus_conversation_id);

CREATE INDEX IF NOT EXISTS idx_video_conversations_transcript_status 
  ON video_conversations(transcript_status);

CREATE INDEX IF NOT EXISTS idx_video_conversations_webhook_processing 
  ON video_conversations(conversation_type, status, evaluation_status) 
  WHERE conversation_type = 'exam';

-- Function to get conversations awaiting evaluation
CREATE OR REPLACE FUNCTION get_conversations_awaiting_evaluation()
RETURNS TABLE (
  id uuid,
  tavus_conversation_id text,
  user_id uuid,
  course_id uuid,
  conversation_type text,
  transcript jsonb,
  session_log jsonb
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
    vc.transcript,
    vc.session_log
  FROM video_conversations vc
  WHERE vc.conversation_type = 'exam'
    AND vc.status = 'ended'
    AND vc.transcript IS NOT NULL
    AND jsonb_array_length(vc.transcript) > 0
    AND (vc.evaluation_status = 'pending' OR vc.evaluation_status IS NULL)
  ORDER BY vc.created_at ASC;
END;
$$;

-- Function to process webhook events
CREATE OR REPLACE FUNCTION process_webhook_event(
  p_conversation_id text,
  p_event_type text,
  p_event_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conversation_record RECORD;
  updated_count integer;
BEGIN
  -- Get current conversation data
  SELECT * INTO conversation_record
  FROM video_conversations 
  WHERE tavus_conversation_id = p_conversation_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Conversation not found: %', p_conversation_id;
    RETURN false;
  END IF;

  -- Update webhook events received
  UPDATE video_conversations 
  SET 
    webhook_events_received = COALESCE(webhook_events_received, '[]'::jsonb) || 
      jsonb_build_object(
        'event_type', p_event_type,
        'timestamp', now(),
        'data', p_event_data
      ),
    session_log = COALESCE(session_log, '{}'::jsonb) || 
      jsonb_build_object(
        p_event_type || '_webhook_at', now(),
        p_event_type || '_webhook_data', p_event_data
      )
  WHERE tavus_conversation_id = p_conversation_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count > 0;
END;
$$;

-- Function to update conversation evaluation status
CREATE OR REPLACE FUNCTION update_evaluation_status(
  p_conversation_id text,
  p_status text,
  p_result jsonb DEFAULT NULL
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
    evaluation_status = p_status,
    evaluation_result = COALESCE(p_result, evaluation_result),
    session_log = COALESCE(session_log, '{}'::jsonb) || 
      jsonb_build_object(
        'evaluation_status_updated_at', now(),
        'evaluation_status', p_status
      )
  WHERE tavus_conversation_id = p_conversation_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count > 0;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_conversations_awaiting_evaluation() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_webhook_event(text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_evaluation_status(text, text, jsonb) TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON COLUMN video_conversations.webhook_events_received IS 'Array of webhook events received from Tavus API';
COMMENT ON COLUMN video_conversations.transcript_status IS 'Status of transcript processing: pending, processing, ready, failed';
COMMENT ON FUNCTION get_conversations_awaiting_evaluation() IS 'Get exam conversations that have transcripts but no evaluation results';
COMMENT ON FUNCTION process_webhook_event(text, text, jsonb) IS 'Process incoming webhook events from Tavus API';
COMMENT ON FUNCTION update_evaluation_status(text, text, jsonb) IS 'Update the evaluation status of a conversation';