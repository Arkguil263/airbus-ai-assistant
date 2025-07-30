import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const useChat = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  // Load conversations
  const loadConversations = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading conversations:', error);
      return;
    }

    setConversations(data || []);
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    setMessages((data || []) as Message[]);
  };

  // Create new conversation
  const createConversation = async (title: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: title
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    await loadConversations();
    return data;
  };

  // Send message
  const sendMessage = async (content: string, assistantId: string) => {
    if (!user || !currentConversation) return;

    setIsLoading(true);

    try {
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('chat-assistant', {
        body: {
          message: content,
          conversationId: currentConversation,
          assistantId: assistantId
        }
      });

      if (error) {
        throw error;
      }

      // Reload messages to get the latest from database
      await loadMessages(currentConversation);
      await loadConversations(); // Update conversation list with new timestamp

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting conversation:', error);
      return;
    }

    if (currentConversation === conversationId) {
      setCurrentConversation(null);
      setMessages([]);
    }

    await loadConversations();
  };

  // Switch conversation
  const switchConversation = async (conversationId: string) => {
    setCurrentConversation(conversationId);
    await loadMessages(conversationId);
  };

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    createConversation,
    sendMessage,
    deleteConversation,
    switchConversation,
    loadConversations
  };
};