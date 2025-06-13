/*
  # Enable pg_net extension for HTTP requests

  1. Extensions
    - Enable pg_net extension for making HTTP requests from database triggers
    
  2. Settings
    - Add required Supabase configuration settings
*/

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Set required configuration (these will need to be set by Supabase admin)
-- These are placeholders - actual values should be set in Supabase dashboard
DO $$
BEGIN
  -- Set Supabase URL (this should be configured in Supabase settings)
  PERFORM set_config('app.supabase_url', 'https://your-project-ref.supabase.co', false);
  
  -- Set service role key (this should be configured securely)
  PERFORM set_config('app.supabase_service_role_key', 'your-service-role-key', false);
EXCEPTION WHEN OTHERS THEN
  -- Configuration will be set by Supabase admin
  RAISE NOTICE 'Configuration settings need to be set by Supabase admin';
END $$;