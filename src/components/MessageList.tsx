import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2 } from 'lucide-react';
import { Message } from '@/hooks/useMultiChat';
import ChatMessage from './ChatMessage';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  aircraftModel?: string;
}

const MessageList = ({ messages, isLoading, aircraftModel }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debug logging for message updates
  useEffect(() => {
    console.log('🎭 MessageList render update:', {
      aircraftModel,
      messageCount: messages.length,
      isLoading,
      hasMessages: messages.length > 0,
      messagesPreview: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content?.substring(0, 40) + '...',
        isPending: m.isPending,
        isTyping: m.isTyping
      }))
    });
    
    // Additional debugging: log when we have messages but they might not be showing
    if (messages.length > 0 && !isLoading) {
      console.log('✅ MessageList has', messages.length, 'messages and is not loading - should display messages');
    }
  }, [messages, isLoading, aircraftModel]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      const isNearBottom = scrollElement.scrollHeight - scrollElement.scrollTop <= scrollElement.clientHeight + 100;
      
      if (isNearBottom) {
        setTimeout(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col">
      <ScrollArea className="flex-1 h-0 p-4" ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
              <p className="text-lg font-medium mb-2">Loading messages...</p>
              <p className="text-sm">Please wait while we load your conversation</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm">Send a message to begin chatting with your AI assistant</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message} 
                aircraftModel={aircraftModel}
              />
            ))}
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default MessageList;