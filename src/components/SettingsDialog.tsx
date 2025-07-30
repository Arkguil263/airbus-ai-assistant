import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsDialogProps {
  assistantId: string;
  onAssistantIdChange: (id: string) => void;
}

const SettingsDialog = ({ assistantId, onAssistantIdChange }: SettingsDialogProps) => {
  const [tempAssistantId, setTempAssistantId] = useState(assistantId);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    if (tempAssistantId.trim()) {
      onAssistantIdChange(tempAssistantId.trim());
      setOpen(false);
      toast({
        title: "Settings saved",
        description: "Assistant ID has been updated",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assistant-id">OpenAI Assistant ID</Label>
            <Input
              id="assistant-id"
              value={tempAssistantId}
              onChange={(e) => setTempAssistantId(e.target.value)}
              placeholder="asst_..."
            />
            <p className="text-xs text-muted-foreground">
              Find your Assistant ID in the OpenAI Platform dashboard
            </p>
          </div>
          <Button onClick={handleSave} className="w-full gap-2">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;