import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const MessageInput = ({ onSendMessage, isLoading, disabled }: MessageInputProps) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-border">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Select a conversation to start chatting" : "Type your message..."}
        disabled={disabled || isLoading}
        className="flex-1"
      />
      <Button 
        type="submit" 
        disabled={!message.trim() || isLoading || disabled}
        size="icon"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
};

export default MessageInput;