import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  isPending?: boolean;
  isTyping?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  aircraft_model: string;
}

interface AircraftState {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Message[];
  isLoading: boolean;
}

const initialAircraftState: AircraftState = {
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
};

export const useMultiChat = () => {
  const { user } = useAuth();
  const [currentAircraftModel, setCurrentAircraftModel] = useState<string>('A320');
  
  // State for each aircraft model
  const [aircraftStates, setAircraftStates] = useState<Record<string, AircraftState>>({
    A320: { ...initialAircraftState },
    A330: { ...initialAircraftState },
    A350: { ...initialAircraftState },
  });

  // Get current aircraft state
  const getCurrentState = () => aircraftStates[currentAircraftModel];

  // Update specific aircraft state with callback support for atomic updates
  const updateAircraftState = (aircraftModel: string, updates: Partial<AircraftState> | ((prevState: AircraftState) => Partial<AircraftState>)) => {
    setAircraftStates(prev => {
      const currentState = prev[aircraftModel];
      const finalUpdates = typeof updates === 'function' ? updates(currentState) : updates;
      
      return {
        ...prev,
        [aircraftModel]: {
          ...currentState,
          ...finalUpdates,
        },
      };
    });
  };

  // Generate smart conversation title based on aircraft model and date
  const generateConversationTitle = (aircraftModel: string): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleDateString('en-US', { month: 'short' });
    const day = now.getDate();
    return `${aircraftModel} Chat ${year}/${month}/${day}`;
  };

  // Load conversations for specific aircraft model
  const loadConversations = async (aircraftModel: string) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('aircraft_model', aircraftModel)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    updateAircraftState(aircraftModel, {
      conversations: data || [],
    });
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string, aircraftModel: string) => {
    console.log('📥 loadMessages called:', { conversationId, aircraftModel });
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading messages from database:', error);
        throw error;
      }

      const messages = (data || []) as Message[];
      console.log('📥 Database query result:', {
        conversationId,
        aircraftModel,
        messageCount: messages.length,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content?.substring(0, 50) + '...',
          created_at: m.created_at
        }))
      });
      
      // Update aircraft state with loaded messages
      updateAircraftState(aircraftModel, {
        messages: messages,
        isLoading: false
      });
      
      console.log('✅ Messages state updated for aircraft:', aircraftModel, 'with', messages.length, 'messages');
      
    } catch (error) {
      console.error('❌ loadMessages failed:', error);
      // Set empty messages array on error to prevent UI issues
      updateAircraftState(aircraftModel, {
        messages: [],
        isLoading: false
      });
      throw error;
    }
  };

  // Create conversation for specific aircraft model
  const createConversation = async (title: string, aircraftModel: string): Promise<string | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert([
        {
          title,
          user_id: user.id,
          aircraft_model: aircraftModel,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    await loadConversations(aircraftModel);
    return data.id;
  };

  // Send message for specific aircraft model (user message already added in UI)
  const sendMessage = async (content: string, aircraftModel: string, currentMessages?: Message[], conversationId?: string) => {
    console.log('🚀 sendMessage called with:', { content, aircraftModel, currentMessagesLength: currentMessages?.length, conversationId });
    
    if (!user) {
      console.error('❌ No user found in sendMessage');
      return;
    }
    
    // Use provided conversationId or fallback to state
    const targetConversationId = conversationId || aircraftStates[aircraftModel].currentConversation;
    if (!targetConversationId) {
      console.error('❌ No conversation ID available in sendMessage');
      return;
    }

    console.log('📡 Sending to conversation:', targetConversationId);

    try {
      // Set loading state and add typing indicator
      updateAircraftState(aircraftModel, { isLoading: true });
      
      const typingMessage: Message = {
        id: `typing-${Date.now()}`,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        isTyping: true
      };

      // Use provided messages or current state messages
      const baseMessages = currentMessages || aircraftStates[aircraftModel].messages;
      console.log('📝 Adding typing indicator, base messages:', baseMessages.length);
      
      // Track complete message history throughout the process
      const messagesWithTyping = [...baseMessages, typingMessage];
      
      updateAircraftState(aircraftModel, {
        messages: messagesWithTyping
      });

      console.log('📡 Calling edge function chat-assistant...');
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          message: content,
          conversationId: targetConversationId,
          aircraftModel: aircraftModel
        }
      });

      console.log('📡 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw error;
      }

      if (!data || !data.response) {
        console.error('❌ No response data from edge function:', data);
        throw new Error('No response received from AI assistant');
      }

      console.log('✅ Received AI response:', data.response);

      // Create assistant message from response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };

      // Update messages: use baseMessages (which includes user message) to ensure consistency
      const updatedMessages = baseMessages
        .map(m => m.isPending ? { ...m, isPending: false } : m) // Confirm user message
        .concat(assistantMessage); // Add assistant response

      console.log('✅ Final messages update:', updatedMessages.length, 'messages:', updatedMessages.map(m => `${m.role}: ${m.content?.substring(0, 50)}...`));

      updateAircraftState(aircraftModel, {
        messages: updatedMessages,
        isLoading: false
      });

      // Update conversation list with new timestamp
      await loadConversations(aircraftModel);

    } catch (error) {
      console.error('Error sending message:', error);
      // Remove typing messages on error, keep user messages (including pending ones)
      const errorState = aircraftStates[aircraftModel];
      const cleanMessages = errorState.messages
        .filter(m => !m.isTyping) // Remove typing indicator
        .map(m => m.isPending ? { ...m, isPending: false } : m); // Mark pending messages as confirmed
      
      console.log('⚠️ Error cleanup, preserving messages:', cleanMessages.length);
      updateAircraftState(aircraftModel, { 
        messages: cleanMessages,
        isLoading: false 
      });
      throw error;
    } finally {
      updateAircraftState(aircraftModel, { isLoading: false });
    }
  };

  // Delete conversation for specific aircraft model
  const deleteConversation = async (conversationId: string, aircraftModel: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return;
    }

    const currentState = aircraftStates[aircraftModel];
    if (currentState.currentConversation === conversationId) {
      updateAircraftState(aircraftModel, {
        currentConversation: null,
        messages: [],
      });
    }

    await loadConversations(aircraftModel);
  };

  // Switch conversation for specific aircraft model
  const switchConversation = async (conversationId: string, aircraftModel: string) => {
    console.log('🔄 switchConversation called:', { conversationId, aircraftModel, currentAircraftModel });
    
    try {
      // Set loading and update current conversation, but DON'T clear messages yet
      updateAircraftState(aircraftModel, {
        isLoading: true,
        currentConversation: conversationId,
        // Keep existing messages to avoid flash of empty state
      });
      
      console.log('📋 Updated currentConversation state to:', conversationId);
      
      // Load messages for this conversation - this will update the messages
      console.log('📥 Loading messages for conversation:', conversationId);
      await loadMessages(conversationId, aircraftModel);
      
      console.log('✅ switchConversation completed successfully');
      
    } catch (error) {
      console.error('❌ Error in switchConversation:', error);
      updateAircraftState(aircraftModel, { isLoading: false });
    }
  };

  // Switch aircraft model
  const switchAircraftModel = async (aircraftModel: string) => {
    setCurrentAircraftModel(aircraftModel);
    
    // Load conversations for this model if not already loaded
    const state = aircraftStates[aircraftModel];
    if (state.conversations.length === 0) {
      await loadConversations(aircraftModel);
    }
  };

  // Load conversations for all aircraft models when user changes
  useEffect(() => {
    if (user) {
      loadConversations('A320');
      loadConversations('A330');
      loadConversations('A350');
    } else {
      setAircraftStates({
        A320: { ...initialAircraftState },
        A330: { ...initialAircraftState },
        A350: { ...initialAircraftState },
      });
    }
  }, [user]);

  return {
    currentAircraftModel,
    aircraftStates,
    getCurrentState,
    updateAircraftState,
    loadConversations,
    loadMessages,
    createConversation,
    sendMessage,
    deleteConversation,
    switchConversation,
    switchAircraftModel,
    generateConversationTitle,
  };
};