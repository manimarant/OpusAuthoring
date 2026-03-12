import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Copy, RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const aiGenerationFormSchema = z.object({
  type: z.enum(['explanation', 'summary', 'example', 'steps', 'bullets']),
  prompt: z.string().min(1, 'Prompt is required'),
  tone: z.enum(['neutral', 'friendly', 'formal']).optional(),
  readingLevel: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeCourseContext: z.boolean().default(false),
});

type AiGenerationForm = z.infer<typeof aiGenerationFormSchema>;

interface AiGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  onContentGenerated: (content: string, action: 'replace' | 'append' | 'new') => void;
  currentContent?: string;
}

export default function AiGenerationDialog({
  open,
  onOpenChange,
  moduleId,
  onContentGenerated,
  currentContent
}: AiGenerationDialogProps) {
  const [generatedContent, setGeneratedContent] = useState<string>("");
  const [generationMetadata, setGenerationMetadata] = useState<{
    provider: string;
    model: string;
    tokensUsed?: number;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<AiGenerationForm>({
    resolver: zodResolver(aiGenerationFormSchema),
    defaultValues: {
      type: 'explanation',
      tone: 'neutral',
      readingLevel: 'intermediate',
      length: 'medium',
      includeCourseContext: true,
    },
  });

  const generateContentMutation = useMutation({
    mutationFn: async (data: AiGenerationForm) => {
      const response = await apiRequest("POST", "/api/ai/generate-text", {
        moduleId,
        ...data,
        style: {
          tone: data.tone,
          readingLevel: data.readingLevel,
        },
      });
      const jsonData = await response.json();
      return jsonData as {
        text: string;
        provider: string;
        model: string;
        tokensUsed?: number;
      };
    },
    onSuccess: (data) => {
      setGeneratedContent(data.text);
      setGenerationMetadata({
        provider: data.provider,
        model: data.model,
        tokensUsed: data.tokensUsed,
      });
      toast({
        title: "Content generated successfully",
        description: `Generated using ${data.model}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate content",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AiGenerationForm) => {
    generateContentMutation.mutate(data);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({
      title: "Copied to clipboard",
      description: "Generated content copied to clipboard",
    });
  };

  const handleRegenerate = () => {
    const formData = form.getValues();
    generateContentMutation.mutate(formData);
  };

  const handleUseContent = (action: 'replace' | 'append' | 'new') => {
    onContentGenerated(generatedContent, action);
    onOpenChange(false);
    setGeneratedContent("");
    setGenerationMetadata(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-ai-generation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Generate AI Content
          </DialogTitle>
          <DialogDescription>
            Create educational content using AI. Specify your requirements and generate content tailored to your course.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generation Form */}
          <div className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-content-type">
                            <SelectValue placeholder="Select content type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="explanation">Explanation</SelectItem>
                          <SelectItem value="summary">Summary</SelectItem>
                          <SelectItem value="example">Example</SelectItem>
                          <SelectItem value="steps">Step-by-step</SelectItem>
                          <SelectItem value="bullets">Bullet Points</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt / Topic</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what you want to generate content about..."
                          className="min-h-[100px]"
                          data-testid="textarea-prompt"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-tone">
                              <SelectValue placeholder="Select tone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="readingLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reading Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-reading-level">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Content Length</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                          data-testid="radio-length"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="short" id="short" />
                            <label htmlFor="short">Short</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="medium" id="medium" />
                            <label htmlFor="medium">Medium</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="long" id="long" />
                            <label htmlFor="long">Long</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includeCourseContext"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Include Course Context</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Use course information to make content more relevant
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-course-context"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={generateContentMutation.isPending}
                  className="w-full"
                  data-testid="button-generate"
                >
                  {generateContentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Content
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          {/* Generated Content Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generated Content</h3>
              {generationMetadata && (
                <Badge variant="secondary" data-testid="badge-generation-info">
                  {generationMetadata.model}
                  {generationMetadata.tokensUsed && ` • ${generationMetadata.tokensUsed} tokens`}
                </Badge>
              )}
            </div>

            {generateContentMutation.isPending && (
              <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                  <p className="text-sm text-muted-foreground">Generating content...</p>
                </div>
              </div>
            )}

            {generatedContent && (
              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  <div className="whitespace-pre-wrap text-sm" data-testid="text-generated-content">
                    {generatedContent}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyToClipboard}
                    data-testid="button-copy"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerate}
                    disabled={generateContentMutation.isPending}
                    data-testid="button-regenerate"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Use this content:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUseContent('replace')}
                      data-testid="button-replace"
                    >
                      Replace Current Text
                    </Button>
                    {currentContent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUseContent('append')}
                        data-testid="button-append"
                      >
                        Append to Current
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUseContent('new')}
                      data-testid="button-new-block"
                    >
                      Create New Block
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}