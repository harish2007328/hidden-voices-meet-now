export type GenderType = 'male' | 'female' | 'any';
export type ChatType = 'text' | 'audio' | 'video';
export type SessionStatus = 'waiting' | 'matched' | 'ended';

export interface ChatSession {
  id: string;
  session_type: ChatType;
  status: SessionStatus;
  created_at: string;
  ended_at?: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  session_id?: string;
  name: string;
  gender: GenderType;
  preferred_gender: GenderType;
  is_waiting: boolean;
  joined_at: string;
  left_at?: string;
}

export interface Message {
  id: string;
  session_id: string;
  participant_id: string;
  content: string;
  sent_at: string;
}