import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface EnhancedMessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const EnhancedMessageInput = ({ onSendMessage, isLoading, disabled, placeholder }: EnhancedMessageInputProps) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      resetTextareaHeight();
    }
  };

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Maximum height in pixels
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 p-4 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex-1 relative">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (disabled ? "Select a conversation to start chatting" : "Message Airbus AI...")}
          disabled={disabled || isLoading}
          className="min-h-[44px] max-h-[200px] resize-none pr-12 py-3 text-base leading-6 bg-background border-input focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
          rows={1}
        />
      </div>
      <Button 
        type="submit" 
        disabled={!message.trim() || isLoading || disabled}
        size="icon"
        className="h-[44px] w-[44px] shrink-0 rounded-lg transition-all duration-200 hover:scale-105 disabled:scale-100"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default EnhancedMessageInput;