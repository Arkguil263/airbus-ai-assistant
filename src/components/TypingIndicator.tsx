import { useEffect, useState } from 'react';
import { Brain, Loader, Sparkles } from 'lucide-react';

interface TypingIndicatorProps {
  aircraftModel?: string;
}

const TypingIndicator = ({ aircraftModel }: TypingIndicatorProps) => {
  const [messageIndex, setMessageIndex] = useState(0);
  
  const messages = [
    'AI is thinking...',
    'Processing your request...',
    'Generating response...',
    aircraftModel ? `Your ${aircraftModel} assistant is analyzing...` : 'Analyzing your query...'
  ];

  const icons = [Brain, Sparkles, Loader];
  const [iconIndex, setIconIndex] = useState(0);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);

    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % icons.length);
    }, 1500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(iconInterval);
    };
  }, [messages.length]);

  const CurrentIcon = icons[iconIndex];

  return (
    <div className="flex gap-3 justify-start animate-fade-in-up">
      <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
        <CurrentIcon className="h-4 w-4 text-primary animate-spin-slow" />
      </div>
      <div className="bg-muted rounded-lg px-4 py-2">
        <div className="flex items-center space-x-2">
          <span 
            className="text-sm text-muted-foreground animate-pulse-text"
            aria-live="polite" 
            aria-label="AI is processing your message"
          >
            {messages[messageIndex]}
          </span>
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;