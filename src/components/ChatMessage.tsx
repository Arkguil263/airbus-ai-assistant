import { useState } from 'react';
import { Bot, User, Copy, Check, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message } from '@/hooks/useMultiChat';
import TypingIndicator from './TypingIndicator';

interface ChatMessageProps {
  message: Message;
  aircraftModel?: string;
}

const ChatMessage = ({ message, aircraftModel }: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (message.content) {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show typing indicator for assistant typing messages
  if (message.isTyping) {
    return (
      <div className="flex gap-3 justify-start animate-fade-in">
        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="max-w-[80%]">
          <TypingIndicator aircraftModel={aircraftModel} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 group animate-fade-in ${
        message.role === 'user' ? 'justify-end' : 'justify-start'
      } ${message.isPending ? 'opacity-70' : ''}`}
    >
      {message.role === 'assistant' && (
        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center relative">
          <Bot className="h-4 w-4 text-primary" />
          {message.isVoice && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
              <Mic className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
      )}
      
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 relative ${
          message.role === 'user'
            ? 'bg-primary text-primary-foreground ml-auto'
            : 'bg-muted/50 border border-border/50'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-6">{message.content}</p>
        
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs opacity-70">
            {new Date(message.created_at).toLocaleTimeString()}
          </p>
          
          {message.role === 'assistant' && message.content && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-background/80"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>

      {message.role === 'user' && (
        <div className="flex-shrink-0 w-8 h-8 bg-secondary rounded-full flex items-center justify-center relative">
          <User className="h-4 w-4 text-secondary-foreground" />
          {message.isVoice && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
              <Mic className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;