import { useEffect, useState } from 'react';

interface VoiceAnimationProps {
  isVisible: boolean;
  aircraftModel?: string;
}

const VoiceAnimation = ({ isVisible, aircraftModel = 'A320' }: VoiceAnimationProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {/* Background overlay with subtle opacity */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm animate-fade-in" />
      
      {/* Main animation container */}
      <div className="relative flex flex-col items-center justify-center animate-scale-in">
        {/* Siri-like wave animation */}
        <div className="relative flex items-center justify-center">
          {/* Center circle */}
          <div className="w-16 h-16 bg-primary rounded-full animate-pulse" />
          
          {/* Animated waves */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 border-2 border-primary/40 rounded-full animate-ping" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-28 h-28 border-2 border-primary/20 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-36 h-36 border-2 border-primary/10 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
          </div>
          
          {/* Audio bars animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.sin(Date.now() / 200 + i) * 8}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.6s'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Text indicator */}
        <div className="mt-6 px-6 py-3 bg-card/90 backdrop-blur-sm rounded-full border border-border/50 animate-fade-in">
          <p className="text-sm font-medium text-foreground flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>{aircraftModel === "Briefing" ? "Briefing AI" : `${aircraftModel} AI`} is speaking...</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceAnimation;