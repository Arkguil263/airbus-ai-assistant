import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AssistantSettings from '@/components/AssistantSettings';

interface SettingsDialogProps {
  assistantId: string;
  onAssistantIdChange: (id: string) => void;
}

const SettingsDialog = ({ assistantId, onAssistantIdChange }: SettingsDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="assistants" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="assistants">Aircraft Assistants</TabsTrigger>
          </TabsList>
          <TabsContent value="assistants">
            <AssistantSettings />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;