import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Menu, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMultiChat } from '@/hooks/useMultiChat';
import { useToast } from '@/hooks/use-toast';
import { useBriefingCache } from '@/hooks/useBriefingCache';
import ConversationList from '@/components/ConversationList';
import MessageList from '@/components/MessageList';
import EnhancedMessageInput from '@/components/EnhancedMessageInput';
import VoiceEnabledMessageInput from '@/components/VoiceEnabledMessageInput';
import VoiceAgent from '@/components/VoiceAgent';
import VoiceAnimation from '@/components/VoiceAnimation';


const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('A320');
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  
  // Briefing cache functionality
  const { 
    isLoading: briefingLoading, 
    isCompleted: briefingCompleted, 
    autoFetchBriefing,
    getCachedBriefing,
    clearCache
  } = useBriefingCache();
  
  const {
    currentAircraftModel,
    aircraftStates,
    getCurrentState,
    createConversation,
    sendMessage,
    switchConversation,
    deleteConversation,
    switchAircraftModel,
    updateAircraftState,
    generateConversationTitle,
  } = useMultiChat();

  // Get current aircraft state
  const currentState = getCurrentState();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Auto-fetch briefing when user logs in
  useEffect(() => {
    if (user && !loading) {
      autoFetchBriefing(user.id);
    }
  }, [user, loading, autoFetchBriefing]);

  // Sync active tab with current aircraft model
  useEffect(() => {
    if (currentAircraftModel && currentAircraftModel !== activeTab) {
      setActiveTab(currentAircraftModel);
    }
  }, [currentAircraftModel]);

  const handleSendMessage = async (message: string) => {
    console.log('🚀 handleSendMessage called with:', message);
    console.log('🚀 Current aircraft model:', currentAircraftModel);
    console.log('🚀 Current conversation:', currentState.currentConversation);
    
    try {
      // Create user message
      const userMessage = {
        id: `temp-${Date.now()}`,
        role: 'user' as const,
        content: message,
        created_at: new Date().toISOString(),
        isPending: true
      };

      // Immediately add user message to state using functional update
      const currentMessages = getCurrentState().messages;
      const updatedMessages = [...currentMessages, userMessage];
      
      console.log('📝 Adding user message to state, total messages:', updatedMessages.length);
      
      updateAircraftState(currentAircraftModel, {
        messages: updatedMessages
      });
      
      // Handle conversation creation if needed and send message
      if (!currentState.currentConversation) {
        console.log('🆕 Creating new conversation...');
        // Create a new conversation with smart title
        const smartTitle = generateConversationTitle(currentAircraftModel);
        const conversation = await createConversation(smartTitle, currentAircraftModel);
        if (conversation) {
          console.log('✅ New conversation created:', conversation);
          await switchConversation(conversation, currentAircraftModel);
          // Send the message with conversation ID directly to avoid race condition
          await sendMessage(message, currentAircraftModel, updatedMessages, conversation);
        } else {
          console.error('❌ Failed to create conversation');
        }
      } else {
        console.log('📤 Sending message to existing conversation...');
        // Send message to existing conversation with current messages state
        await sendMessage(message, currentAircraftModel, updatedMessages, currentState.currentConversation);
      }
    } catch (error) {
      console.error('❌ Error in handleSendMessage:', error);
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
      
      // Remove pending message on error
      const currentMessages = getCurrentState().messages;
      const cleanMessages = currentMessages.filter(m => !m.isPending);
      updateAircraftState(currentAircraftModel, {
        messages: cleanMessages
      });
    }
  };

  const handleVoiceMessage = async (voiceMessage: { role: 'user' | 'assistant'; content: string; isVoice?: boolean }) => {
    try {
      const messageData = {
        id: `voice-${voiceMessage.role}-${Date.now()}`,
        role: voiceMessage.role,
        content: voiceMessage.content,
        created_at: new Date().toISOString(),
        isVoice: voiceMessage.isVoice
      };

      // Add voice message to current state - always append to preserve history
      updateAircraftState(currentAircraftModel, (prevState) => ({
        messages: [...prevState.messages, messageData]
      }));

      console.log('✅ Voice message added to chat history:', {
        role: voiceMessage.role,
        content: voiceMessage.content.substring(0, 50) + '...',
        totalMessages: getCurrentState().messages.length + 1
      });

    } catch (error) {
      console.error('❌ Error handling voice message:', error);
      toast({
        title: "Error",
        description: "Failed to process voice message",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold mb-4">Welcome to Airbus AI</h1>
          <p className="text-xl text-muted-foreground mb-6">Sign in to start chatting</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <ConversationList onClose={() => setSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
            
            <img 
              src="/airbus-logo.svg" 
              alt="Airbus AI"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                console.log('Image failed to load:', e);
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
              onLoad={() => console.log('Image loaded successfully')}
            />
            <h1 className="text-xl font-bold hidden">Airbus AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user.email}
            </span>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-80 border-r border-border">
          <ConversationList />
        </div>

        {/* Main content area with tabs */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value);
            if (value === 'A320' || value === 'A330' || value === 'A350' || value === 'Briefing') {
              switchAircraftModel(value);
            }
          }} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 mx-2 sm:mx-4 mt-4 mb-4 shrink-0 min-w-0">
              <TabsTrigger value="A320" className="text-xs sm:text-sm min-w-0 px-2 sm:px-3">A320</TabsTrigger>
              <TabsTrigger value="A330" className="text-xs sm:text-sm min-w-0 px-2 sm:px-3">A330</TabsTrigger>
              <TabsTrigger value="A350" className="text-xs sm:text-sm min-w-0 px-2 sm:px-3">A350</TabsTrigger>
              <TabsTrigger value="Briefing" className="text-xs sm:text-sm min-w-0 px-2 sm:px-3 relative">
                Briefing
                <CheckCircle className={`h-3 w-3 absolute -top-1 -right-1 ${
                  briefingCompleted ? 'text-green-500' : 'text-gray-400'
                }`} />
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 mx-2 sm:mx-4 mb-4">
              <TabsContent value="A320" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  <MessageList messages={aircraftStates.A320.messages} isLoading={aircraftStates.A320.isLoading} aircraftModel="A320" />
                  <VoiceEnabledMessageInput 
                    onSendMessage={(message) => {
                      handleSendMessage(message);
                    }}
                    onVoiceMessage={(voiceMessage) => {
                      handleVoiceMessage(voiceMessage);
                    }}
                    onSpeakingChange={setIsVoiceSpeaking}
                    isLoading={aircraftStates.A320.isLoading}
                    placeholder="Ask me a question"
                    aircraftModel="A320"
                    assistantId="A320-assistant"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="A330" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  <MessageList messages={aircraftStates.A330.messages} isLoading={aircraftStates.A330.isLoading} aircraftModel="A330" />
                  <VoiceEnabledMessageInput 
                    onSendMessage={(message) => {
                      handleSendMessage(message);
                    }}
                    onVoiceMessage={(voiceMessage) => {
                      handleVoiceMessage(voiceMessage);
                    }}
                    onSpeakingChange={setIsVoiceSpeaking}
                    isLoading={aircraftStates.A330.isLoading}
                    placeholder="Ask me a question"
                    aircraftModel="A330"
                    assistantId="A330-assistant"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="A350" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  <MessageList messages={aircraftStates.A350.messages} isLoading={aircraftStates.A350.isLoading} aircraftModel="A350" />
                  <VoiceEnabledMessageInput 
                    onSendMessage={(message) => {
                      handleSendMessage(message);
                    }}
                    onVoiceMessage={(voiceMessage) => {
                      handleVoiceMessage(voiceMessage);
                    }}
                    onSpeakingChange={setIsVoiceSpeaking}
                    isLoading={aircraftStates.A350.isLoading}
                    placeholder="Ask me a question"
                    aircraftModel="A350"
                    assistantId="A350-assistant"
                  />
                </div>
              </TabsContent>

              <TabsContent value="Briefing" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  {/* Briefing Status Button */}
                   <div className="p-4 border-b space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (user) {
                          // Clear cache first, then fetch fresh data
                          clearCache();
                          autoFetchBriefing(user.id);
                        }
                      }}
                      disabled={briefingLoading}
                      className={`w-full transition-colors ${
                        briefingCompleted 
                          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <CheckCircle className={`h-4 w-4 mr-2 ${
                        briefingCompleted ? 'text-green-500' : 'text-gray-400'
                      }`} />
                      {briefingCompleted 
                        ? 'Flight briefing cached - Click to refresh' 
                        : briefingLoading 
                          ? 'Loading flight briefing...' 
                          : 'Click to fetch flight briefing'
                      }
                    </Button>
                    
                    {briefingCompleted && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const cachedData = getCachedBriefing();
                          if (cachedData) {
                            // Create a message with the cached data
                            const briefingMessage = {
                              id: `cached-briefing-${Date.now()}`,
                              role: 'assistant' as const,
                              content: cachedData,
                              created_at: new Date().toISOString(),
                              isCachedBriefing: true
                            };
                            
                            // Add to briefing messages
                            updateAircraftState('Briefing', (prevState) => ({
                              messages: [...prevState.messages, briefingMessage]
                            }));
                          }
                        }}
                        className="w-full bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      >
                        Show Cached Briefing Data
                      </Button>
                    )}
                  </div>
                  
                  <MessageList messages={aircraftStates.Briefing.messages} isLoading={aircraftStates.Briefing.isLoading} aircraftModel="Briefing" />
                  <VoiceEnabledMessageInput 
                    onSendMessage={(message) => {
                      handleSendMessage(message);
                    }}
                    onVoiceMessage={(voiceMessage) => {
                      handleVoiceMessage(voiceMessage);
                    }}
                    onSpeakingChange={setIsVoiceSpeaking}
                    isLoading={aircraftStates.Briefing.isLoading}
                    placeholder="Ask about flight briefings, weather, NOTAMs..."
                    aircraftModel="Briefing"
                    assistantId="Briefing-assistant"
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Voice Animation Overlay */}
      <VoiceAnimation 
        isVisible={isVoiceSpeaking} 
        aircraftModel={activeTab.includes('A3') ? activeTab : 'AI'} 
      />
    </div>
  );
};

export default Index;
