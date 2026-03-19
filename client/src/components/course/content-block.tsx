import { Component, useState, useRef, useMemo, type ReactNode } from "react";
import { GripVertical, Sparkles, Trash2, Copy, MoveVertical, Play, Pause, Edit, ChevronDown, RotateCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SanitizedHTML } from "@/components/ui/sanitized-html";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentBlock } from "@shared/schema";
import InlineAiAssistant from "@/components/ai/inline-ai-assistant";
import AiQuizGenerationDialog from "@/components/ai/ai-quiz-generation-dialog";
import AiAssignmentGenerationDialog from "@/components/ai/ai-assignment-generation-dialog";
import InteractiveQuiz from "@/components/course/interactive-quiz";
import { useDebounce } from "../../hooks/use-debounce";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDrag, useDrop } from "react-dnd";
import type { Identifier } from "dnd-core";
import { getImageDisplayProps, generateContextualPlaceholderUrl } from "@/utils/image-generation";

interface ContentBlockComponentProps {
  contentBlock: ContentBlock;
  previewMode?: boolean;
  onMoveBlock?: (dragId: string, hoverId: string) => void;
}

interface BlockErrorBoundaryProps {
  children: ReactNode;
  blockId: string;
  blockType: string;
}

interface BlockErrorBoundaryState {
  hasError: boolean;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

class BlockErrorBoundary extends Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  state: BlockErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): BlockErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Content block render failed", {
      blockId: this.props.blockId,
      blockType: this.props.blockType,
      error,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          This block could not be displayed. Type: {this.props.blockType}
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ContentBlockComponent({ contentBlock, previewMode = false, onMoveBlock }: ContentBlockComponentProps) {
  const [editedContent, setEditedContent] = useState<Record<string, any>>(() => {
    return contentBlock.content && typeof contentBlock.content === 'object' ? contentBlock.content : {};
  });
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState<Record<number, boolean>>({});
  const [expandedAiQuestions, setExpandedAiQuestions] = useState(false);
  const [expandedAiOptions, setExpandedAiOptions] = useState<Record<number, boolean>>({});
  const [expandedAccordionItems, setExpandedAccordionItems] = useState<Record<number, boolean>>({});
  const [flippedFlashcards, setFlippedFlashcards] = useState<Record<number, boolean>>({});
  const [activeTimelineEvent, setActiveTimelineEvent] = useState(0);
  const [sortingAssignments, setSortingAssignments] = useState<Record<number, string>>({});
  const [draggedSortingIndex, setDraggedSortingIndex] = useState<number | null>(null);
  const [selectedSortingIndex, setSelectedSortingIndex] = useState<number | null>(null);
  const [sortingHoverCategory, setSortingHoverCategory] = useState<string | null>(null);
  const [sortingChecked, setSortingChecked] = useState(false);
  const [sortingFeedback, setSortingFeedback] = useState<Record<number, { category: string; text: string; isCorrect: boolean; leaving: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const debouncedContent = useDebounce(editedContent || {}, 2000);
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const lastSavedContentRef = useRef<string>('');
  const latestEditedContentRef = useRef<Record<string, any>>(editedContent);
  
  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }>({ isPlaying: false, currentTime: 0, duration: 0 });
  // Drag and drop setup
  const [{ handlerId }, drop] = useDrop<
    { id: string; type: string },
    void,
    { handlerId: Identifier | null }
  >({
    accept: "content-block",
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { id: string; type: string }) {
      if (!ref.current) {
        return;
      }
      const dragId = item.id;
      const hoverId = contentBlock.id;

      if (dragId === hoverId) {
        return;
      }
      if (onMoveBlock) {
        onMoveBlock(dragId, hoverId);
      }
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: "content-block",
    item: () => {
      return { id: contentBlock.id, type: "content-block" };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Connect drag handle to drag source, and drop to the entire block
  useEffect(() => {
    drop(ref);
    if (dragHandleRef.current) {
      drag(dragHandleRef);
    }
  }, [drag, drop]);

  useEffect(() => {
    latestEditedContentRef.current = editedContent;
  }, [editedContent]);

  const deleteContentBlockMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/content-blocks/${contentBlock.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", contentBlock.moduleId, "content-blocks"] });
      toast({
        title: "Block deleted",
        description: "Content block has been deleted successfully.",
      });
    },
  });

  const duplicateContentBlockMutation = useMutation({
    mutationFn: async (contentSnapshot: Record<string, any>) => {
      await apiRequest("PUT", `/api/content-blocks/${contentBlock.id}`, {
        content: contentSnapshot,
      });

      const response = await apiRequest("GET", `/api/modules/${contentBlock.moduleId}/content-blocks`);
      const blocks = (await response.json()) as ContentBlock[];
      const sortedBlocks = [...blocks].sort((a, b) => parseInt(a.order) - parseInt(b.order));
      const sourceIndex = sortedBlocks.findIndex((block) => block.id === contentBlock.id);
      const insertIndex = sourceIndex === -1 ? sortedBlocks.length : sourceIndex + 1;

      // Shift following blocks down so the duplicate is inserted immediately after the source block.
      await Promise.all(
        sortedBlocks
          .slice(insertIndex)
          .map((block, index) =>
            apiRequest("PUT", `/api/content-blocks/${block.id}`, {
              order: (insertIndex + index + 1).toString(),
            }),
          ),
      );

      const duplicateResponse = await apiRequest("POST", `/api/modules/${contentBlock.moduleId}/content-blocks`, {
        type: contentBlock.type,
        content: contentSnapshot,
        order: insertIndex.toString()
      });
      return duplicateResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", contentBlock.moduleId, "content-blocks"] });
      toast({
        title: "Block duplicated",
        description: "Content block has been duplicated successfully.",
      });
    },
  });

  const updateContentBlockMutation = useMutation({
    mutationFn: async (updatedContent: any) => {
      await apiRequest("PUT", `/api/content-blocks/${contentBlock.id}`, {
        content: updatedContent
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", contentBlock.moduleId, "content-blocks"] });
    },
    onError: (error) => {
      console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Failed to update content block:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-save when content changes
  useEffect(() => {
    try {
      if (debouncedContent && 
          contentBlock.content && 
          typeof debouncedContent === 'object' &&
          debouncedContent !== null &&
          !Array.isArray(debouncedContent) &&
          !isSaving &&
          !isAiGenerating) {
        const keys = Object.keys(debouncedContent);
        const currentContentString = JSON.stringify(debouncedContent);
        
        if (keys.length > 0 && 
            currentContentString !== JSON.stringify(contentBlock.content) &&
            currentContentString !== lastSavedContentRef.current) {
          setIsSaving(true);
          lastSavedContentRef.current = currentContentString;
          updateContentBlockMutation.mutate(debouncedContent, {
            onSettled: () => {
              setIsSaving(false);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error in auto-save useEffect:', error);
      setIsSaving(false);
    }
  }, [debouncedContent, contentBlock.content, updateContentBlockMutation, isSaving]);

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this block?")) {
      deleteContentBlockMutation.mutate();
    }
  };

  const handleDuplicate = () => {
    duplicateContentBlockMutation.mutate(
      JSON.parse(JSON.stringify(latestEditedContentRef.current)),
    );
  };

  const toggleAccordionItem = (index: number) => {
    setExpandedAccordionItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleFlashcard = (index: number) => {
    setFlippedFlashcards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const assignSortingItem = (index: number, category: string) => {
    const assignedItem = (Array.isArray(latestEditedContentRef.current.items) ? latestEditedContentRef.current.items : [])[index];
    const assignedText = typeof assignedItem === "string"
      ? assignedItem
      : String(assignedItem?.text || `Item ${index + 1}`);
    const correctCategory = typeof assignedItem === "string"
      ? ""
      : String(assignedItem?.category || "");
    const isCorrect = Boolean(correctCategory) && correctCategory === category;

    setSortingAssignments((prev) => ({
      ...prev,
      [index]: category,
    }));
    setSortingFeedback((prev) => ({
      ...prev,
      [index]: {
        category,
        text: assignedText,
        isCorrect,
        leaving: false,
      },
    }));
    setDraggedSortingIndex(null);
    setSelectedSortingIndex(null);
    setSortingHoverCategory(null);

    setTimeout(() => {
      setSortingFeedback((prev) => (
        prev[index]
          ? {
              ...prev,
              [index]: {
                ...prev[index],
                leaving: true,
              },
            }
          : prev
      ));
    }, 350);

    setTimeout(() => {
      setSortingFeedback((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }, 850);
  };

  const normalizedSortingItems = Array.isArray(editedContent.items)
    ? editedContent.items.map((item: any) =>
        typeof item === "string"
          ? { text: item, category: "" }
          : { text: String(item?.text || ""), category: String(item?.category || "") },
      )
    : [];
  const sortingCategories = Array.isArray(editedContent.categories)
    ? editedContent.categories.map((category: any) => String(category || ""))
    : [];
  
  // Audio playback handlers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (audioState.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setAudioState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };
  
  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    setAudioState(prev => ({
      ...prev,
      currentTime: audioRef.current!.currentTime,
      duration: audioRef.current!.duration || 0
    }));
  };
  
  const handleAudioEnded = () => {
    setAudioState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  };

  const getBlockIcon = (type: string) => {
    const icons: Record<string, string> = {
      text: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â",
      heading: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â°", 
      statement: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â¬",
      quote: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã‚Â­",
      image: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¼ÃƒÂ¯Ã‚Â¸Ã‚Â",
      gallery: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â¼ÃƒÂ¯Ã‚Â¸Ã‚Â",
      audio: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ",
      "ai-text": "ÃƒÂ°Ã…Â¸Ã‚Â¤Ã¢â‚¬â€œ",
      "ai-quiz": "",
      "ai-image": "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¨",
      "ai-audio": "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ…Â ",
      video: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¥",
      accordion: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¡",
      timeline: "ÃƒÂ¢Ã‚ÂÃ‚Â°",
      "labeled-graphic": "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯",
      scenario: "ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â­",
      flashcards: "ÃƒÂ°Ã…Â¸Ã†â€™Ã‚Â",
      quiz: "",
      list: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹",
      "process-flow": "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾",
      "sorting-activity": "ÃƒÂ¢Ã¢â‚¬Â -ÃƒÂ¯Ã‚Â¸Ã‚Â",
      continue: "ÃƒÂ¢Ã…Â¾Ã‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â",
    };
    return icons[type] || "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾";
  };

  const getBlockColor = (type: string) => {
    const colors: Record<string, string> = {
      text: "text-gray-600",
      heading: "text-slate-600",
      statement: "text-amber-600",
      quote: "text-indigo-600",
      image: "text-blue-600",
      gallery: "text-cyan-600",
      audio: "text-pink-600",
      "ai-text": "text-blue-600",
      "ai-quiz": "text-orange-600",
      "ai-image": "text-green-600",
      "ai-audio": "text-purple-600",
      video: "text-red-600",
      accordion: "text-teal-600",
      timeline: "text-emerald-600",
      "labeled-graphic": "text-rose-600",
      scenario: "text-violet-600",
      flashcards: "text-purple-600",
      quiz: "text-blue-600",
      list: "text-green-600",
      "process-flow": "text-orange-600",
      "sorting-activity": "text-indigo-600",
      continue: "text-sky-600",
    };
    return colors[type] || "text-gray-600";
  };

  // Helper: for quizzes, suppress any module-derived titles and generic "Quiz"
  const cleanQuizTitle = (title: string) => {
    if (!title) return "";
    const lowered = title.toLowerCase();
    // Patterns that imply it's derived from a module title or generic quiz label
    const derivedPatterns = [
      /\bquiz\b/i,
      /knowledge\s*check/i,
      /assessment/i,
      /^core\s+concepts\s+of\s+/i,
      /^introduction\s+to\s+/i,
    ];
    if (derivedPatterns.some((p) => p.test(title))) {
      return ""; // suppress completely
    }
    // If what's left is extremely short, also suppress
    if (lowered.trim().length < 3) return "";
    return title;
  };

  const getBlockTitle = (type: string) => {
    const titles: Record<string, string> = {
      text: "Text Block",
      "ai-text": "Text Block",
      heading: "Heading",
      statement: "Statement",
      quote: "Quote",
      image: "Image",
      gallery: "Image Gallery",
      audio: "Audio",
      "ai-quiz": "AI Quiz",
      "ai-image": "AI Generated Image",
      "ai-audio": "AI Generated Audio",
      video: "Video",
      accordion: "Accordion",
      timeline: "Timeline",
      "labeled-graphic": "Labeled Graphic",
      scenario: "Scenario",
      flashcards: "Flashcards",
      quiz: "Quiz",
      list: "List",
      "process-flow": "Process Flow",
      "sorting-activity": "Sorting Activity",
      continue: "Continue Block",
    };
    return titles[type] || "Content Block";
  };

  const editorFieldClass =
    "border-slate-200 bg-white text-base shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300";
  const editorTextareaClass = `min-h-[88px] resize-none ${editorFieldClass}`;

  const renderEditorField = (
    label: string,
    field: React.ReactNode,
    description?: string,
  ) => (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </label>
        {description ? <p className="text-base text-slate-500">{description}</p> : null}
      </div>
      {field}
    </div>
  );

  const renderEditorSection = (
    title: string,
    children: React.ReactNode,
    action?: React.ReactNode,
    description?: string,
  ) => (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          {description ? <p className="text-base text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );

  const renderEditorEmptyState = (title: string, description: string) => (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-base text-slate-500">{description}</p>
    </div>
  );

  const renderEditingInterface = () => {
    const content = editedContent as any;

    const renderQuizEditor = (kind: "quiz" | "ai-quiz") => {
      const cleanTitle = cleanQuizTitle(content.title || "");
      const questions = Array.isArray(content.questions) ? content.questions : [];

      return (
        <div className="space-y-4" data-testid={`edit-${kind}-${contentBlock.id}`}>
          {cleanTitle
            ? renderEditorField(
                "Title",
                <Input
                  value={cleanTitle}
                  onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                  placeholder="Quiz title"
                  className={`font-semibold ${editorFieldClass}`}
                  data-testid={`input-quiz-title-${contentBlock.id}`}
                />,
              )
            : null}

          <Textarea
            value={content.description || ""}
            onChange={(e) => setEditedContent({ ...content, description: e.target.value })}
            placeholder="Add a short intro for learners before they answer the questions."
            className={editorTextareaClass}
            data-testid={`input-quiz-description-${contentBlock.id}`}
          />

          {questions.length > 0
            ? renderEditorSection(
                `Questions (${questions.length})`,
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {questions.map((question: any, index: number) => (
                    <div
                      key={question.id || index}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Q{index + 1}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {question.type}
                          </span>
                        </div>
                        <p className="text-base font-medium text-slate-900">{question.question}</p>
                      </div>

                      {question.type === "multiple-choice" && question.options && (
                        <div className="space-y-2">
                          {question.options.map((option: string, optIndex: number) => (
                            <label
                              key={optIndex}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300"
                            >
                              <input
                                type="radio"
                                name={`question-${index}`}
                                value={String.fromCharCode(65 + optIndex)}
                                checked={
                                  selectedAnswers[`question-${index}`] ===
                                  String.fromCharCode(65 + optIndex)
                                }
                                onChange={(e) =>
                                  setSelectedAnswers({
                                    ...selectedAnswers,
                                    [`question-${index}`]: e.target.value,
                                  })
                                }
                                className="text-slate-600"
                              />
                              <span>
                                {String.fromCharCode(65 + optIndex)}. {option}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}

                      {question.type === "true-false" && (
                        <div className="space-y-2">
                          {["true", "false"].map((value) => (
                            <label
                              key={value}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300"
                            >
                              <input
                                type="radio"
                                name={`question-${index}`}
                                value={value}
                                checked={selectedAnswers[`question-${index}`] === value}
                                onChange={(e) =>
                                  setSelectedAnswers({
                                    ...selectedAnswers,
                                    [`question-${index}`]: e.target.value,
                                  })
                                }
                                className="text-slate-600"
                              />
                              <span>{value === "true" ? "True" : "False"}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {question.type === "short-answer" && (
                        <Textarea
                          placeholder="Learner answer"
                          value={selectedAnswers[`question-${index}`] || ""}
                          onChange={(e) =>
                            setSelectedAnswers({
                              ...selectedAnswers,
                              [`question-${index}`]: e.target.value,
                            })
                          }
                          className={`min-h-[72px] ${editorFieldClass}`}
                        />
                      )}

                      {showAnswers && (
                        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm">
                          <p className="text-emerald-800">
                            <span className="font-medium">Correct answer:</span> {question.correctAnswer}
                          </p>
                          {question.explanation ? (
                            <p className="mt-1 text-emerald-700">
                              <span className="font-medium">Explanation:</span> {question.explanation}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>,
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAnswers(!showAnswers)}
                    className="rounded-full"
                    data-testid={`button-toggle-answers-${contentBlock.id}`}
                  >
                    {showAnswers ? "Hide" : "Show"} answers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAnswers({})}
                    className="rounded-full"
                    data-testid={`button-reset-quiz-${contentBlock.id}`}
                  >
                    Reset
                  </Button>
                </div>,
                "Review the learner experience directly inside the editor.",
              )
            : renderEditorEmptyState(
                kind === "ai-quiz" ? "No AI questions yet" : "No questions yet",
                kind === "ai-quiz"
                  ? "Generate questions to populate this quiz block."
                  : "Add questions to turn this block into an assessment.",
              )}
        </div>
      );
    };

    const renderAssignmentEditor = () => (
      <div className="space-y-4" data-testid={`edit-assignment-${contentBlock.id}`}>
        {renderEditorField(
          "Title",
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="Assignment title"
            className={editorFieldClass}
            data-testid={`input-assignment-title-${contentBlock.id}`}
          />,
        )}

        {renderEditorField(
          "Brief",
          <Textarea
            value={content.description || ""}
            onChange={(e) => setEditedContent({ ...content, description: e.target.value })}
            placeholder="Explain the task and expected outcome."
            className="min-h-[120px] resize-none border-slate-200 bg-white shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
            data-testid={`input-assignment-description-${contentBlock.id}`}
          />,
        )}

        {Array.isArray(content.tasks) && content.tasks.length > 0
          ? renderEditorSection(
              `Tasks (${content.tasks.length})`,
              <div className="space-y-3">
                {content.tasks.map((task: any, index: number) => (
                  <div key={task.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Task {index + 1}
                      </span>
                      {task.estimatedTime ? (
                        <span className="text-xs text-slate-500">Estimated time: {task.estimatedTime}</span>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      <Input
                        value={task.title || ""}
                        onChange={(e) => {
                          const updatedTasks = [...content.tasks];
                          updatedTasks[index].title = e.target.value;
                          setEditedContent({ ...content, tasks: updatedTasks });
                        }}
                        placeholder="Task title"
                        className={`font-medium ${editorFieldClass}`}
                        data-testid={`input-task-title-${index}-${contentBlock.id}`}
                      />
                      <Textarea
                        value={task.description || ""}
                        onChange={(e) => {
                          const updatedTasks = [...content.tasks];
                          updatedTasks[index].description = e.target.value;
                          setEditedContent({ ...content, tasks: updatedTasks });
                        }}
                        placeholder="Task instructions"
                        className={`min-h-[88px] ${editorFieldClass}`}
                        data-testid={`input-task-description-${index}-${contentBlock.id}`}
                      />
                    </div>
                  </div>
                ))}
              </div>,
              undefined,
              "Each task is presented as a discrete step for the learner.",
            )
          : renderEditorEmptyState("No tasks yet", "Generate or add tasks to define the assignment flow.")}

        {Array.isArray(content.rubric) && content.rubric.length > 0
          ? renderEditorSection(
              `Rubric (${content.rubric.length} criteria)`,
              <div className="space-y-2">
                {content.rubric.map((criterion: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{criterion.criterion}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      {criterion.weight}%
                    </span>
                  </div>
                ))}
              </div>,
              undefined,
              "Rubric details stay attached to the assignment and can be reviewed in preview.",
            )
          : null}
      </div>
    );
    
    switch (contentBlock.type) {
      case "text":
      case "ai-text":
        return (
          <div className="space-y-3" data-testid={`edit-text-${contentBlock.id}`}>
            {showAiAssistant && (
              <InlineAiAssistant
                moduleId={contentBlock.moduleId}
                currentText={content.text || content.html || ""}
                onContentGenerated={(generatedText) => {
                  setIsAiGenerating(true);
                  
                  // Convert plain text to HTML, handling newlines properly
                  let htmlContent;
                  if (generatedText.includes('<')) {
                    htmlContent = generatedText;
                  } else {
                    // Split by double newlines to create paragraphs, single newlines become <br>
                    const paragraphs = generatedText.split('\n\n').map(paragraph => 
                      paragraph.trim().split('\n').join('<br>')
                    );
                    htmlContent = paragraphs.map(p => `<p>${p}</p>`).join('');
                  }
                  const newContent = { ...content, html: htmlContent, text: generatedText.replace(/<[^>]*>/g, '') };
                  setEditedContent(newContent);
                  setShowAiAssistant(false);
                  
                  // Reset AI generating flag after a short delay to allow UI to update
                  setTimeout(() => setIsAiGenerating(false), 1000);
                }}
              />
            )}
            <RichTextEditor
              content={content.html || content.text || ""}
              onChange={(html) => setEditedContent({ ...content, html, text: html.replace(/<[^>]*>/g, '') })}
              placeholder="Start typing..."
              className="border-transparent hover:border-border focus-within:border-border transition-colors"
              suppressToolbar={showAiAssistant}
              toolbarExtras={
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowAiAssistant(!showAiAssistant);
                  }}
                  className="h-8 px-2 gap-1 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                  data-testid={`button-ai-toolbar-${contentBlock.id}`}
                  type="button"
                  title="Open AI writing assistant"
                >
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  <span className="text-xs">AI</span>
                </Button>
              }
              data-testid={`input-text-content-${contentBlock.id}`}
            />
          </div>
        );

      case "heading":
        return (
          <div className="space-y-3" data-testid={`edit-heading-${contentBlock.id}`}>
            {renderEditorField(
              "Heading",
              <Input
                value={content.text || ""}
                onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
                placeholder="Add a clear section heading."
                className={`text-lg font-semibold ${editorFieldClass}`}
                data-testid={`input-heading-content-${contentBlock.id}`}
              />,
            )}
          </div>
        );

      case "statement":
        return (
          <div className="space-y-3" data-testid={`edit-statement-${contentBlock.id}`}>
            {renderEditorField(
              "Statement",
              <Textarea
                value={content.text || ""}
                onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
                placeholder="Highlight a key takeaway or important instruction."
                className={editorTextareaClass}
                data-testid={`input-statement-content-${contentBlock.id}`}
              />,
            )}
          </div>
        );

      case "quote":
        return (
          <div className="space-y-3" data-testid={`edit-quote-${contentBlock.id}`}>
            {renderEditorField(
              "Quote",
              <Textarea
                value={content.text || ""}
                onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
                placeholder="Paste the quote or testimonial."
                className={editorTextareaClass}
                data-testid={`input-quote-text-${contentBlock.id}`}
              />,
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {renderEditorField(
                "Author",
                <Input
                  value={content.author || ""}
                  onChange={(e) => setEditedContent({ ...content, author: e.target.value })}
                  placeholder="Author name"
                  className={editorFieldClass}
                  data-testid={`input-quote-author-${contentBlock.id}`}
                />,
              )}
              {renderEditorField(
                "Citation",
                <Input
                  value={content.citation || ""}
                  onChange={(e) => setEditedContent({ ...content, citation: e.target.value })}
                  placeholder="Source or citation"
                  className={editorFieldClass}
                  data-testid={`input-quote-citation-${contentBlock.id}`}
                />,
              )}
            </div>
          </div>
        );
      
      case "image":
      case "ai-image":
        const editorImageProps = getImageDisplayProps(content, `content-${contentBlock.id}`);
        return (
          <div className="space-y-3" data-testid={`edit-image-${contentBlock.id}`}>
            {editorImageProps.url && (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img
                  src={editorImageProps.url}
                  alt={editorImageProps.alt}
                  className="h-[400px] w-full rounded-lg object-cover"
                />
              </div>
            )}
            {renderEditorField(
              "Image URL",
              <Input
                value={content.url || ""}
                onChange={(e) => setEditedContent({ ...content, url: e.target.value })}
                placeholder="Paste an image URL"
                className={editorFieldClass}
                data-testid={`input-image-url-${contentBlock.id}`}
              />,
            )}
            {renderEditorField(
              "Alt text",
              <Input
                value={content.alt || ""}
                onChange={(e) => setEditedContent({ ...content, alt: e.target.value })}
                placeholder="Describe the image for accessibility"
                className={editorFieldClass}
                data-testid={`input-image-alt-${contentBlock.id}`}
              />,
            )}
            {renderEditorField(
              "Caption",
              <Input
                value={content.caption || ""}
                onChange={(e) => setEditedContent({ ...content, caption: e.target.value })}
                placeholder="Optional caption"
                className={editorFieldClass}
                data-testid={`input-image-caption-${contentBlock.id}`}
              />,
            )}
          </div>
        );

      case "audio":
      case "ai-audio":
        return (
          <div className="space-y-3" data-testid={`edit-audio-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="Audio title"
                className={editorFieldClass}
                data-testid={`input-audio-title-${contentBlock.id}`}
              />,
            )}
            {renderEditorField(
              "Description",
              <Textarea
                value={content.description || ""}
                onChange={(e) => setEditedContent({ ...content, description: e.target.value })}
                placeholder="Describe what the learner will hear."
                className={editorTextareaClass}
                data-testid={`input-audio-description-${contentBlock.id}`}
              />,
            )}
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              {renderEditorField(
                "Audio URL",
                <Input
                  value={content.url || ""}
                  onChange={(e) => setEditedContent({ ...content, url: e.target.value })}
                  placeholder="Paste an audio URL"
                  className={editorFieldClass}
                  data-testid={`input-audio-url-${contentBlock.id}`}
                />,
              )}
              {renderEditorField(
                "Duration",
                <Input
                  value={content.duration || ""}
                  onChange={(e) => setEditedContent({ ...content, duration: e.target.value })}
                  placeholder="2:30"
                  className={editorFieldClass}
                  data-testid={`input-audio-duration-${contentBlock.id}`}
                />,
              )}
            </div>
            {contentBlock.type === "ai-audio" && content.script && (
              renderEditorField(
                "Generated script",
                <Textarea
                  value={content.script || ""}
                  onChange={(e) => setEditedContent({ ...content, script: e.target.value })}
                  placeholder="AI-generated audio script"
                  className="min-h-[140px] resize-none border-slate-200 bg-white shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
                  data-testid={`input-audio-script-${contentBlock.id}`}
                />,
              )
            )}
          </div>
        );

      case "ai-quiz":
        return renderQuizEditor("ai-quiz");

      case "quiz":
        return renderQuizEditor("quiz");

      case "ai-assignment":
      case "assignment":
        return renderAssignmentEditor();

      case "accordion":
        return (
          <div className="space-y-4" data-testid={`edit-accordion-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="Accordion title"
                className={editorFieldClass}
                data-testid={`input-accordion-title-${contentBlock.id}`}
              />,
            )}

            {Array.isArray(content.items) && content.items.length > 0
              ? renderEditorSection(
                  `Items (${content.items.length})`,
                  <div className="space-y-3">
                    {content.items.map((item: any, index: number) => (
                      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Item {index + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const items = [...(content.items || [])];
                              items.splice(index, 1);
                              setEditedContent({ ...content, items });
                            }}
                            data-testid={`button-remove-accordion-item-${index}-${contentBlock.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <Input
                            value={item.title || ""}
                            onChange={(e) => {
                              const items = [...(content.items || [])];
                              items[index].title = e.target.value;
                              setEditedContent({ ...content, items });
                            }}
                            placeholder="Item title"
                            className={editorFieldClass}
                            data-testid={`input-accordion-item-title-${index}-${contentBlock.id}`}
                          />
                          <Textarea
                            value={item.content || ""}
                            onChange={(e) => {
                              const items = [...(content.items || [])];
                              items[index].content = e.target.value;
                              setEditedContent({ ...content, items });
                            }}
                            placeholder="Item content"
                            className={`min-h-[88px] ${editorFieldClass}`}
                            data-testid={`input-accordion-item-content-${index}-${contentBlock.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>,
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const items = content.items || [];
                      items.push({ title: "", content: "" });
                      setEditedContent({ ...content, items });
                    }}
                    data-testid={`button-add-accordion-item-${contentBlock.id}`}
                  >
                    Add item
                  </Button>,
                  "Use short headings with optional supporting detail.",
                )
              : renderEditorSection(
                  "Items",
                  renderEditorEmptyState(
                    "No accordion items yet",
                    "Add the first accordion section to start structuring this block.",
                  ),
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const items = content.items || [];
                      items.push({ title: "", content: "" });
                      setEditedContent({ ...content, items });
                    }}
                    data-testid={`button-add-accordion-item-${contentBlock.id}`}
                  >
                    Add item
                  </Button>,
                )}
          </div>
        );

      case "flashcards":
        return (
          <div className="space-y-4" data-testid={`edit-flashcards-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="Flashcards title"
                className={editorFieldClass}
                data-testid={`input-flashcards-title-${contentBlock.id}`}
              />,
            )}

            {Array.isArray(content.cards) && content.cards.length > 0
              ? renderEditorSection(
                  `Cards (${content.cards.length})`,
                  <div className="space-y-3">
                    {content.cards.map((card: any, index: number) => (
                      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Card {index + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const cards = [...(content.cards || [])];
                              cards.splice(index, 1);
                              setEditedContent({ ...content, cards });
                            }}
                            data-testid={`button-remove-flashcard-${index}-${contentBlock.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <Input
                            value={card.front || ""}
                            onChange={(e) => {
                              const cards = [...(content.cards || [])];
                              cards[index].front = e.target.value;
                              setEditedContent({ ...content, cards });
                            }}
                            placeholder="Prompt or term"
                            className={editorFieldClass}
                            data-testid={`input-flashcard-front-${index}-${contentBlock.id}`}
                          />
                          <Textarea
                            value={card.back || ""}
                            onChange={(e) => {
                              const cards = [...(content.cards || [])];
                              cards[index].back = e.target.value;
                              setEditedContent({ ...content, cards });
                            }}
                            placeholder="Answer or explanation"
                            className={`min-h-[88px] ${editorFieldClass}`}
                            data-testid={`input-flashcard-back-${index}-${contentBlock.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>,
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const cards = content.cards || [];
                      cards.push({ front: "", back: "" });
                      setEditedContent({ ...content, cards });
                    }}
                    data-testid={`button-add-flashcard-${contentBlock.id}`}
                  >
                    Add card
                  </Button>,
                  "Each card should contain a short prompt and a concise answer.",
                )
              : renderEditorSection(
                  "Cards",
                  renderEditorEmptyState(
                    "No flashcards yet",
                    "Add the first flashcard to create a quick recall activity.",
                  ),
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const cards = content.cards || [];
                      cards.push({ front: "", back: "" });
                      setEditedContent({ ...content, cards });
                    }}
                    data-testid={`button-add-flashcard-${contentBlock.id}`}
                  >
                    Add card
                  </Button>,
                )}
          </div>
        );

      case "continue":
        return (
          <div className="space-y-3" data-testid={`edit-continue-${contentBlock.id}`}>
            {renderEditorField(
              "Button label",
              <Input
                value={content.text || ""}
                onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
                placeholder="Continue to next lesson"
                className={editorFieldClass}
                data-testid={`input-continue-text-${contentBlock.id}`}
              />,
            )}
            {renderEditorField(
              "Destination URL",
              <Input
                value={content.url || ""}
                onChange={(e) => setEditedContent({ ...content, url: e.target.value })}
                placeholder="Optional link"
                className={editorFieldClass}
                data-testid={`input-continue-url-${contentBlock.id}`}
              />,
            )}
          </div>
        );

      case "list":
        return (
          <div className="space-y-4" data-testid={`edit-list-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="List title"
                className={editorFieldClass}
                data-testid={`input-list-title-${contentBlock.id}`}
              />,
            )}
            {renderEditorField(
              "Style",
              <div className="flex gap-2">
                <Button
                  variant={content.type === "ordered" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setEditedContent({ ...content, type: "ordered" })}
                  data-testid={`button-list-ordered-${contentBlock.id}`}
                >
                  Numbered
                </Button>
                <Button
                  variant={content.type === "unordered" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setEditedContent({ ...content, type: "unordered" })}
                  data-testid={`button-list-unordered-${contentBlock.id}`}
                >
                  Bullets
                </Button>
              </div>,
            )}
            {Array.isArray(content.items) && content.items.length > 0
              ? renderEditorSection(
                  `Items (${content.items.length})`,
                  <div className="space-y-3">
                    {content.items.map((item: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                        <span className="w-8 text-sm font-semibold text-slate-500">
                          {content.type === "ordered" ? `${index + 1}.` : "-"}
                        </span>
                        <Input
                          value={item.text || ""}
                          onChange={(e) => {
                            const items = [...(content.items || [])];
                            items[index].text = e.target.value;
                            setEditedContent({ ...content, items });
                          }}
                          placeholder={`Item ${index + 1}`}
                          className={editorFieldClass}
                          data-testid={`input-list-item-${index}-${contentBlock.id}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const items = [...(content.items || [])];
                            items.splice(index, 1);
                            setEditedContent({ ...content, items });
                          }}
                          data-testid={`button-remove-list-item-${index}-${contentBlock.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>,
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const items = content.items || [];
                      items.push({ text: "" });
                      setEditedContent({ ...content, items });
                    }}
                    data-testid={`button-add-list-item-${contentBlock.id}`}
                  >
                    Add item
                  </Button>,
                )
              : renderEditorSection(
                  "Items",
                  renderEditorEmptyState(
                    "No list items yet",
                    "Add the first item to turn this into an ordered or bulleted list.",
                  ),
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const items = content.items || [];
                      items.push({ text: "" });
                      setEditedContent({ ...content, items });
                    }}
                    data-testid={`button-add-list-item-${contentBlock.id}`}
                  >
                    Add item
                  </Button>,
                )}
          </div>
        );

      case "timeline":
        return (
          <div className="space-y-4" data-testid={`edit-timeline-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="Timeline title"
                className={editorFieldClass}
                data-testid={`input-timeline-title-${contentBlock.id}`}
              />,
            )}

            {Array.isArray(content.events) && content.events.length > 0
              ? renderEditorSection(
                  `Events (${content.events.length})`,
                  <div className="space-y-3">
                    {content.events.map((event: any, index: number) => (
                      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Event {index + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const events = [...(content.events || [])];
                              events.splice(index, 1);
                              setEditedContent({ ...content, events });
                            }}
                            data-testid={`button-remove-timeline-event-${index}-${contentBlock.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                          <Input
                            value={event.date || ""}
                            onChange={(e) => {
                              const events = [...(content.events || [])];
                              events[index].date = e.target.value;
                              setEditedContent({ ...content, events });
                            }}
                            placeholder="Date or milestone"
                            className={editorFieldClass}
                            data-testid={`input-timeline-event-date-${index}-${contentBlock.id}`}
                          />
                          <Input
                            value={event.title || ""}
                            onChange={(e) => {
                              const events = [...(content.events || [])];
                              events[index].title = e.target.value;
                              setEditedContent({ ...content, events });
                            }}
                            placeholder="Event title"
                            className={editorFieldClass}
                            data-testid={`input-timeline-event-title-${index}-${contentBlock.id}`}
                          />
                        </div>
                        <Textarea
                          value={event.description || ""}
                          onChange={(e) => {
                            const events = [...(content.events || [])];
                            events[index].description = e.target.value;
                            setEditedContent({ ...content, events });
                          }}
                          placeholder="Event description"
                          className={`mt-3 min-h-[88px] ${editorFieldClass}`}
                          data-testid={`input-timeline-event-description-${index}-${contentBlock.id}`}
                        />
                      </div>
                    ))}
                  </div>,
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const events = content.events || [];
                      events.push({ date: "", title: "", description: "" });
                      setEditedContent({ ...content, events });
                    }}
                    data-testid={`button-add-timeline-event-${contentBlock.id}`}
                  >
                    Add event
                  </Button>,
                )
              : renderEditorSection(
                  "Events",
                  renderEditorEmptyState(
                    "No timeline events yet",
                    "Add milestones to build an interactive timeline.",
                  ),
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const events = content.events || [];
                      events.push({ date: "", title: "", description: "" });
                      setEditedContent({ ...content, events });
                    }}
                    data-testid={`button-add-timeline-event-${contentBlock.id}`}
                  >
                    Add event
                  </Button>,
                )}
          </div>
        );

      case "sorting-activity":
        return (
          <div className="space-y-4" data-testid={`edit-sorting-activity-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="Sorting activity title"
                className={editorFieldClass}
                data-testid={`input-sorting-title-${contentBlock.id}`}
              />,
            )}

            {renderEditorSection(
              `Categories (${sortingCategories.length})`,
              <div className="space-y-3">
                {sortingCategories.map((category: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={category}
                      onChange={(e) => {
                        const categories = [...(Array.isArray(editedContent.categories) ? editedContent.categories.map((value: any) => String(value || "")) : [])];
                        categories[index] = e.target.value;
                        setEditedContent({ ...editedContent, categories });
                      }}
                      placeholder={`Category ${index + 1}`}
                      className={editorFieldClass}
                      data-testid={`input-sorting-category-${index}-${contentBlock.id}`}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const categories = [...(Array.isArray(editedContent.categories) ? editedContent.categories.map((value: any) => String(value || "")) : [])];
                        categories.splice(index, 1);
                        setEditedContent({ ...editedContent, categories });
                      }}
                      data-testid={`button-remove-sorting-category-${index}-${contentBlock.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>,
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const categories = [...(Array.isArray(editedContent.categories) ? editedContent.categories.map((value: any) => String(value || "")) : [])];
                  categories.push("");
                  setEditedContent({ ...editedContent, categories });
                }}
                data-testid={`button-add-sorting-category-${contentBlock.id}`}
              >
                Add category
              </Button>,
            )}

            {renderEditorSection(
              `Items (${normalizedSortingItems.length})`,
              <div className="space-y-3">
                {normalizedSortingItems.map((item: any, index: number) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Item {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const items = [...normalizedSortingItems];
                          items.splice(index, 1);
                          setEditedContent({ ...content, items });
                        }}
                        data-testid={`button-remove-sorting-item-${index}-${contentBlock.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                      <Input
                          value={item.text || ""}
                          onChange={(e) => {
                            const items = [...normalizedSortingItems];
                            items[index].text = e.target.value;
                            setEditedContent({ ...editedContent, items });
                          }}
                        placeholder="Item text"
                        className={editorFieldClass}
                        data-testid={`input-sorting-item-text-${index}-${contentBlock.id}`}
                      />
                      <Select
                        value={item.category || "__none__"}
                        onValueChange={(value) => {
                          const items = [...normalizedSortingItems];
                          items[index].category = value === "__none__" ? "" : value;
                          setEditedContent({ ...editedContent, items });
                        }}
                      >
                        <SelectTrigger className={editorFieldClass} data-testid={`select-sorting-item-category-${index}-${contentBlock.id}`}>
                          <SelectValue placeholder="Correct category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No category</SelectItem>
                          {sortingCategories.map((category: string) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>,
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setEditedContent({ ...editedContent, items: [...normalizedSortingItems, { text: "", category: "" }] })}
                data-testid={`button-add-sorting-item-${contentBlock.id}`}
              >
                Add item
              </Button>,
            )}
          </div>
        );
      case "process-flow":
        return (
          <div className="space-y-4" data-testid={`edit-process-flow-${contentBlock.id}`}>
            {renderEditorField(
              "Title",
              <Input
                value={content.title || ""}
                onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                placeholder="Process title"
                className={editorFieldClass}
                data-testid={`input-process-flow-title-${contentBlock.id}`}
              />,
            )}

            {Array.isArray(content.steps) && content.steps.length > 0
              ? renderEditorSection(
                  `Steps (${content.steps.length})`,
                  <div className="space-y-3">
                    {content.steps.map((step: any, index: number) => (
                      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Step {index + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const steps = [...(content.steps || [])];
                              steps.splice(index, 1);
                              setEditedContent({ ...content, steps });
                            }}
                            data-testid={`button-remove-process-step-${index}-${contentBlock.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          <Input
                            value={step.title || ""}
                            onChange={(e) => {
                              const steps = [...(content.steps || [])];
                              steps[index].title = e.target.value;
                              setEditedContent({ ...content, steps });
                            }}
                            placeholder="Step title"
                            className={editorFieldClass}
                            data-testid={`input-process-step-title-${index}-${contentBlock.id}`}
                          />
                          <Textarea
                            value={step.description || ""}
                            onChange={(e) => {
                              const steps = [...(content.steps || [])];
                              steps[index].description = e.target.value;
                              setEditedContent({ ...content, steps });
                            }}
                            placeholder="Describe this step"
                            className={`min-h-[88px] ${editorFieldClass}`}
                            data-testid={`input-process-step-description-${index}-${contentBlock.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>,
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const steps = content.steps || [];
                      steps.push({ title: "", description: "" });
                      setEditedContent({ ...content, steps });
                    }}
                    data-testid={`button-add-process-step-${contentBlock.id}`}
                  >
                    Add step
                  </Button>,
                )
              : renderEditorSection(
                  "Steps",
                  renderEditorEmptyState(
                    "No process steps yet",
                    "Add the first step to build a sequenced learner flow.",
                  ),
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => {
                      const steps = content.steps || [];
                      steps.push({ title: "", description: "" });
                      setEditedContent({ ...content, steps });
                    }}
                    data-testid={`button-add-process-step-${contentBlock.id}`}
                  >
                    Add step
                  </Button>,
                )}
          </div>
        );

      default:
        return (
          <div className="text-muted-foreground" data-testid={`edit-default-${contentBlock.id}`}>
            <p>Editing for {contentBlock.type} blocks is not yet implemented.</p>
            <p className="text-sm mt-2">You can still view and delete this block.</p>
          </div>
        );
    }
  };

  const renderContent = () => {
    const content = contentBlock.content as any;
    
    switch (contentBlock.type) {
      case "text":
      case "ai-text":
        return (
          <div className="rise-content prose max-w-none" data-testid={`content-text-${contentBlock.id}`}>
            {content.html ? (
              <SanitizedHTML html={content.html} />
            ) : (
              <p>{content.text || "Sample text content would appear here..."}</p>
            )}
          </div>
        );

      case "heading":
        return (
          <div className="rise-content" data-testid={`content-heading-${contentBlock.id}`}>
            {content.html ? (
              <SanitizedHTML html={content.html} />
            ) : (
              <h2 className="text-2xl font-bold mb-2">{content.text || "Sample Heading"}</h2>
            )}
          </div>
        );

      case "statement":
        const statementText = String(content.text || stripHtml(String(content.html || "")) || "This is an important statement that emphasizes key information.");
        return (
          <div className="overflow-visible rounded-r-lg border-l-4 border-amber-400 bg-amber-50 p-4 dark:bg-amber-950" data-testid={`content-statement-${contentBlock.id}`}>
            <p className="whitespace-pre-wrap break-words leading-8 text-amber-800 dark:text-amber-200">
              {statementText}
            </p>
          </div>
        );

      case "quote":
        return (
          <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4" data-testid={`content-quote-${contentBlock.id}`}>
            <blockquote className="text-indigo-800 dark:text-indigo-200 italic text-lg mb-3">
              "{content.text || "This is a sample quote that provides valuable insights."}"
            </blockquote>
            {(content.author || content.citation) && (
              <div className="text-indigo-600 dark:text-indigo-400 text-sm">
                {content.author && <span className="font-medium">- {content.author}</span>}
                {content.citation && <span className="ml-2 opacity-75">{content.citation}</span>}
              </div>
            )}
          </div>
        );
      
      case "image":
      case "ai-image":
        const imageProps = getImageDisplayProps(content, `content-${contentBlock.id}`);
        return (
          <div data-testid={`content-image-${contentBlock.id}`}>
            <img 
              src={imageProps.url} 
              alt={imageProps.alt} 
              className="h-[400px] w-full rounded-lg object-cover" 
            />
            {imageProps.caption && (
              <p className="text-sm text-muted-foreground mt-2">{imageProps.caption}</p>
            )}
          </div>
        );

      case "gallery":
        return (
          <div data-testid={`content-gallery-${contentBlock.id}`}>
            <div className="grid md:grid-cols-3 gap-4">
              {content.images?.slice(0, 6).map((img: any, index: number) => (
                <div key={index} className="rounded-lg overflow-hidden">
                  <img 
                    src={img.url || `https://picsum.photos/seed/gallery-${contentBlock.id}-${index}/300/200`} 
                    alt={img.alt || `Gallery image ${index + 1}`}
                    className="w-full h-48 object-cover"
                  />
                  {img.caption && (
                    <p className="text-xs text-muted-foreground mt-1 px-1">{img.caption}</p>
                  )}
                </div>
              )) || (
                <div className="col-span-3 text-center text-muted-foreground">
                  No images in gallery yet
                </div>
              )}
            </div>
          </div>
        );

      case "audio":
        const hasValidAudioUrl = content.url && !content.url.startsWith('#');
        return (
          <div className="bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-lg p-4" data-testid={`content-audio-${contentBlock.id}`}>
            <div className="flex items-center space-x-4 mb-3">
              <div className="text-2xl">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ</div>
              <div className="flex-1">
                <h4 className="font-medium text-pink-800 dark:text-pink-200">{content.title || "Audio Content"}</h4>
                <p className="text-sm text-pink-600 dark:text-pink-400">{content.description || "Audio file or recording"}</p>
                {content.duration && (
                  <p className="text-xs text-pink-500 dark:text-pink-500 mt-1">Duration: {content.duration}</p>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePlayPause}
                disabled={!hasValidAudioUrl}
              >
                {audioState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
            {hasValidAudioUrl && (
              <audio
                ref={audioRef}
                src={content.url}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
                onLoadedMetadata={handleAudioTimeUpdate}
                className="w-full"
                controls
              />
            )}
            {!hasValidAudioUrl && (
              <p className="text-xs text-pink-400 dark:text-pink-500 italic">No audio file available. Please provide a valid audio URL.</p>
            )}
          </div>
        );
      
      case "video":
        return (
          <div className="bg-gray-100 rounded-lg aspect-video flex items-center justify-center" data-testid={`content-video-${contentBlock.id}`}>
            <div className="text-center">
              <div className="text-4xl mb-2">Video</div>
              <p className="text-gray-600">{content.title || "Video Content"}</p>
              {content.duration && (
                <p className="text-sm text-gray-500">({content.duration})</p>
              )}
            </div>
          </div>
        );
      
      case "flashcards":
        return (
          <div className="grid md:grid-cols-2 gap-4" data-testid={`content-flashcards-${contentBlock.id}`}>
            {content.cards?.map((card: any, index: number) => (
              <button
                type="button"
                key={index}
                onClick={() => toggleFlashcard(index)}
                className="group [perspective:1200px] text-left"
                data-testid={`button-toggle-flashcard-${index}-${contentBlock.id}`}
              >
                <div
                  className={`relative min-h-[220px] rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] ${
                    flippedFlashcards[index] ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  <div className="absolute inset-0 flex min-h-[220px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [backface-visibility:hidden] transition-colors group-hover:border-slate-300">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Front {index + 1}
                    </div>
                    <div className="py-4">
                      <h4 className="text-lg font-medium leading-relaxed text-slate-900">
                        {card.front || `Flashcard ${index + 1}`}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                      <span>Click to flip</span>
                      <RotateCw className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex min-h-[220px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)] transition-colors group-hover:border-slate-300">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Back {index + 1}
                    </div>
                    <div className="py-4">
                      <h4 className="text-lg font-medium leading-relaxed text-slate-900">
                        {card.back || "Answer appears on the reverse side of this flashcard."}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                      <span>Click to flip to front</span>
                      <RotateCw className="h-4 w-4 rotate-180" />
                    </div>
                  </div>
                </div>
              </button>
            )) || (
              <div className="col-span-2 text-center text-muted-foreground">
                No flashcards configured yet
              </div>
            )}
          </div>
        );
      
      case "accordion":
        return (
          <div className="space-y-2" data-testid={`content-accordion-${contentBlock.id}`}>
            {(Array.isArray(content.items) ? content.items : []).slice(0, 3).map((item: any, index: number) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => toggleAccordionItem(index)}
                  data-testid={`button-toggle-accordion-item-${index}-${contentBlock.id}`}
                >
                  <h4 className="font-medium text-slate-900">{item.title || `Accordion Item ${index + 1}`}</h4>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-500 transition-transform ${expandedAccordionItems[index] ? "rotate-180" : ""}`}
                  />
                </button>
                {expandedAccordionItems[index] ? (
                  <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                    {item.content || "Content for this accordion section would appear here when expanded."}
                  </div>
                ) : null}
              </div>
            )) || (
              <div className="text-center text-muted-foreground">
                No accordion items configured yet
              </div>
            )}
          </div>
        );

      case "timeline":
        const timelineEvents = (Array.isArray(content.events) ? content.events : []).slice(0, 6);
        const selectedTimelineEvent = timelineEvents[activeTimelineEvent] || timelineEvents[0];
        return (
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" data-testid={`content-timeline-${contentBlock.id}`}>
            {timelineEvents.length > 0 ? (
              <>
                <div className="space-y-2">
                  {timelineEvents.map((event: any, index: number) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveTimelineEvent(index)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                        activeTimelineEvent === index
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                      data-testid={`button-select-timeline-event-${index}-${contentBlock.id}`}
                    >
                      <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        {event.date && (
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                            {event.date}
                          </div>
                        )}
                        <div className="mt-1 font-medium text-slate-900">{event.title || `Event ${index + 1}`}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  {selectedTimelineEvent?.date && (
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      {selectedTimelineEvent.date}
                    </div>
                  )}
                  <h4 className="mt-2 text-xl font-semibold text-slate-900">
                    {selectedTimelineEvent?.title || "Timeline event"}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {selectedTimelineEvent?.description || "Select a timeline event to read the detail."}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground">
                No timeline events configured yet
              </div>
            )}
          </div>
        );

      case "sorting-activity":
        const previewSortingItems = (Array.isArray(content.items) ? content.items : []).map((item: any, index: number) => ({
          index,
          text: typeof item === "string" ? item : String(item?.text || ""),
          category: typeof item === "string" ? "" : String(item?.category || ""),
        }));
        const previewSortingCategories = Array.isArray(content.categories)
          ? content.categories.map((category: any) => String(category || "")).filter(Boolean)
          : [];
        const unassignedItems = previewSortingItems.filter((item: { index: number }) => !sortingAssignments[item.index]);
        const currentSortingItem = unassignedItems[0] || null;
        const completedSortingItems = previewSortingItems.filter((item: { index: number }) => sortingAssignments[item.index]);
        const totalSortableItems = previewSortingItems.filter((item: { category: string }) => item.category).length || previewSortingItems.length;
        const totalCorrectAssignments = previewSortingItems.filter((item: { index: number; category: string }) => {
          const assignedCategory = sortingAssignments[item.index];
          return item.category && assignedCategory === item.category;
        }).length;
        const sortingComplete = unassignedItems.length === 0 && previewSortingItems.length > 0;
        const sortingFeedbackItems = Object.entries(sortingFeedback).map(([key, feedback]) => ({
          index: Number(key),
          ...feedback,
        }));
        return (
          <div className="space-y-6" data-testid={`content-sorting-activity-${contentBlock.id}`}>
            <div className="flex flex-col items-center gap-4">
              {currentSortingItem ? (
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(currentSortingItem.index));
                    setDraggedSortingIndex(currentSortingItem.index);
                    setSelectedSortingIndex(currentSortingItem.index);
                  }}
                  onDragEnd={() => {
                    setDraggedSortingIndex(null);
                    setSortingHoverCategory(null);
                  }}
                  onClick={() => setSelectedSortingIndex(currentSortingItem.index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedSortingIndex(currentSortingItem.index);
                    }
                  }}
                  className={`flex min-h-[240px] w-full max-w-[340px] cursor-grab flex-col rounded-2xl border bg-white px-8 py-7 text-center shadow-sm transition-colors active:cursor-grabbing ${
                    selectedSortingIndex === currentSortingItem.index
                      ? "border-indigo-300"
                      : "border-slate-200"
                  }`}
                  data-testid={`sorting-item-${currentSortingItem.index}-${contentBlock.id}`}
                >
                  <div className="mb-6 text-2xl text-slate-700">&#8801;</div>
                  <div className="text-[15px] leading-10 text-slate-800">
                    {currentSortingItem.text || `Item ${currentSortingItem.index + 1}`}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] w-full max-w-[340px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
                  <div className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Result</div>
                  <div className="mt-4 text-3xl font-semibold text-slate-900">
                    {totalCorrectAssignments}/{totalSortableItems}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">correct</div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 rounded-full"
                    onClick={() => {
                      setSortingAssignments({});
                      setSortingChecked(false);
                      setSelectedSortingIndex(null);
                      setDraggedSortingIndex(null);
                      setSortingHoverCategory(null);
                      setSortingFeedback({});
                    }}
                    data-testid={`button-reset-sorting-${contentBlock.id}`}
                  >
                    Reset
                  </Button>
                </div>
              )}

              {currentSortingItem ? (
                <div className="text-xs font-medium text-slate-500">
                  Drag the card into a category below, or click the card and then click a category.
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {previewSortingCategories.map((category: string, categoryIndex: number) => {
                const assignedItems = previewSortingItems
                  .filter((item: { index: number }) => sortingAssignments[item.index] === category);
                const categoryFeedbackItems = sortingFeedbackItems.filter((item) => item.category === category);

                return (
                  <div
                    key={category}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setSortingHoverCategory(category);
                    }}
                    onDragLeave={() => setSortingHoverCategory((prev) => (prev === category ? null : prev))}
                    onDrop={(event) => {
                      event.preventDefault();
                      const droppedIndex = Number(event.dataTransfer.getData("text/plain"));
                      if (Number.isFinite(droppedIndex)) {
                        assignSortingItem(droppedIndex, category);
                        return;
                      }
                      if (draggedSortingIndex !== null) {
                        assignSortingItem(draggedSortingIndex, category);
                      }
                    }}
                    className={`min-h-[220px] rounded-xl border px-6 py-8 text-center shadow-sm transition-colors ${
                      sortingHoverCategory === category
                        ? "border-indigo-400 bg-indigo-50/50"
                        : "border-stone-300 bg-stone-100"
                    }`}
                    data-testid={`sorting-category-${categoryIndex}-${contentBlock.id}`}
                  >
                    <div className="text-[18px] font-medium leading-10 text-slate-800">{category}</div>
                    {categoryFeedbackItems.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {categoryFeedbackItems.map((item) => {
                          return (
                            <div
                              key={`${item.text}-${item.index}`}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-500 ${
                                item.isCorrect
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              } ${item.leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
                            >
                              <span>{item.text}</span>
                              {item.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

          </div>
        );

      case "labeled-graphic":
        return (
          <div className="relative" data-testid={`content-labeled-graphic-${contentBlock.id}`}>
            <div className="bg-rose-100 dark:bg-rose-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden">
              <img 
                src={content.image?.url || `https://picsum.photos/seed/labeled-${contentBlock.id}/600/400`} 
                alt={content.image?.alt || "Labeled graphic"}
                className="w-full h-full object-cover"
              />
              {(Array.isArray(content.labels) ? content.labels : []).slice(0, 3).map((label: any, index: number) => (
                <div 
                  key={index}
                  className="absolute bg-rose-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-rose-600 transition-colors"
                  style={{ 
                    left: `${20 + index * 25}%`, 
                    top: `${30 + index * 20}%` 
                  }}
                  title={label.content || `Label ${index + 1}`}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            {content.labels && content.labels.length > 0 && (
              <div className="mt-3 text-sm text-rose-600 dark:text-rose-400">
                Click the numbered points to explore the interactive elements
              </div>
            )}
          </div>
        );

      case "scenario":
        return (
          <div className="bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-lg p-4" data-testid={`content-scenario-${contentBlock.id}`}>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â­</div>
              <div className="flex-1">
                <h4 className="font-medium text-violet-800 dark:text-violet-200 mb-2">
                  {content.title || "Interactive Scenario"}
                </h4>
                <p className="text-sm text-violet-600 dark:text-violet-400 mb-3">
                  {content.description || "This scenario presents learners with realistic situations and decision-making opportunities."}
                </p>
                {content.choices && (
                  <div className="space-y-2">
                    {(Array.isArray(content.choices) ? content.choices : []).slice(0, 3).map((choice: any, index: number) => (
                      <button 
                        key={index}
                        className="w-full text-left p-2 bg-violet-100 dark:bg-violet-900 hover:bg-violet-200 dark:hover:bg-violet-800 rounded text-sm text-violet-700 dark:text-violet-300 transition-colors"
                      >
                        {choice.text || `Choice ${index + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "continue":
        return (
          <div className="text-center py-6" data-testid={`content-continue-${contentBlock.id}`}>
            <div className="inline-flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-sm transition-colors hover:border-slate-300">
              <span className="font-medium text-slate-800">
                {content.text || "Continue"}
              </span>
              <span className="text-slate-400">â†’</span>
            </div>
          </div>
        );

      case "ai-audio":
        const hasValidAiAudioUrl = content.url && !content.url.startsWith('#');
        return (
          <div className="rise-content bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-lg p-4" data-testid={`content-ai-audio-${contentBlock.id}`}>
            <div className="flex items-start space-x-4 mb-3">
              <div className="text-2xl">🎵</div>
              <div className="flex-1">
                <h4 className="font-medium text-pink-800 dark:text-pink-200">{content.title || "AI Generated Audio"}</h4>
                <p className="mb-2 text-pink-600 dark:text-pink-400">{content.description || "Audio narration generated by AI"}</p>
                {content.duration && (
                  <p className="mb-2 text-pink-500 dark:text-pink-500">Duration: {content.duration}</p>
                )}
                {content.script && (
                  <div className="mt-3">
                    <p className="mb-1 font-medium text-pink-700 dark:text-pink-300">Script Preview:</p>
                    <p className="max-h-20 overflow-y-auto rounded-xl bg-white dark:bg-pink-900 p-2 text-pink-600 dark:text-pink-400">
                      {content.script.length > 200 ? `${content.script.substring(0, 200)}...` : content.script}
                    </p>
                  </div>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePlayPause}
                disabled={!hasValidAiAudioUrl}
              >
                {audioState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
            {hasValidAiAudioUrl && (
              <audio
                ref={audioRef}
                src={content.url}
                onTimeUpdate={handleAudioTimeUpdate}
                onEnded={handleAudioEnded}
                onLoadedMetadata={handleAudioTimeUpdate}
                className="w-full"
                controls
              />
            )}
            {!hasValidAiAudioUrl && (
              <div className="mt-2 rounded-xl bg-pink-100 dark:bg-pink-900 p-3">
                <p className="text-pink-600 dark:text-pink-400">
                  ⚠️ Audio generation is currently using placeholder URLs. To enable actual audio playback:
                </p>
                <ul className="text-pink-600 dark:text-pink-400 mt-2 ml-4 list-disc">
                  <li>Add a text-to-speech service (e.g., Google Cloud TTS, Amazon Polly, or ElevenLabs)</li>
                  <li>Or manually provide an audio URL in edit mode</li>
                </ul>
              </div>
            )}
          </div>
        );

      case "ai-quiz":
        return (
          <InteractiveQuiz 
            content={content} 
            blockId={contentBlock.id} 
            isPreviewMode={previewMode}
          />
        );

      case "quiz":
        return (
          <InteractiveQuiz 
            content={content} 
            blockId={contentBlock.id} 
            isPreviewMode={previewMode}
          />
        );
      
      case "ai-assignment":
      case "assignment":
        return (
          <div className="rise-content space-y-6" data-testid={`content-assignment-${contentBlock.id}`}>
            {content.title && (
              <div>
                <h3>
                  {content.title}
                </h3>
              </div>
            )}
            
            {content.description && (
              <div>
                <p>
                  {content.description}
                </p>
              </div>
            )}
            
            {Array.isArray(content.objectives) && content.objectives.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-2 font-medium">Learning Objectives:</h4>
                <ul className="space-y-1">
                  {content.objectives.map((objective: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="flex-shrink-0 text-slate-400">-</span>
                      <span>{objective}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {Array.isArray(content.tasks) && content.tasks.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Tasks</h4>
                <div className="space-y-3">
                  {content.tasks.map((task: any, index: number) => (
                    <div key={task.id || index} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-900">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center font-medium text-emerald-700 dark:text-emerald-200">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium">
                            {task.title}
                          </h5>
                          {task.description && (
                            <p className="mt-1">
                              {task.description}
                            </p>
                          )}
                          {Array.isArray(task.requirements) && task.requirements.length > 0 && (
                            <ul className="text-slate-600 dark:text-slate-400 mt-2 space-y-1 list-disc list-inside">
                              {task.requirements.slice(0, 2).map((req: string, i: number) => (
                                <li key={i}>{req}</li>
                              ))}
                              {task.requirements.length > 2 && (
                                <li>+{task.requirements.length - 2} more requirements</li>
                              )}
                            </ul>
                          )}
                          {task.estimatedTime && (
                            <p className="mt-2 text-slate-500 dark:text-slate-400">
                              Estimated time: {task.estimatedTime}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {content.submissionGuidelines && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Submission Guidelines:</h4>
                <div className="space-y-2 text-amber-800 dark:text-amber-200">
                  {content.submissionGuidelines.format && (
                    <p><span className="font-medium">Format:</span> {content.submissionGuidelines.format}</p>
                  )}
                  {content.submissionGuidelines.deadline && (
                    <p><span className="font-medium">Deadline:</span> {content.submissionGuidelines.deadline}</p>
                  )}
                  {content.submissionGuidelines.instructions && (
                    <p><span className="font-medium">Instructions:</span> {content.submissionGuidelines.instructions}</p>
                  )}
                </div>
              </div>
            )}
            
            {Array.isArray(content.rubric) && content.rubric.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-3">Grading Rubric</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-purple-200 dark:border-purple-800">
                        <th className="px-3 py-2 font-medium text-purple-900 dark:text-purple-100">Criterion</th>
                        <th className="px-3 py-2 font-medium text-purple-900 dark:text-purple-100">Weight</th>
                        <th className="px-3 py-2 font-medium text-purple-900 dark:text-purple-100">Exemplary</th>
                        <th className="px-3 py-2 font-medium text-purple-900 dark:text-purple-100">Proficient</th>
                        <th className="px-3 py-2 font-medium text-purple-900 dark:text-purple-100">Developing</th>
                        <th className="px-3 py-2 font-medium text-purple-900 dark:text-purple-100">Beginning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.rubric.map((criterion: any, index: number) => (
                        <tr key={index} className="border-b border-purple-100 align-top last:border-b-0 dark:border-purple-900">
                          <td className="px-3 py-3 font-medium text-purple-900 dark:text-purple-100">{criterion.criterion}</td>
                          <td className="px-3 py-3 text-purple-700 dark:text-purple-300">{criterion.weight}%</td>
                          <td className="px-3 py-3 text-purple-700 dark:text-purple-300">{criterion.exemplary}</td>
                          <td className="px-3 py-3 text-purple-700 dark:text-purple-300">{criterion.proficient}</td>
                          <td className="px-3 py-3 text-purple-700 dark:text-purple-300">{criterion.developing}</td>
                          <td className="px-3 py-3 text-purple-700 dark:text-purple-300">{criterion.beginning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {Array.isArray(content.resources) && content.resources.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Resources</h4>
                <ul className="space-y-1">
                  {content.resources.map((resource: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-slate-400 flex-shrink-0">-</span>
                      <span>{resource}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {Array.isArray(content.tips) && content.tips.length > 0 && (
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Tips for Success:</h4>
                <ul className="space-y-1">
                  {content.tips.map((tip: string, index: number) => (
                    <li key={index} className="text-green-800 dark:text-green-200 flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 flex-shrink-0">Tip:</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      case "list":
        return (
          <div className="rise-content space-y-3" data-testid={`content-list-${contentBlock.id}`}>
            {content.title && (
              <h4 className="font-medium">{content.title}</h4>
            )}
            {Array.isArray(content.items) && content.items.length > 0 ? (
              content.type === 'ordered' ? (
                <ol className="list-decimal list-inside space-y-2">
                  {content.items.map((item: any, index: number) => (
                    <li key={index}>
                      {item.text || `List item ${index + 1}`}
                    </li>
                  ))}
                </ol>
              ) : (
                <ul className="list-disc list-inside space-y-2">
                  {content.items.map((item: any, index: number) => (
                    <li key={index}>
                      {item.text || `List item ${index + 1}`}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No list items configured yet
              </div>
            )}
          </div>
        );

      case "process-flow":
        return (
          <div className="rise-content space-y-4" data-testid={`content-process-flow-${contentBlock.id}`}>
            {content.title && (
              <h4 className="mb-4 font-medium">{content.title}</h4>
            )}
            {Array.isArray(content.steps) && content.steps.length > 0 ? (
              <div className="space-y-6">
                {content.steps.map((step: any, index: number) => (
                  <div key={index} className="relative flex items-start space-x-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                      <span className="font-semibold text-slate-700">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="mb-1 font-medium">
                        {step.title || `Step ${index + 1}`}
                      </h5>
                      {step.description && (
                        <p>
                          {step.description}
                        </p>
                      )}
                    </div>
                    {index < content.steps.length - 1 && (
                      <div className="absolute left-5 top-11 h-6 w-px bg-slate-200"></div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No process steps configured yet
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-muted-foreground" data-testid={`content-default-${contentBlock.id}`}>
            Content for {contentBlock.type} would be rendered here...
          </div>
        );
    }
  };

  if (previewMode) {
    // Preview mode - show only content without editing controls
    return (
      <BlockErrorBoundary blockId={contentBlock.id} blockType={contentBlock.type}>
        <div className="rise-shell rise-preview-surface rise-content content-block-preview border-b border-slate-200 py-4 last:border-b-0" data-testid={`content-block-preview-${contentBlock.id}`}>
          {renderContent()}
        </div>
      </BlockErrorBoundary>
    );
  }

  return (
    <BlockErrorBoundary blockId={contentBlock.id} blockType={contentBlock.type}>
      <div 
        ref={ref}
        data-handler-id={handlerId}
        className="rise-shell rise-editor-surface relative group"
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
      {/* Floating action buttons on the left side - shown on group hover */}
      {!previewMode && (
        <div className="absolute -left-6 top-8 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {(contentBlock.type === "quiz" || contentBlock.type === "ai-quiz") && (
            <Button
              onClick={() => {
                // Open dedicated quiz editor in new window
                const editUrl = `/quiz/${contentBlock.id}/edit`;
                window.open(editUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
              }}
              variant="outline"
              size="icon"
            className="h-9 w-9 rounded-full border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-600 dark:bg-gray-800 dark:hover:bg-blue-950"
              data-testid={`button-edit-quiz-${contentBlock.id}`}
              title="Edit quiz in dedicated editor"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleDuplicate}
            className="h-9 w-9 rounded-full border-slate-200 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
            data-testid={`button-duplicate-${contentBlock.id}`}
            title="Duplicate block"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleDelete}
            className="h-9 w-9 rounded-full border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 dark:bg-gray-800 dark:hover:bg-red-950"
            data-testid={`button-delete-${contentBlock.id}`}
            title="Delete block"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div
            ref={dragHandleRef}
            className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing flex items-center justify-center"
            data-testid={`button-move-${contentBlock.id}`}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}
      <div 
        className="rise-shell rise-editor-surface rise-content content-block border-b border-slate-200 bg-transparent py-1 last:border-b-0"
        data-testid={`content-block-${contentBlock.id}`}
      >
        {renderEditingInterface()}
      </div>
      
      {/* AI Quiz Generation Dialog */}
      {contentBlock.type === "ai-quiz" && (
        <AiQuizGenerationDialog
          open={showQuizDialog}
          onOpenChange={setShowQuizDialog}
          moduleId={contentBlock.moduleId}
          onQuizGenerated={(questions) => {            
            const updatedContent = { 
              ...editedContent, 
              questions,
              // Ensure we have a title if none exists
              title: editedContent.title || "Generated Quiz",
              // Ensure we have proper structure
              description: editedContent.description || "",
              // Mark as generated
              isGenerated: true
            };
            setEditedContent(updatedContent);
            setShowQuizDialog(false);
          }}
          defaultPrompt={`Generate quiz questions for this lesson content. Focus on testing understanding of key concepts and learning objectives.`}
        />
      )}

      {/* AI Assignment Generation Dialog */}
      {contentBlock.type === "ai-assignment" && (
        <AiAssignmentGenerationDialog
          open={showAssignmentDialog}
          onOpenChange={setShowAssignmentDialog}
          moduleId={contentBlock.moduleId}
          onAssignmentGenerated={(assignment) => {            
            const updatedContent = { 
              ...editedContent, 
              ...assignment,
              // Ensure proper structure
              isGenerated: true
            };
            setEditedContent(updatedContent);
            setShowAssignmentDialog(false);
          }}
          defaultPrompt={`Create an assignment that helps students apply and demonstrate their understanding of the key concepts from this lesson module.`}
        />
      )}
      </div>
    </BlockErrorBoundary>
  );
}


