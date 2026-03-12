import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

const aiAssignmentGenerationFormSchema = z.object({
  prompt: z.string().min(1, "Assignment description is required"),
  taskCount: z.number().min(1).max(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  assignmentType: z.enum(["project", "research", "practical", "reflection", "mixed"]),
  includeRubric: z.boolean().default(true),
  includeCourseContext: z.boolean().default(true),
});

type AiAssignmentGenerationForm = z.infer<typeof aiAssignmentGenerationFormSchema>;

interface AiAssignmentGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  onAssignmentGenerated: (assignment: any) => void;
  defaultPrompt?: string;
}

export default function AiAssignmentGenerationDialog({
  open,
  onOpenChange,
  moduleId,
  onAssignmentGenerated,
  defaultPrompt = "",
}: AiAssignmentGenerationDialogProps) {
  const [generatedAssignment, setGeneratedAssignment] = useState<any>(null);
  const [generationMetadata, setGenerationMetadata] = useState<{
    provider: string;
    model: string;
    tokensUsed?: number;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<AiAssignmentGenerationForm>({
    resolver: zodResolver(aiAssignmentGenerationFormSchema),
    defaultValues: {
      prompt: defaultPrompt,
      taskCount: 3,
      difficulty: "medium",
      assignmentType: "project",
      includeRubric: true,
      includeCourseContext: true,
    },
  });

  const generateAssignmentMutation = useMutation({
    mutationFn: async (data: AiAssignmentGenerationForm) => {
      const response = await apiRequest("POST", "/api/ai/generate-assignment", {
        moduleId,
        ...data,
      });
      const jsonData = await response.json();
      return jsonData as {
        assignment: any;
        provider: string;
        model: string;
        tokensUsed?: number;
      };
    },
    onSuccess: (data) => {
      setGeneratedAssignment(data.assignment);
      setGenerationMetadata({
        provider: data.provider,
        model: data.model,
        tokensUsed: data.tokensUsed,
      });
      toast({
        title: "Assignment Generated",
        description: "Your AI assignment has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate assignment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AiAssignmentGenerationForm) => {
    generateAssignmentMutation.mutate(data);
  };

  const handleInsertAssignment = () => {
    if (generatedAssignment) {
      onAssignmentGenerated(generatedAssignment);
      onOpenChange(false);
      // Reset form
      form.reset();
      setGeneratedAssignment(null);
      setGenerationMetadata(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Generate AI Assignment
          </DialogTitle>
          <DialogDescription>
            Create an assignment that helps students apply course concepts
          </DialogDescription>
        </DialogHeader>

        {!generatedAssignment ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Assignment Description */}
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignment Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what the assignment should cover. Include key topics, skills to develop, and learning outcomes..."
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Difficulty Level */}
                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty Level</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assignment Type */}
                <FormField
                  control={form.control}
                  name="assignmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignment Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="project">Project</SelectItem>
                          <SelectItem value="research">Research</SelectItem>
                          <SelectItem value="practical">Practical</SelectItem>
                          <SelectItem value="reflection">Reflection</SelectItem>
                          <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Task Count */}
              <FormField
                control={form.control}
                name="taskCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Tasks: {field.value}</FormLabel>
                    <FormControl>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Include Rubric */}
              <FormField
                control={form.control}
                name="includeRubric"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Include Grading Rubric</FormLabel>
                  </FormItem>
                )}
              />

              {/* Include Course Context */}
              <FormField
                control={form.control}
                name="includeCourseContext"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Include course context in generation
                    </FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={generateAssignmentMutation.isPending}
                  className="gap-2"
                >
                  {generateAssignmentMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {generateAssignmentMutation.isPending
                    ? "Generating..."
                    : "Generate Assignment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            {/* Preview of Generated Assignment */}
            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {generatedAssignment.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {generatedAssignment.description}
                </p>
              </div>

              {generatedAssignment.objectives && generatedAssignment.objectives.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Learning Objectives:</h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                    {generatedAssignment.objectives.slice(0, 3).map((obj: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-violet-600">•</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {generatedAssignment.tasks && generatedAssignment.tasks.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Tasks:</h4>
                  <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                    {generatedAssignment.tasks.slice(0, 3).map((task: any, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-violet-600">{i + 1}.</span>
                        <span>{task.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {generationMetadata && (
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                  Generated by {generationMetadata.model}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setGeneratedAssignment(null);
                  setGenerationMetadata(null);
                  generateAssignmentMutation.reset();
                }}
              >
                Regenerate
              </Button>
              <Button
                type="button"
                onClick={handleInsertAssignment}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Insert Assignment
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
