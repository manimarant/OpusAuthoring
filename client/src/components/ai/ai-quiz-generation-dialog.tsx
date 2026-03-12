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

const aiQuizGenerationFormSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  questionCount: z.number().min(1).max(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionTypes: z.array(z.enum(["multiple-choice", "true-false", "short-answer"])).min(1, "At least one question type is required"),
  includeCourseContext: z.boolean().default(true),
});

type AiQuizGenerationForm = z.infer<typeof aiQuizGenerationFormSchema>;
type QuizQuestionType = AiQuizGenerationForm["questionTypes"][number];
const questionTypeOptions: Array<{ value: QuizQuestionType; label: string }> = [
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "true-false", label: "True/False" },
  { value: "short-answer", label: "Short Answer" },
];

interface AiQuizGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  onQuizGenerated: (questions: any[]) => void;
  defaultPrompt?: string;
}

export default function AiQuizGenerationDialog({
  open,
  onOpenChange,
  moduleId,
  onQuizGenerated,
  defaultPrompt = "",
}: AiQuizGenerationDialogProps) {
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [generationMetadata, setGenerationMetadata] = useState<{
    provider: string;
    model: string;
    tokensUsed?: number;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<AiQuizGenerationForm>({
    resolver: zodResolver(aiQuizGenerationFormSchema),
    defaultValues: {
      prompt: defaultPrompt,
      questionCount: 3,
      difficulty: "medium",
      questionTypes: ["multiple-choice"],
      includeCourseContext: true,
    },
  });

  const generateQuizMutation = useMutation({
    mutationFn: async (data: AiQuizGenerationForm) => {
      const response = await apiRequest("POST", "/api/ai/generate-quiz", {
        moduleId,
        ...data,
      });
      const jsonData = await response.json();
      return jsonData as {
        questions: any[];
        provider: string;
        model: string;
        tokensUsed?: number;
      };
    },
    onSuccess: (data) => {
      setGeneratedQuestions(data.questions);
      setGenerationMetadata({
        provider: data.provider,
        model: data.model,
        tokensUsed: data.tokensUsed,
      });
      toast({
        title: "Quiz generated successfully",
        description: `Generated ${data.questions.length} questions using ${data.model}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate quiz",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AiQuizGenerationForm) => {
    generateQuizMutation.mutate(data);
  };

  const handleUseQuestions = () => {
    // Transform AI-generated questions to match quiz editor format
    const transformedQuestions = generatedQuestions.map((question, index) => {
      let correctAnswer = "";
      
      // Convert correctAnswer from text to letter format (A, B, C, D)
      if (question.correctAnswer && question.options) {
        const correctIndex = question.options.findIndex((option: string) => 
          option === question.correctAnswer || option.includes(question.correctAnswer)
        );
        if (correctIndex !== -1) {
          correctAnswer = String.fromCharCode(65 + correctIndex);
        }
      }
      
      return {
        ...question,
        correctAnswer,
        // Ensure we have proper options array
        options: question.options || ["", "", "", ""]
      };
    });
    
    onQuizGenerated(transformedQuestions);
    onOpenChange(false);
    setGeneratedQuestions([]);
    setGenerationMetadata(null);
    form.reset();
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedQuestions([]);
    setGenerationMetadata(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI Quiz Generator
          </DialogTitle>
          <DialogDescription>
            Generate interactive quiz questions using AI. Describe the topic or content you want to quiz learners on.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quiz Topic</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the topic or content you want to create quiz questions for. For example: 'Create questions about JavaScript functions and closures' or 'Test understanding of photosynthesis process'"
                      className="min-h-[100px]"
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
                name="questionCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Questions</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select difficulty" />
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
            </div>

            <FormField
              control={form.control}
              name="questionTypes"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Question Types</FormLabel>
                  </div>
                  <div className="space-y-2">
                    {questionTypeOptions.map((type) => (
                      <FormField
                        key={type.value}
                        control={form.control}
                        name="questionTypes"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={type.value}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(type.value)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, type.value])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== type.value
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">
                                {type.label}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="includeCourseContext"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Include course context
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Use course title, topic, and learning objectives to generate more relevant questions
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {generatedQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Generated Questions</h3>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto">
                    {generatedQuestions.map((question, index) => (
                      <div key={question.id || index} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-sm font-medium text-blue-600">
                            Q{index + 1}
                          </span>
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                            {question.type}
                          </span>
                        </div>
                        <p className="font-medium mb-2">{question.question}</p>
                        {question.options && (
                          <div className="space-y-1 mb-2">
                            {question.options.map((option: string, optIndex: number) => (
                              <div key={optIndex} className="text-sm text-gray-600 dark:text-gray-400">
                                {String.fromCharCode(65 + optIndex)}. {option}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-sm">
                          <span className="font-medium">Answer: </span>
                          <span className="text-green-600 dark:text-green-400">
                            {question.correctAnswer}
                          </span>
                        </div>
                        {question.explanation && (
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="font-medium">Explanation: </span>
                            {question.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {generatedQuestions.length > 0 && (
                <Button type="button" onClick={handleUseQuestions}>
                  Use These Questions
                </Button>
              )}
              <Button
                type="submit"
                disabled={generateQuizMutation.isPending}
                className="min-w-[120px]"
              >
                {generateQuizMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Quiz
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
