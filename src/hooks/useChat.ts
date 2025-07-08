import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatSession, Participant, Message, ChatType, GenderType } from '@/types/chat';
import { toast } from '@/hooks/use-toast';

export const useChat = () => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [partner, setPartner] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Start looking for a chat partner
  const startChat = useCallback(async (
    name: string, 
    gender: GenderType, 
    preferredGender: GenderType, 
    chatType: ChatType
  ) => {
    try {
      setIsSearching(true);
      
      // Create participant record
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .insert({
          name,
          gender,
          preferred_gender: preferredGender,
          is_waiting: true
        })
        .select()
        .single();

      if (participantError) throw participantError;
      
      setCurrentParticipant(participant);
      
      // Look for existing waiting participant
      const { data: waitingParticipants, error: searchError } = await supabase
        .from('participants')
        .select('*')
        .eq('is_waiting', true)
        .neq('id', participant.id)
        .or(`preferred_gender.eq.any,preferred_gender.eq.${gender}`)
        .or(`gender.eq.any,gender.eq.${preferredGender}`)
        .limit(1);

      if (searchError) throw searchError;

      if (waitingParticipants && waitingParticipants.length > 0) {
        // Found a match, create session
        const waitingPartner = waitingParticipants[0];
        
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert({
            session_type: chatType,
            status: 'matched'
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Update both participants
        await supabase
          .from('participants')
          .update({ 
            session_id: session.id, 
            is_waiting: false 
          })
          .in('id', [participant.id, waitingPartner.id]);

        setCurrentSession(session);
        setPartner(waitingPartner);
        setIsConnected(true);
        setIsSearching(false);
        
        toast({
          title: "Connected!",
          description: `You're now chatting with ${waitingPartner.name}`,
        });
      } else {
        // No match found, wait for someone
        toast({
          title: "Searching...",
          description: "Looking for someone to chat with",
        });
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      setIsSearching(false);
      toast({
        title: "Error",
        description: "Failed to start chat",
        variant: "destructive",
      });
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession || !currentParticipant) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          session_id: currentSession.id,
          participant_id: currentParticipant.id,
          content
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  }, [currentSession, currentParticipant]);

  // Skip to next person
  const skipChat = useCallback(async () => {
    if (!currentSession || !currentParticipant) return;

    try {
      // End current session
      await supabase
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', currentSession.id);

      // Reset participant to waiting
      await supabase
        .from('participants')
        .update({ 
          session_id: null, 
          is_waiting: true,
          left_at: new Date().toISOString()
        })
        .eq('id', currentParticipant.id);

      // Reset state
      setCurrentSession(null);
      setPartner(null);
      setMessages([]);
      setIsConnected(false);
      
      // Start searching again
      if (currentParticipant) {
        setIsSearching(true);
        // Look for new match
        setTimeout(() => {
          startChat(
            currentParticipant.name,
            currentParticipant.gender,
            currentParticipant.preferred_gender,
            'text' // Default to text for now
          );
        }, 1000);
      }
    } catch (error) {
      console.error('Error skipping chat:', error);
      toast({
        title: "Error",
        description: "Failed to skip chat",
        variant: "destructive",
      });
    }
  }, [currentSession, currentParticipant, startChat]);

  // Stop chat completely
  const stopChat = useCallback(async () => {
    if (!currentParticipant) return;

    try {
      if (currentSession) {
        await supabase
          .from('chat_sessions')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', currentSession.id);
      }

      await supabase
        .from('participants')
        .update({ 
          is_waiting: false,
          left_at: new Date().toISOString()
        })
        .eq('id', currentParticipant.id);

      // Reset all state
      setCurrentSession(null);
      setCurrentParticipant(null);
      setPartner(null);
      setMessages([]);
      setIsConnected(false);
      setIsSearching(false);
    } catch (error) {
      console.error('Error stopping chat:', error);
    }
  }, [currentSession, currentParticipant]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentParticipant) return;

    const participantChannel = supabase
      .channel('participant-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `id=eq.${currentParticipant.id}`
      }, async (payload) => {
        const updatedParticipant = payload.new as Participant;
        setCurrentParticipant(updatedParticipant);
        
        if (updatedParticipant.session_id && !currentSession) {
          // We got matched! Fetch session and partner
          const { data: session } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('id', updatedParticipant.session_id)
            .single();
            
          const { data: partners } = await supabase
            .from('participants')
            .select('*')
            .eq('session_id', updatedParticipant.session_id)
            .neq('id', currentParticipant.id);
            
          if (session) {
            setCurrentSession(session);
            setIsConnected(true);
            setIsSearching(false);
          }
          
          if (partners && partners.length > 0) {
            setPartner(partners[0]);
            toast({
              title: "Connected!",
              description: `You're now chatting with ${partners[0].name}`,
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participantChannel);
    };
  }, [currentParticipant, currentSession]);

  // Set up message subscription
  useEffect(() => {
    if (!currentSession) return;

    const messageChannel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `session_id=eq.${currentSession.id}`
      }, (payload) => {
        const newMessage = payload.new as Message;
        setMessages(prev => [...prev, newMessage]);
      })
      .subscribe();

    // Load existing messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', currentSession.id)
        .order('sent_at', { ascending: true });
      
      if (data) {
        setMessages(data);
      }
    };

    loadMessages();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [currentSession]);

  return {
    currentSession,
    currentParticipant,
    partner,
    messages,
    isConnected,
    isSearching,
    startChat,
    sendMessage,
    skipChat,
    stopChat
  };
};