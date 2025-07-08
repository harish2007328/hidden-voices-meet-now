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

  // Improved matching logic
  const findCompatiblePartner = useCallback(async (
    participant: Participant,
    chatType: ChatType
  ): Promise<Participant | null> => {
    try {
      // Build gender compatibility filter
      let genderFilter = '';
      if (participant.preferred_gender === 'any') {
        genderFilter = 'gender.in.(male,female,any)';
      } else {
        genderFilter = `gender.in.(${participant.preferred_gender},any)`;
      }

      // Find compatible waiting participants
      const { data: compatibleParticipants, error } = await supabase
        .from('participants')
        .select('*')
        .eq('is_waiting', true)
        .neq('id', participant.id)
        .or(genderFilter)
        .order('joined_at', { ascending: true }) // First come, first served
        .limit(10);

      if (error) throw error;

      if (!compatibleParticipants || compatibleParticipants.length === 0) {
        return null;
      }

      // Filter for mutual compatibility
      const mutuallyCompatible = compatibleParticipants.filter(partner => {
        const partnerWantsMe = partner.preferred_gender === 'any' || partner.preferred_gender === participant.gender;
        const iWantPartner = participant.preferred_gender === 'any' || participant.preferred_gender === partner.gender;
        return partnerWantsMe && iWantPartner;
      });

      return mutuallyCompatible.length > 0 ? mutuallyCompatible[0] : null;
    } catch (error) {
      console.error('Error finding compatible partner:', error);
      return null;
    }
  }, []);

  // Create a matched session
  const createMatchedSession = useCallback(async (
    participant1: Participant,
    participant2: Participant,
    chatType: ChatType
  ): Promise<ChatSession | null> => {
    try {
      // Use a transaction-like approach to ensure atomicity
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          session_type: chatType,
          status: 'matched'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Update both participants atomically
      const { error: updateError } = await supabase
        .from('participants')
        .update({ 
          session_id: session.id, 
          is_waiting: false 
        })
        .in('id', [participant1.id, participant2.id]);

      if (updateError) {
        // Rollback session creation if participant update fails
        await supabase
          .from('chat_sessions')
          .delete()
          .eq('id', session.id);
        throw updateError;
      }

      return session;
    } catch (error) {
      console.error('Error creating matched session:', error);
      return null;
    }
  }, []);

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
      
      // Look for compatible partner
      const compatiblePartner = await findCompatiblePartner(participant, chatType);

      if (compatiblePartner) {
        // Create matched session
        const session = await createMatchedSession(participant, compatiblePartner, chatType);
        
        if (session) {
          setCurrentSession(session);
          setPartner(compatiblePartner);
          setIsConnected(true);
          setIsSearching(false);
          
          toast({
            title: "Connected!",
            description: `You're now chatting with ${compatiblePartner.name}`,
          });
        } else {
          throw new Error('Failed to create session');
        }
      } else {
        // No match found, wait for new participants
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
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    }
  }, [findCompatiblePartner, createMatchedSession]);

  // Send a message with better error handling
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession || !currentParticipant || !content.trim()) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          session_id: currentSession.id,
          participant_id: currentParticipant.id,
          content: content.trim()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Message failed",
        description: "Your message couldn't be sent. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentSession, currentParticipant]);

  // Skip to next person with improved logic
  const skipChat = useCallback(async () => {
    if (!currentSession || !currentParticipant) return;

    try {
      // End current session
      await supabase
        .from('chat_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', currentSession.id);

      // Update current participant to waiting status
      const { data: updatedParticipant, error: updateError } = await supabase
        .from('participants')
        .update({ 
          session_id: null, 
          is_waiting: true,
          left_at: null // Reset left_at when starting new search
        })
        .eq('id', currentParticipant.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Reset state
      setCurrentSession(null);
      setPartner(null);
      setMessages([]);
      setIsConnected(false);
      setIsSearching(true);
      
      // Update current participant state
      setCurrentParticipant(updatedParticipant);

      toast({
        title: "Skipped",
        description: "Looking for a new chat partner...",
      });

      // Look for new match immediately
      const compatiblePartner = await findCompatiblePartner(updatedParticipant, 'text');
      
      if (compatiblePartner) {
        const session = await createMatchedSession(updatedParticipant, compatiblePartner, 'text');
        
        if (session) {
          setCurrentSession(session);
          setPartner(compatiblePartner);
          setIsConnected(true);
          setIsSearching(false);
          
          toast({
            title: "New connection!",
            description: `You're now chatting with ${compatiblePartner.name}`,
          });
        }
      }
    } catch (error) {
      console.error('Error skipping chat:', error);
      toast({
        title: "Error",
        description: "Failed to skip chat",
        variant: "destructive",
      });
    }
  }, [currentSession, currentParticipant, findCompatiblePartner, createMatchedSession]);

  // Stop chat completely with cleanup
  const stopChat = useCallback(async () => {
    if (!currentParticipant) return;

    try {
      // End current session if exists
      if (currentSession) {
        await supabase
          .from('chat_sessions')
          .update({ status: 'ended', ended_at: new Date().toISOString() })
          .eq('id', currentSession.id);
      }

      // Mark participant as no longer waiting and set left time
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

  // Enhanced real-time subscriptions
  useEffect(() => {
    if (!currentParticipant || !currentParticipant.is_waiting || isConnected) return;

    // Listen for new participants who might be a match
    const participantChannel = supabase
      .channel('participant-matching')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'participants',
        filter: `is_waiting=eq.true`
      }, async (payload) => {
        const newParticipant = payload.new as Participant;
        
        // Skip if it's our own participant
        if (newParticipant.id === currentParticipant.id) return;
        
        // Check mutual compatibility
        const partnerWantsMe = newParticipant.preferred_gender === 'any' || newParticipant.preferred_gender === currentParticipant.gender;
        const iWantPartner = currentParticipant.preferred_gender === 'any' || currentParticipant.preferred_gender === newParticipant.gender;
        
        if (partnerWantsMe && iWantPartner && !currentSession) {
          // Create a match!
          const session = await createMatchedSession(currentParticipant, newParticipant, 'text');
          
          if (session) {
            setCurrentSession(session);
            setPartner(newParticipant);
            setIsConnected(true);
            setIsSearching(false);
            
            toast({
              title: "Connected!",
              description: `You're now chatting with ${newParticipant.name}`,
            });
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `id=eq.${currentParticipant.id}`
      }, async (payload) => {
        const updatedParticipant = payload.new as Participant;
        setCurrentParticipant(updatedParticipant);
        
        // Check if we got matched by another process
        if (updatedParticipant.session_id && !currentSession) {
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
  }, [currentParticipant, currentSession, isConnected, createMatchedSession]);

  // Message subscription with better error handling
  useEffect(() => {
    if (!currentSession) return;

    const messageChannel = supabase
      .channel(`messages-${currentSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `session_id=eq.${currentSession.id}`
      }, (payload) => {
        const newMessage = payload.new as Message;
        setMessages(prev => {
          // Prevent duplicate messages
          if (prev.some(msg => msg.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      })
      .subscribe();

    // Load existing messages
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', currentSession.id)
          .order('sent_at', { ascending: true });
        
        if (error) throw error;
        
        if (data) {
          setMessages(data);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [currentSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentParticipant && currentParticipant.is_waiting) {
        // Mark as no longer waiting when component unmounts
        supabase
          .from('participants')
          .update({ 
            is_waiting: false,
            left_at: new Date().toISOString()
          })
          .eq('id', currentParticipant.id);
      }
    };
  }, [currentParticipant]);

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