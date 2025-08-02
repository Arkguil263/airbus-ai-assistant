import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot } from 'lucide-react';
import { Message } from '@/hooks/useMultiChat';
import ChatMessage from './ChatMessage';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  aircraftModel?: string;
}

const MessageList = ({ messages, isLoading, aircraftModel }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
        {messages.length === 0 ? (
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
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default MessageList;