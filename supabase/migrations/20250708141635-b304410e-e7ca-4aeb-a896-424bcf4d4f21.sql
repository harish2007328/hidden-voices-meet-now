-- Create enum for gender options
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'any');

-- Create enum for chat types
CREATE TYPE public.chat_type AS ENUM ('text', 'audio', 'video');

-- Create enum for session status
CREATE TYPE public.session_status AS ENUM ('waiting', 'matched', 'ended');

-- Create chat sessions table
CREATE TABLE public.chat_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_type chat_type NOT NULL,
    status session_status NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create participants table
CREATE TABLE public.participants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gender gender_type NOT NULL,
    preferred_gender gender_type NOT NULL DEFAULT 'any',
    is_waiting BOOLEAN NOT NULL DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    left_at TIMESTAMP WITH TIME ZONE
);

-- Create messages table
CREATE TABLE public.messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.participants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_sessions
CREATE POLICY "Users can view sessions they participate in" 
ON public.chat_sessions 
FOR SELECT 
USING (
    id IN (
        SELECT session_id FROM public.participants 
        WHERE id = ANY(string_to_array(current_setting('request.headers', true)::json->>'participant-id', ','))
    )
);

CREATE POLICY "Users can update sessions they participate in" 
ON public.chat_sessions 
FOR UPDATE 
USING (
    id IN (
        SELECT session_id FROM public.participants 
        WHERE id = ANY(string_to_array(current_setting('request.headers', true)::json->>'participant-id', ','))
    )
);

-- Create policies for participants
CREATE POLICY "Anyone can create participants" 
ON public.participants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view all participants in their sessions" 
ON public.participants 
FOR SELECT 
USING (
    session_id IN (
        SELECT session_id FROM public.participants 
        WHERE id = ANY(string_to_array(current_setting('request.headers', true)::json->>'participant-id', ','))
    )
);

CREATE POLICY "Users can update their own participant record" 
ON public.participants 
FOR UPDATE 
USING (id = ANY(string_to_array(current_setting('request.headers', true)::json->>'participant-id', ',')));

-- Create policies for messages
CREATE POLICY "Anyone can insert messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view messages from their sessions" 
ON public.messages 
FOR SELECT 
USING (
    session_id IN (
        SELECT session_id FROM public.participants 
        WHERE id = ANY(string_to_array(current_setting('request.headers', true)::json->>'participant-id', ','))
    )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for all tables
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;