import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMultiChat } from '@/hooks/useMultiChat';
import { useToast } from '@/hooks/use-toast';
import ConversationList from '@/components/ConversationList';
import MessageList from '@/components/MessageList';
import EnhancedMessageInput from '@/components/EnhancedMessageInput';


const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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
  } = useMultiChat();

  // Get current aircraft state
  const currentState = getCurrentState();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
        // Create a new conversation
        const conversation = await createConversation("New Chat", currentAircraftModel);
        if (conversation) {
          console.log('✅ New conversation created:', conversation);
          await switchConversation(conversation, currentAircraftModel);
          // Send the message with current messages state
          await sendMessage(message, currentAircraftModel, updatedMessages);
        } else {
          console.error('❌ Failed to create conversation');
        }
      } else {
        console.log('📤 Sending message to existing conversation...');
        // Send message to existing conversation with current messages state
        await sendMessage(message, currentAircraftModel, updatedMessages);
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
    <div className="min-h-screen bg-background flex flex-col">
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
          <Tabs value={currentAircraftModel} onValueChange={switchAircraftModel} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-4 mb-4 shrink-0">
              <TabsTrigger value="A320">A320</TabsTrigger>
              <TabsTrigger value="A330">A330</TabsTrigger>
              <TabsTrigger value="A350">A350</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 mx-4 mb-4">
              <TabsContent value="A320" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  <MessageList messages={aircraftStates.A320.messages} isLoading={aircraftStates.A320.isLoading} aircraftModel="A320" />
                  <EnhancedMessageInput 
                    onSendMessage={handleSendMessage}
                    isLoading={aircraftStates.A320.isLoading}
                    placeholder={aircraftStates.A320.currentConversation ? "Ask me a question" : "Start a conversation - Send a message to begin chatting with your A320 AI assistant"}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="A330" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  <MessageList messages={aircraftStates.A330.messages} isLoading={aircraftStates.A330.isLoading} aircraftModel="A330" />
                  <EnhancedMessageInput 
                    onSendMessage={handleSendMessage}
                    isLoading={aircraftStates.A330.isLoading}
                    placeholder={aircraftStates.A330.currentConversation ? "Ask me a question" : "Start a conversation - Send a message to begin chatting with your A330 AI assistant"}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="A350" className="h-full m-0">
                <div className="border rounded-lg flex flex-col bg-card h-full">
                  <MessageList messages={aircraftStates.A350.messages} isLoading={aircraftStates.A350.isLoading} aircraftModel="A350" />
                  <EnhancedMessageInput 
                    onSendMessage={handleSendMessage}
                    isLoading={aircraftStates.A350.isLoading}
                    placeholder={aircraftStates.A350.currentConversation ? "Ask me a question" : "Start a conversation - Send a message to begin chatting with your A350 AI assistant"}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
