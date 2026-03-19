import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentBlock } from "@shared/schema";
import ContentBlockComponent from "@/components/course/content-block";
import { useLocation } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import InteractiveQuiz from "@/components/course/interactive-quiz";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  type: string;
  explanation?: string;
}

interface QuizContent {
  title: string;
  description: string;
  questions: QuizQuestion[];
  isGenerated?: boolean;
}

const normalizeQuizContent = (content?: Partial<QuizContent> | null): QuizContent => ({
  title: content?.title ?? "",
  description: content?.description ?? "",
  questions: content?.questions ?? [],
  isGenerated: content?.isGenerated ?? false,
});

export default function QuizEditor() {
  const params = useParams();
  const contentBlockId = params.contentBlockId as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [editedContent, setEditedContent] = useState<QuizContent | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);

  const { data: contentBlock, isLoading, error } = useQuery<ContentBlock>({
    queryKey: ["/api/content-blocks", contentBlockId],
    enabled: !!contentBlockId,
  });

  // Helper function to clean quiz titles from module names
  const cleanQuizTitle = (title: string) => {
    if (!title) return "";
    
    // Remove common module title patterns
    const patterns = [
      /^(.+?)\s+Quiz$/i,  // Remove "Quiz" suffix
      /^Core Concepts of (.+)$/i,  // Remove "Core Concepts of" prefix
      /^Introduction to (.+)$/i,  // Remove "Introduction to" prefix
      /^(.+?)\s+Knowledge Check$/i,  // Remove "Knowledge Check" suffix
      /^(.+?)\s+Assessment$/i,  // Remove "Assessment" suffix
    ];
    
    let cleanedTitle = title;
    for (const pattern of patterns) {
      const match = cleanedTitle.match(pattern);
      if (match) {
        cleanedTitle = match[1] || cleanedTitle;
        break;
      }
    }
    
    // If the cleaned title is too short or generic, use a default
    if (cleanedTitle.length < 3 || cleanedTitle.toLowerCase().includes('quiz')) {
      return "Quiz";
    }
    
    return cleanedTitle;
  };

  // Initialize edited content when contentBlock loads
  useEffect(() => {
    if (contentBlock) {
      const content = contentBlock.content;
      
      // Handle case where content is empty object or missing required fields
      const safeContent: QuizContent = content && typeof content === 'object' && !Array.isArray(content) && Object.keys(content).length > 0 
        ? normalizeQuizContent(content as Partial<QuizContent>)
        : normalizeQuizContent();
      
      // If no questions exist, initialize with one default question
      if (!safeContent.questions || safeContent.questions.length === 0) {
        const defaultContent = {
          ...safeContent,
          title: cleanQuizTitle(safeContent.title || "") || "",
          description: safeContent.description || "",
          questions: [{
            question: "",
            options: ["", "", "", ""],
            correctAnswer: "",
            type: "multiple-choice"
          }]
        };
        setEditedContent(defaultContent);
        lastSavedContentRef.current = JSON.stringify(defaultContent);
      } else {
        // Ensure all questions have the proper structure
        const normalizedQuestions = safeContent.questions.map((question: Partial<QuizQuestion>) => ({
          question: question.question || "",
          options: question.options || ["", "", "", ""],
          correctAnswer: question.correctAnswer || "",
          type: question.type || "multiple-choice",
          explanation: question.explanation || ""
        }));
        
        const normalizedContent = {
          ...safeContent,
          title: cleanQuizTitle(safeContent.title || "") || "",
          description: safeContent.description || "",
          questions: normalizedQuestions
        };
        
        setEditedContent(normalizedContent);
        lastSavedContentRef.current = JSON.stringify(normalizedContent);
      }
    }
  }, [contentBlock]);

  // Debounce the edited content for auto-save
  const debouncedContent = useDebounce(editedContent, 2000);

  const updateContentBlockMutation = useMutation({
    mutationFn: async (updatedContent: QuizContent) => {
      const response = await apiRequest("PUT", `/api/content-blocks/${contentBlockId}`, {
        content: updatedContent
      });
      return await response.json();
    },
    onSuccess: () => {
      // Don't invalidate queries for auto-save to prevent refetch loops
      // Only invalidate for manual saves
      setShowSuccessIndicator(true);
      setTimeout(() => setShowSuccessIndicator(false), 2000);
    },
    onError: (error: Error) => {
      console.error("Auto-save error:", error);
      // Only show error toast if it's not a network error or if it's been a while since last error
      if (!error.message?.includes('fetch')) {
      toast({
        title: "Error",
          description: "Failed to auto-save quiz. Please try again.",
        variant: "destructive",
      });
      }
    },
  });

  // Auto-save effect with better logic
  useEffect(() => {
    if (debouncedContent && contentBlock) {
      const currentContentString = JSON.stringify(debouncedContent);
      const lastSavedString = lastSavedContentRef.current;
      
      // Only save if content has actually changed and we're not already saving
      if (currentContentString !== lastSavedString && !updateContentBlockMutation.isPending) {
        updateContentBlockMutation.mutate(debouncedContent, {
          onSuccess: () => {
            lastSavedContentRef.current = currentContentString;
          }
        });
      }
    }
  }, [debouncedContent, contentBlock, updateContentBlockMutation]);

  const manualSaveMutation = useMutation({
    mutationFn: async (updatedContent: QuizContent) => {
      const response = await apiRequest("PUT", `/api/content-blocks/${contentBlockId}`, {
        content: updatedContent
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-blocks", contentBlockId] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules", contentBlock?.moduleId, "content-blocks"] });
      setShowSuccessIndicator(true);
      setTimeout(() => setShowSuccessIndicator(false), 2000);
      toast({
        title: "Success",
        description: "Quiz saved successfully!",
      });
    },
    onError: (error: Error) => {
      console.error("Manual save error:", error);
      toast({
        title: "Error",
        description: "Failed to save quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (editedContent) {
      manualSaveMutation.mutate(editedContent);
    }
  };

  const handleBack = () => {
    if (contentBlock?.moduleId) {
      setLocation(`/module/${contentBlock.moduleId}/content`);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Quiz</h1>
          <p className="text-muted-foreground mb-4">Failed to load the quiz: {error.message}</p>
          <p className="text-sm text-gray-500 mb-4">Content Block ID: {contentBlockId}</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Module
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading quiz editor...</p>
        </div>
      </div>
    );
  }

  if (!contentBlock) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Quiz Not Found</h1>
          <p className="text-muted-foreground mb-4">The quiz you're looking for doesn't exist.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Module
          </Button>
        </div>
      </div>
    );
  }

  if (contentBlock.type !== "quiz" && contentBlock.type !== "ai-quiz") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Not a Quiz</h1>
          <p className="text-muted-foreground mb-4">This content block is not a quiz.</p>
          <Button onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Module
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50 overflow-x-hidden">
        {/* Auto-save indicator */}
        {(updateContentBlockMutation.isPending || manualSaveMutation.isPending) && (
          <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-2 rounded-md text-sm z-50 opacity-90">
            Saving...
          </div>
        )}
        
        {/* Success indicator */}
        {showSuccessIndicator && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-3 py-2 rounded-md text-sm z-50 opacity-90">
            Saved
          </div>
        )}
        
        {/* Header with Save Button */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleBack}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Module
              </Button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-900">Quiz Editor</h1>
            </div>
            <Button
              onClick={handleSave}
              disabled={manualSaveMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {manualSaveMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Quiz
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Main Editor Content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          

          {/* Quiz Description */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quiz Description (Optional)
            </label>
            <textarea
              value={editedContent?.description || ""}
              onChange={(e) => {
                 setEditedContent((current) => normalizeQuizContent({ ...current, description: e.target.value }));
              }}
              placeholder="Describe what this quiz covers or any special instructions..."
              className="w-full text-gray-900 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Questions Section Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Questions</h2>
              <p className="text-sm text-gray-600">
                {editedContent?.questions?.length || 0} question{(editedContent?.questions?.length || 0) !== 1 ? 's' : ''}
              </p>
            </div>
            <Button
              onClick={() => {
                const currentQuestions = editedContent?.questions || [];
                const newQuestion = {
                  question: "",
                  options: ["", "", "", ""],
                  correctAnswer: "",
                  type: "multiple-choice"
                };
                setEditedContent((current) => normalizeQuizContent({
                  ...current,
                  questions: [...currentQuestions, newQuestion]
                }));
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              + Add Question
            </Button>
          </div>

          {/* Instructions */}
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Instructions:</strong> Enter your quiz title and questions below. Click the radio buttons to mark the correct answer for each question.
            </p>
          </div>

          {/* Preview Section */}
          {editedContent?.questions && editedContent.questions.length > 0 && editedContent.questions.some((q: any) => q.question && q.options?.some((opt: string) => opt.trim()) && q.correctAnswer) && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview Quiz</h3>
              <div className="bg-gray-50 p-6 rounded-lg border">
                <InteractiveQuiz
                  content={{
                    title: editedContent.title || "Quiz Preview",
                    description: editedContent.description || "",
                    questions: editedContent.questions.filter((q: any) => q.question && q.options?.some((opt: string) => opt.trim()) && q.correctAnswer)
                  }}
                  blockId={contentBlockId}
                  isPreviewMode={true}
                />
              </div>
            </div>
          )}

          {/* All Questions */}
          <div className="space-y-8">
            {(editedContent?.questions && editedContent.questions.length > 0 
              ? editedContent.questions 
              : [{
                  question: "",
                  options: ["", "", "", ""],
                  correctAnswer: "",
                  type: "multiple-choice"
                }]
            ).map((question: any, questionIndex: number) => (
              <div key={questionIndex} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                {/* Question Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                      Question {questionIndex + 1}
                    </span>
                    <span className="text-sm text-gray-500">
                      {question.type === 'multiple-choice' ? 'Multiple Choice' : question.type}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {(editedContent?.questions && editedContent.questions.length > 1) && (
                      <Button
                        onClick={() => {
                          const updatedQuestions = [...(editedContent?.questions || [])];
                          updatedQuestions.splice(questionIndex, 1);
                          setEditedContent((current) => normalizeQuizContent({ ...current, questions: updatedQuestions }));
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Question Content */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text
                  </label>
                  <textarea
                    value={question.question || ""}
                    onChange={(e) => {
                      const updatedQuestions = [...(editedContent?.questions || [])];
                      if (!updatedQuestions[questionIndex]) {
                        updatedQuestions[questionIndex] = { question: "", options: [], correctAnswer: "", type: "multiple-choice" };
                      }
                      updatedQuestions[questionIndex] = { ...updatedQuestions[questionIndex], question: e.target.value };
                      setEditedContent((current) => normalizeQuizContent({ ...current, questions: updatedQuestions }));
                    }}
                    placeholder="e.g., What is the capital of France?"
                    className="w-full text-lg font-medium text-gray-900 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                  />
                </div>

                {/* Answer Options */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Answer Options
                    </label>
                    <span className="text-xs text-gray-500">
                      Click the circle to mark the correct answer
                    </span>
                  </div>

                  {/* Answer Choices */}
                  <div className="space-y-3">
                    {(question.options || ["", "", "", ""]).map((option: string, optionIndex: number) => (
                      <div key={optionIndex} className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            const updatedQuestions = [...(editedContent?.questions || [])];
                            if (!updatedQuestions[questionIndex]) {
                              updatedQuestions[questionIndex] = { question: "", options: [], correctAnswer: "", type: "multiple-choice" };
                            }
                            updatedQuestions[questionIndex] = {
                              ...updatedQuestions[questionIndex],
                              correctAnswer: String.fromCharCode(65 + optionIndex)
                            };
                            setEditedContent((current) => normalizeQuizContent({ ...current, questions: updatedQuestions }));
                          }}
                          className={`w-6 h-6 border-2 rounded-full flex items-center justify-center transition-colors ${
                            question.correctAnswer === String.fromCharCode(65 + optionIndex) 
                              ? 'border-green-500 bg-green-500' 
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {question.correctAnswer === String.fromCharCode(65 + optionIndex) && (
                            <div className="w-3 h-3 bg-white rounded-full"></div>
                          )}
                        </button>
                        <div className="flex-1 flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500 w-6">
                            {String.fromCharCode(65 + optionIndex)}.
                          </span>
                          <textarea
                            value={option}
                            onChange={(e) => {
                              const updatedQuestions = [...(editedContent?.questions || [])];
                              if (!updatedQuestions[questionIndex]) {
                                updatedQuestions[questionIndex] = { question: "", options: [], correctAnswer: "", type: "multiple-choice" };
                              }
                              const updatedOptions = [...(question.options || ["", "", "", ""])];
                              updatedOptions[optionIndex] = e.target.value;
                              updatedQuestions[questionIndex] = { ...updatedQuestions[questionIndex], options: updatedOptions };
                              setEditedContent((current) => normalizeQuizContent({ ...current, questions: updatedQuestions }));
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                            className="flex-1 text-gray-900 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            rows={1}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
      </div>
        </div>
      </div>
    </DndProvider>
  );
}
