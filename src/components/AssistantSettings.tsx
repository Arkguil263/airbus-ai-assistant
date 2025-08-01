import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Plane } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AssistantConfig {
  id: string;
  aircraft_model: string;
  assistant_id: string;
}

const AssistantSettings = () => {
  const [configs, setConfigs] = useState<AssistantConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const aircraftModels = [
    { code: 'A320', name: 'Airbus A320' },
    { code: 'A330', name: 'Airbus A330' },
    { code: 'A350', name: 'Airbus A350' }
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('aircraft_assistants')
        .select('*')
        .order('aircraft_model');

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Error loading configs:', error);
      toast({
        title: "Error",
        description: "Failed to load assistant configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAssistantId = (aircraftModel: string, assistantId: string) => {
    setConfigs(prev => prev.map(config => 
      config.aircraft_model === aircraftModel 
        ? { ...config, assistant_id: assistantId }
        : config
    ));
  };

  const validateAssistantId = (assistantId: string): boolean => {
    return assistantId.startsWith('asst_') && assistantId.length > 5;
  };

  const saveConfig = async (aircraftModel: string) => {
    const config = configs.find(c => c.aircraft_model === aircraftModel);
    if (!config) return;

    if (!validateAssistantId(config.assistant_id)) {
      toast({
        title: "Invalid Assistant ID",
        description: "Assistant ID must start with 'asst_' and be valid",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('aircraft_assistants')
        .update({ assistant_id: config.assistant_id })
        .eq('aircraft_model', aircraftModel);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${aircraftModel} assistant ID updated successfully`,
      });
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Error",
        description: "Failed to save assistant configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please sign in to manage assistant settings.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading assistant configurations...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          Aircraft Assistant Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {aircraftModels.map(aircraft => {
          const config = configs.find(c => c.aircraft_model === aircraft.code);
          return (
            <div key={aircraft.code} className="space-y-3 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{aircraft.name}</h3>
                <Button 
                  size="sm" 
                  onClick={() => saveConfig(aircraft.code)}
                  disabled={saving}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`assistant-${aircraft.code}`}>
                  OpenAI Assistant ID
                </Label>
                <Input
                  id={`assistant-${aircraft.code}`}
                  value={config?.assistant_id || ''}
                  onChange={(e) => updateAssistantId(aircraft.code, e.target.value)}
                  placeholder="asst_..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Find your Assistant ID in the OpenAI Platform dashboard
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AssistantSettings;