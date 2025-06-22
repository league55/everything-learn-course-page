/*
  # Add 'ending' status to video_conversations table

  1. Changes
    - Drop existing status check constraint on video_conversations table
    - Add new constraint that includes 'ending' as a valid status value
    - This fixes the error where tavus-end-conversation was trying to set status to 'ending'

  2. Valid Status Values
    - 'initiated': Conversation has been created
    - 'active': Conversation is currently in progress  
    - 'ending': Conversation is being terminated (new status)
    - 'ended': Conversation has completed
    - 'failed': Conversation encountered an error
*/

-- Drop the existing check constraint
ALTER TABLE video_conversations 
DROP CONSTRAINT IF EXISTS video_conversations_status_check;

-- Add new check constraint that includes 'ending'
ALTER TABLE video_conversations 
ADD CONSTRAINT video_conversations_status_check 
CHECK (status = ANY (ARRAY['initiated'::text, 'active'::text, 'ending'::text, 'ended'::text, 'failed'::text]));