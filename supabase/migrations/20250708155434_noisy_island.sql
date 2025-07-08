/*
  # Performance and Data Integrity Improvements

  1. Indexes
    - Add index on participants (is_waiting, gender, preferred_gender) for faster matching
    - Add index on messages (session_id, sent_at) for faster message loading
    - Add index on chat_sessions (status, created_at) for session management

  2. Constraints
    - Add check constraint to ensure participant names are not empty
    - Add check constraint to ensure message content is not empty

  3. Functions
    - Add function to automatically update updated_at timestamp
*/

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_participants_matching 
ON participants (is_waiting, gender, preferred_gender, joined_at) 
WHERE is_waiting = true;

CREATE INDEX IF NOT EXISTS idx_messages_session_time 
ON messages (session_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status 
ON chat_sessions (status, created_at);

-- Add data integrity constraints
ALTER TABLE participants 
ADD CONSTRAINT check_name_not_empty 
CHECK (length(trim(name)) > 0);

ALTER TABLE messages 
ADD CONSTRAINT check_content_not_empty 
CHECK (length(trim(content)) > 0);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure trigger exists for chat_sessions
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();