import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FileUploadProps {
  onAnalysisComplete: (analysis: string) => void;
}

export default function FileUpload({ onAnalysisComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    try {
      const filePromises = Array.from(files).map(async (file) => {
        // Convert file to base64 using FileReader to avoid stack overflow
        return new Promise<{name: string, content: string, type: string}>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]; // Remove data:mime;base64, prefix
            resolve({
              name: file.name,
              content: base64,
              type: file.type
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const fileData = await Promise.all(filePromises);

      // Upload files to OpenAI and get analysis
      const { data, error } = await supabase.functions.invoke('analyze-flight-files', {
        body: { 
          files: fileData
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const analysis = data?.analysis || 'No analysis available';
      const fileNames = fileData.map(f => f.name);
      
      setUploadedFiles(prev => [...prev, ...fileNames]);
      onAnalysisComplete(analysis);

      toast({
        title: "Analysis Complete",
        description: `${fileData.length} file(s) analyzed successfully`,
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <Input
            type="file"
            multiple
            accept=".pdf,.txt,.doc,.docx,.json,.xml"
            onChange={handleFileUpload}
            disabled={uploading}
            className="flex-1"
          />
          <Button disabled={uploading} className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {uploading ? 'Analyzing...' : 'Upload'}
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Upload flight plans, weather reports, and NOTAMs for AI analysis
        </div>

        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Analyzed Files:</div>
            {uploadedFiles.map((filename, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {filename}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}