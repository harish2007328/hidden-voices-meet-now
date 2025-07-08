import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Heartbeat to maintain online status
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

  // Start heartbeat for online presence
  const startHeartbeat = useCallback((participantId: string) => {
    // Clear existing heartbeat
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }

    // Update heartbeat every 15 seconds
    heartbeatInterval.current = setInterval(async () => {
      try {
        await supabase.rpc('update_participant_heartbeat', {
          participant_uuid: participantId
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 15000);

    // Initial heartbeat
    supabase.rpc('update_participant_heartbeat', {
      participant_uuid: participantId
    });
  }, []);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  // Find online compatible partner
  const findOnlineCompatiblePartner = useCallback(async (
    participant: Participant,
    chatType: ChatType
  ): Promise<Participant | null> => {
    try {
      // Clean up offline participants first
      await supabase.rpc('cleanup_offline_participants');

      // Find online compatible participants with mutual matching
      const { data: compatibleParticipants, error } = await supabase
        .from('participants')
        .select('*')
        .eq('is_waiting', true)
        .eq('is_online', true)
        .neq('id', participant.id)
        .gte('last_seen', new Date(Date.now() - 30000).toISOString()) // Active in last 30 seconds
        .order('joined_at', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error finding partners:', error);
        return null;
      }

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

  // Create matched session with atomic operations
  const createMatchedSession = useCallback(async (
    participant1: Participant,
    participant2: Participant,
    chatType: ChatType
  ): Promise<ChatSession | null> => {
    try {
      // Start a transaction-like operation
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
          is_waiting: false,
          last_seen: new Date().toISOString()
        })
        .in('id', [participant1.id, participant2.id]);

      if (updateError) {
        // Rollback session creation
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

  // Start chat with improved matching
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
          name: name.trim(),
          gender,
          preferred_gender: preferredGender,
          is_waiting: true,
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .select()
        .single();

      if (participantError) throw participantError;
      
      setCurrentParticipant(participant);
      
      // Start heartbeat for this participant
      startHeartbeat(participant.id);
      
      // Look for online compatible partner
      const compatiblePartner = await findOnlineCompatiblePartner(participant, chatType);

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
        // No match found, continue searching
        toast({
          title: "Searching...",
          description: "Looking for someone online to chat with",
        });
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      setIsSearching(false);
      stopHeartbeat();
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
    }
  }, [findOnlineCompatiblePartner, createMatchedSession, startHeartbeat]);

  // Send message with retry logic
  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession || !currentParticipant || !content.trim()) return;

    const trimmedContent = content.trim();
    
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          session_id: currentSession.id,
          participant_id: currentParticipant.id,
          content: trimmedContent
        });

      if (error) throw error;

      // Update heartbeat when sending message
      await supabase.rpc('update_participant_heartbeat', {
        participant_uuid: currentParticipant.id
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Message failed",
        description: "Your message couldn't be sent. Please try again.",
        variant: "destructive",
      });
    }
  }, [currentSession, currentParticipant]);

  // Skip chat with better cleanup
  const skipChat = useCallback(async () => {
    if (!currentSession || !currentParticipant) return;

    try {
      // End current session
      await supabase
        .from('chat_sessions')
        .update({ 
          status: 'ended', 
          ended_at: new Date().toISOString() 
        })
        .eq('id', currentSession.id);

      // Reset participant to waiting status
      const { data: updatedParticipant, error: updateError } = await supabase
        .from('participants')
        .update({ 
          session_id: null, 
          is_waiting: true,
          last_seen: new Date().toISOString()
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
      setCurrentParticipant(updatedParticipant);

      toast({
        title: "Skipped",
        description: "Looking for a new chat partner...",
      });

      // Look for new match
      const compatiblePartner = await findOnlineCompatiblePartner(updatedParticipant, 'text');
      
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
  }, [currentSession, currentParticipant, findOnlineCompatiblePartner, createMatchedSession]);

  // Stop chat with proper cleanup
  const stopChat = useCallback(async () => {
    try {
      // Stop heartbeat first
      stopHeartbeat();

      if (currentParticipant) {
        // End current session if exists
        if (currentSession) {
          await supabase
            .from('chat_sessions')
            .update({ 
              status: 'ended', 
              ended_at: new Date().toISOString() 
            })
            .eq('id', currentSession.id);
        }

        // Mark participant as offline and not waiting
        await supabase
          .from('participants')
          .update({ 
            is_waiting: false,
            is_online: false,
            left_at: new Date().toISOString()
          })
          .eq('id', currentParticipant.id);
      }

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
  }, [currentSession, currentParticipant, stopHeartbeat]);

  // Real-time subscriptions for matching
  useEffect(() => {
    if (!currentParticipant || !currentParticipant.is_waiting || isConnected) return;

    const participantChannel = supabase
      .channel(`participant-matching-${currentParticipant.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'participants',
        filter: `is_waiting=eq.true`
      }, async (payload) => {
        const newParticipant = payload.new as Participant;
        
        // Skip if it's our own participant or they're offline
        if (newParticipant.id === currentParticipant.id || !newParticipant.is_online) return;
        
        // Check mutual compatibility
        const partnerWantsMe = newParticipant.preferred_gender === 'any' || newParticipant.preferred_gender === currentParticipant.gender;
        const iWantPartner = currentParticipant.preferred_gender === 'any' || currentParticipant.preferred_gender === newParticipant.gender;
        
        if (partnerWantsMe && iWantPartner && !currentSession) {
          // Create a match
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
        
        // Check if we got matched
        if (updatedParticipant.session_id && !currentSession) {
          try {
            const { data: session } = await supabase
              .from('chat_sessions')
              .select('*')
              .eq('id', updatedParticipant.session_id)
              .single();
              
            const { data: partners } = await supabase
              .from('participants')
              .select('*')
              .eq('session_id', updatedParticipant.session_id)
              .neq('id', currentParticipant.id)
              .eq('is_online', true);
              
            if (session && partners && partners.length > 0) {
              setCurrentSession(session);
              setPartner(partners[0]);
              setIsConnected(true);
              setIsSearching(false);
              
              toast({
                title: "Connected!",
                description: `You're now chatting with ${partners[0].name}`,
              });
            }
          } catch (error) {
            console.error('Error handling match update:', error);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participantChannel);
    };
  }, [currentParticipant, currentSession, isConnected, createMatchedSession]);

  // Real-time message subscription
  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      return;
    }

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
          return [...prev, newMessage].sort((a, b) => 
            new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
          );
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
        
        setMessages(data || []);
      } catch (error) {
        console.error('Error loading messages:', error);
        setMessages([]);
      }
    };

    loadMessages();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [currentSession]);

  // Monitor partner's online status
  useEffect(() => {
    if (!partner || !currentSession) return;

    const partnerChannel = supabase
      .channel(`partner-status-${partner.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `id=eq.${partner.id}`
      }, (payload) => {
        const updatedPartner = payload.new as Participant;
        
        // If partner goes offline, end the session
        if (!updatedPartner.is_online) {
          toast({
            title: "Partner disconnected",
            description: `${partner.name} has left the chat`,
            variant: "destructive",
          });
          
          // End the session
          supabase
            .from('chat_sessions')
            .update({ 
              status: 'ended', 
              ended_at: new Date().toISOString() 
            })
            .eq('id', currentSession.id);
            
          setIsConnected(false);
          setPartner(null);
        } else {
          setPartner(updatedPartner);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(partnerChannel);
    };
  }, [partner, currentSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
      if (currentParticipant) {
        supabase
          .from('participants')
          .update({ 
            is_waiting: false,
            is_online: false,
            left_at: new Date().toISOString()
          })
          .eq('id', currentParticipant.id);
      }
    };
  }, [currentParticipant, stopHeartbeat]);

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