/*
  # Fix Chat System - Online Status and Real-time Improvements

  1. Online Status Tracking
    - Add `last_seen` and `is_online` columns to participants
    - Create indexes for efficient online user matching
    
  2. Cleanup Functions
    - Function to mark offline participants
    - Function to update participant heartbeat
    
  3. Security Improvements
    - Better RLS policies for all tables
    - Proper access control based on session participation
    
  4. Performance Optimizations
    - Optimized indexes for matching queries
    - Better query performance for online users only
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Allow all operations on chat_sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Allow all operations on participants" ON participants;
DROP POLICY IF EXISTS "Allow all operations on messages" ON messages;

-- Add online status tracking to participants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'participants' AND column_name = 'last_seen'
    ) THEN
        ALTER TABLE participants ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'participants' AND column_name = 'is_online'
    ) THEN
        ALTER TABLE participants ADD COLUMN is_online BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add better indexes for performance
DROP INDEX IF EXISTS idx_participants_matching;
DROP INDEX IF EXISTS idx_participants_online_matching;
DROP INDEX IF EXISTS idx_participants_online_status;
DROP INDEX IF EXISTS idx_participants_session_lookup;

CREATE INDEX idx_participants_online_matching 
ON participants (is_waiting, is_online, gender, preferred_gender, joined_at) 
WHERE is_waiting = true AND is_online = true;

CREATE INDEX idx_participants_online_status 
ON participants (is_online, last_seen);

CREATE INDEX idx_participants_session_lookup 
ON participants (session_id) WHERE session_id IS NOT NULL;

-- Function to cleanup offline participants
CREATE OR REPLACE FUNCTION cleanup_offline_participants()
RETURNS void AS $$
BEGIN
    -- Mark participants as offline if they haven't been seen for 30 seconds
    UPDATE participants 
    SET is_online = false, is_waiting = false
    WHERE last_seen < now() - interval '30 seconds' 
    AND is_online = true;
    
    -- End sessions where all participants are offline
    UPDATE chat_sessions 
    SET status = 'ended', ended_at = now()
    WHERE status = 'matched' 
    AND id IN (
        SELECT session_id 
        FROM participants 
        WHERE session_id IS NOT NULL 
        GROUP BY session_id 
        HAVING bool_and(NOT is_online)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update participant heartbeat
CREATE OR REPLACE FUNCTION update_participant_heartbeat(participant_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE participants 
    SET last_seen = now(), is_online = true
    WHERE id = participant_uuid;
END;
$$ LANGUAGE plpgsql;

-- Better RLS policies for participants
CREATE POLICY "Anyone can create participants" 
ON participants FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view participants in their sessions" 
ON participants FOR SELECT 
USING (
    session_id IS NULL OR 
    session_id IN (
        SELECT session_id FROM participants 
        WHERE id::text = current_setting('request.jwt.claims', true)::json->>'participant_id'
        AND session_id IS NOT NULL
    )
);

CREATE POLICY "Users can update their own participant record" 
ON participants FOR UPDATE 
USING (id::text = current_setting('request.jwt.claims', true)::json->>'participant_id');

-- Chat sessions policies
CREATE POLICY "Users can view their sessions" 
ON chat_sessions FOR SELECT 
USING (
    id IN (
        SELECT session_id FROM participants 
        WHERE id::text = current_setting('request.jwt.claims', true)::json->>'participant_id'
        AND session_id IS NOT NULL
    )
);

CREATE POLICY "Users can create sessions" 
ON chat_sessions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their sessions" 
ON chat_sessions FOR UPDATE 
USING (
    id IN (
        SELECT session_id FROM participants 
        WHERE id::text = current_setting('request.jwt.claims', true)::json->>'participant_id'
        AND session_id IS NOT NULL
    )
);

-- Messages policies
CREATE POLICY "Anyone can insert messages" 
ON messages FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view messages from their sessions" 
ON messages FOR SELECT 
USING (
    session_id IN (
        SELECT session_id FROM participants 
        WHERE id::text = current_setting('request.jwt.claims', true)::json->>'participant_id'
        AND session_id IS NOT NULL
    )
);

-- Only add tables to realtime publication if they're not already there
DO $$
BEGIN
    -- Check and add participants table to realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE participants;
    END IF;
    
    -- Check and add chat_sessions table to realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'chat_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
    END IF;
    
    -- Check and add messages table to realtime
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;