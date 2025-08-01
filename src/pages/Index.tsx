import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';
import { useToast } from '@/hooks/use-toast';
import ConversationList from '@/components/ConversationList';
import MessageList from '@/components/MessageList';
import MessageInput from '@/components/MessageInput';


const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    currentAircraftModel,
    createConversation,
    sendMessage,
    switchConversation,
    deleteConversation,
    switchAircraftModel,
  } = useChat();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleSendMessage = async (message: string) => {
    if (!currentConversation) {
      // Create a new conversation
      const conversation = await createConversation("New Chat");
      if (conversation) {
        await switchConversation(conversation);
        // Send message after switching
        setTimeout(async () => {
          try {
            await sendMessage(message);
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to send message. Please try again.",
              variant: "destructive",
            });
          }
        }, 100);
      }
    } else {
      try {
        await sendMessage(message);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
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
          <h1 className="text-4xl font-bold mb-4">Welcome to Your Chat Agent</h1>
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
            
            <h1 className="text-xl font-bold">Chat Agent</h1>
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
          <Tabs value={currentAircraftModel} onValueChange={switchAircraftModel} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
              <TabsTrigger value="A320">A320</TabsTrigger>
              <TabsTrigger value="A330">A330</TabsTrigger>
              <TabsTrigger value="A350">A350</TabsTrigger>
            </TabsList>
            
            <TabsContent value="A320" className="mx-4 mb-4">
              <div className="border rounded-lg flex flex-col bg-card" style={{ height: 'calc(100vh - 200px)' }}>
                <MessageList messages={messages} isLoading={isLoading} />
                <MessageInput 
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  placeholder={currentConversation ? "Type your message..." : "Start a conversation - Send a message to begin chatting with your A320 AI assistant"}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="A330" className="mx-4 mb-4">
              <div className="border rounded-lg flex flex-col bg-card" style={{ height: 'calc(100vh - 200px)' }}>
                <MessageList messages={messages} isLoading={isLoading} />
                <MessageInput 
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  placeholder={currentConversation ? "Type your message..." : "Start a conversation - Send a message to begin chatting with your A330 AI assistant"}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="A350" className="mx-4 mb-4">
              <div className="border rounded-lg flex flex-col bg-card" style={{ height: 'calc(100vh - 200px)' }}>
                <MessageList messages={messages} isLoading={isLoading} />
                <MessageInput 
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  placeholder={currentConversation ? "Type your message..." : "Start a conversation - Send a message to begin chatting with your A350 AI assistant"}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
