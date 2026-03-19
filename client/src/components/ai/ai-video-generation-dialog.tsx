import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Play, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const aiVideoGenerationFormSchema = z.object({
  chapterTitle: z.string().min(1, "Chapter is required"),
  duration: z.enum(["short", "medium", "long"]).default("medium"),
  style: z.enum(["professional", "casual", "educational", "animated"]).default("educational"),
  voiceType: z.enum(["male", "female", "neutral"]).default("neutral"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
});

type AiVideoGenerationForm = z.infer<typeof aiVideoGenerationFormSchema>;

type ChapterOption = {
  title: string;
  moduleTitle?: string;
  sourceText?: string;
};

type VideoGenerationResult = {
  videoUrl: string;
  videoId: string;
  duration: number;
  chapterTitle: string;
  suggestedNarration?: string;
};

interface AiVideoGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  chapterOptions: ChapterOption[];
  defaultChapterTitle?: string;
  onVideoGenerated: (video: {
    videoUrl: string;
    videoId: string;
    chapterTitle: string;
    duration: number;
  }) => void;
}

export default function AiVideoGenerationDialog({
  open,
  onOpenChange,
  moduleId,
  chapterOptions,
  defaultChapterTitle,
  onVideoGenerated,
}: AiVideoGenerationDialogProps) {
  const { toast } = useToast();

  const form = useForm<AiVideoGenerationForm>({
    resolver: zodResolver(aiVideoGenerationFormSchema),
    defaultValues: {
      chapterTitle: defaultChapterTitle || chapterOptions[0]?.title || "",
      duration: "medium",
      style: "educational",
      voiceType: "neutral",
      aspectRatio: "16:9",
    },
  });

  const selectedChapterTitle = form.watch("chapterTitle");
  const selectedChapter = chapterOptions.find((chapter) => chapter.title === selectedChapterTitle) ?? chapterOptions[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      chapterTitle: defaultChapterTitle || chapterOptions[0]?.title || "",
      duration: "medium",
      style: "educational",
      voiceType: "neutral",
      aspectRatio: "16:9",
    });
  }, [chapterOptions, defaultChapterTitle, form, open]);

  const generateVideoMutation = useMutation({
    mutationFn: async (data: AiVideoGenerationForm) => {
      const chapter = chapterOptions.find((option) => option.title === data.chapterTitle);
      const response = await apiRequest("POST", `/api/modules/${moduleId}/generate-complete-video`, {
        chapterTitle: data.chapterTitle,
        moduleTitle: chapter?.moduleTitle,
        sourceText: chapter?.sourceText,
        duration: data.duration,
        style: data.style,
        voiceType: data.voiceType,
        aspectRatio: data.aspectRatio,
      });

      return response.json() as Promise<VideoGenerationResult>;
    },
    onSuccess: (data) => {
      onVideoGenerated({
        videoUrl: data.videoUrl,
        videoId: data.videoId,
        chapterTitle: data.chapterTitle,
        duration: data.duration,
      });
      onOpenChange(false);
      toast({
        title: "AI video generated",
        description: `${data.chapterTitle} video is ready to use.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Video generation failed",
        description: error.message || "Unable to generate the Tavus video.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AiVideoGenerationForm) => {
    generateVideoMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-ai-video-generation">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-red-500" />
            Generate AI Video
          </DialogTitle>
          <DialogDescription>
            Generate a Tavus presenter video for a chapter. Video length is capped at 15 seconds.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="chapterTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chapter</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-ai-video-chapter">
                        <SelectValue placeholder="Select a chapter" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {chapterOptions.map((chapter) => (
                        <SelectItem key={chapter.title} value={chapter.title}>
                          {chapter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedChapter ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{selectedChapter.title}</div>
                    {selectedChapter.moduleTitle ? (
                      <div className="text-xs text-slate-500">{selectedChapter.moduleTitle}</div>
                    ) : null}
                  </div>
                  <Badge variant="secondary">Max 15s</Badge>
                </div>
                {selectedChapter.sourceText ? (
                  <Textarea
                    value={selectedChapter.sourceText}
                    readOnly
                    className="mt-3 min-h-[120px] resize-none border-slate-200 bg-white text-sm text-slate-600"
                  />
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Tavus will generate the video from the selected chapter title and available chapter description.
                  </p>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Length</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ai-video-duration">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="short">Short (5s)</SelectItem>
                        <SelectItem value="medium">Medium (10s)</SelectItem>
                        <SelectItem value="long">Long (15s)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aspect Ratio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ai-video-aspect-ratio">
                          <SelectValue placeholder="Select ratio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="16:9">16:9</SelectItem>
                        <SelectItem value="9:16">9:16</SelectItem>
                        <SelectItem value="1:1">1:1</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Style</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ai-video-style">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="educational">Educational</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="animated">Animated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voiceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voice</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-ai-video-voice">
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generateVideoMutation.isPending} data-testid="button-generate-ai-video">
                {generateVideoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate Video
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
