import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare, Plus } from 'lucide-react';
import { useMultiChat } from '@/hooks/useMultiChat';
import { useToast } from '@/hooks/use-toast';

interface ConversationListProps {
  onClose?: () => void;
}

const ConversationList = ({ onClose }: ConversationListProps) => {
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const { 
    currentAircraftModel, 
    aircraftStates, 
    getCurrentState, 
    createConversation, 
    deleteConversation, 
    switchConversation,
    switchAircraftModel,
    generateConversationTitle
  } = useMultiChat();
  
  // Get all conversations from all aircraft models
  const allConversations = Object.values(aircraftStates).flatMap(state => state.conversations);
  // Sort by updated_at descending
  const sortedConversations = allConversations.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  
  // Get current conversation from current aircraft model
  const currentState = getCurrentState();
  const { currentConversation } = currentState;
  const { toast } = useToast();

  const handleCreateConversation = async () => {
    if (!newTitle.trim()) return;

    const conversationId = await createConversation(newTitle.trim(), currentAircraftModel);
    if (conversationId) {
      switchConversation(conversationId, currentAircraftModel);
      setNewTitle('');
      setShowNewConversation(false);
      onClose?.();
      toast({
        title: "Conversation created",
        description: "New conversation started successfully",
      });
    }
  };

  const handleDeleteConversation = async (id: string, conversationAircraftModel: string) => {
    await deleteConversation(id, conversationAircraftModel);
    toast({
      title: "Conversation deleted",
      description: "Conversation has been removed",
    });
  };

  const handleSwitchConversation = async (id: string, conversationAircraftModel: string) => {
    console.log('🎯 Conversation clicked:', { 
      conversationId: id, 
      conversationAircraftModel,
      currentAircraftModel,
      conversationTitle: sortedConversations.find(c => c.id === id)?.title
    });
    
    try {
      // If conversation is from a different aircraft model, switch to that model first
      if (conversationAircraftModel !== currentAircraftModel) {
        console.log('🔄 Switching aircraft model from', currentAircraftModel, 'to', conversationAircraftModel);
        await switchAircraftModel(conversationAircraftModel);
        
        // Add a small delay to ensure the aircraft model switch completes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Switch to the conversation using the correct aircraft model
      await switchConversation(id, conversationAircraftModel);
      
      console.log('✅ Conversation switch completed, closing sidebar');
      onClose?.();
      
    } catch (error) {
      console.error('❌ Error switching conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation messages",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            size="sm"
            onClick={() => {
              setShowNewConversation(true);
              setNewTitle(generateConversationTitle(currentAircraftModel));
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        {showNewConversation && (
          <div className="space-y-2">
            <Input
              placeholder="Conversation title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateConversation()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateConversation}>
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewConversation(false);
                  setNewTitle('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {sortedConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs">Create a new conversation to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    currentConversation === conversation.id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => handleSwitchConversation(conversation.id, conversation.aircraft_model)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium truncate text-sm">
                        {conversation.title || 'Untitled Conversation'}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        conversation.aircraft_model === currentAircraftModel 
                          ? 'bg-primary/10 text-primary border-primary/20' 
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {conversation.aircraft_model}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conversation.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conversation.id, conversation.aircraft_model);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default ConversationList;