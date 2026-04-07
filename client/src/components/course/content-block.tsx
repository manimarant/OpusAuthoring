import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Sparkles, Trash2, Copy, MoveVertical, Play, Pause, Edit, ChevronDown, ChevronLeft, ChevronRight, RotateCw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SanitizedHTML } from "@/components/ui/sanitized-html";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentBlock, Module } from "@shared/schema";
import InlineAiAssistant from "@/components/ai/inline-ai-assistant";
import AiQuizGenerationDialog from "@/components/ai/ai-quiz-generation-dialog";
import AiAssignmentGenerationDialog from "@/components/ai/ai-assignment-generation-dialog";
import InteractiveQuiz from "@/components/course/interactive-quiz";
import { useDebounce } from "../../hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { useDrag, useDrop } from "react-dnd";
import type { Identifier } from "dnd-core";
import { getImageDisplayProps } from "@/utils/image-generation";
import { useLocation } from "wouter";

interface ContentBlockComponentProps {
  contentBlock: ContentBlock;
  previewMode?: boolean;
  onMoveBlock?: (dragId: string, hoverId: string) => void;
  onContentChange?: (blockId: string, content: Record<string, any>) => void;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export default function ContentBlockComponent({
  contentBlock,
  previewMode = false,
  onMoveBlock,
  onContentChange,
}: ContentBlockComponentProps) {
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
  const [activeGraphicLabel, setActiveGraphicLabel] = useState(0);
  const [activeGalleryCarouselIndex, setActiveGalleryCarouselIndex] = useState(0);
  const [selectedScenarioChoice, setSelectedScenarioChoice] = useState<number | null>(null);
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
  const saveQueueRef = useRef(Promise.resolve());
  
  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
  }>({ isPlaying: false, currentTime: 0, duration: 0 });
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);
  const [, setLocation] = useLocation();
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

  useEffect(() => {
    if (!previewMode) {
      onContentChange?.(contentBlock.id, editedContent);
    }
  }, [contentBlock.id, editedContent, onContentChange, previewMode]);

  useEffect(() => {
    setActiveTimelineEvent(0);
    setActiveGraphicLabel(0);
    setActiveGalleryCarouselIndex(0);
    setSelectedScenarioChoice(null);
  }, [contentBlock.id]);

  const getStoredFileUrl = (storageKey: string) =>
    /^https?:\/\//i.test(storageKey) ? storageKey : `/uploads/${storageKey}`;

  const { data: currentModule } = useQuery<Module>({
    queryKey: ["/api/modules", contentBlock.moduleId],
    enabled: Boolean(contentBlock.moduleId),
    staleTime: 30000,
    placeholderData: (previousData: Module | undefined) => previousData,
  });

  const { data: courseModules } = useQuery<Module[]>({
    queryKey: ["/api/courses", currentModule?.courseId, "modules"],
    enabled: Boolean(currentModule?.courseId),
    staleTime: 30000,
    placeholderData: (previousData: Module[] | undefined) => previousData,
  });

  const nextLessonPath = useMemo(() => {
    if (!currentModule || !courseModules || courseModules.length === 0) {
      return "";
    }

    const sortedModules = [...courseModules].sort((a, b) => parseInt(a.order) - parseInt(b.order));
    const topLevelModules = sortedModules.filter((module) => !module.parentModuleId);
    const lessonSequence: Module[] = [];

    for (const topLevelModule of topLevelModules) {
      const childLessons = sortedModules
        .filter((candidate) => candidate.parentModuleId === topLevelModule.id)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));

      if (childLessons.length > 0) {
        lessonSequence.push(...childLessons);
      } else {
        lessonSequence.push(topLevelModule);
      }
    }

    const currentIndex = lessonSequence.findIndex((module) => module.id === contentBlock.moduleId);
    const nextLesson = currentIndex >= 0 ? lessonSequence[currentIndex + 1] : null;
    return nextLesson ? `/module/${nextLesson.id}/content` : "";
  }, [contentBlock.moduleId, courseModules, currentModule]);

  const renderImagePlaceholder = (title: string, description: string, compact = false) => (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl bg-slate-100/70 text-center ${
        compact ? "min-h-[56px] px-4 py-2" : "min-h-[64px] px-6 py-3"
      }`}
    >
      <h4 className="text-base font-medium text-slate-900">{title}</h4>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );

  const renderImageUploadSurface = (
    key: string,
    currentUrl: string,
    altText: string,
    title: string,
    description: string,
    onUploaded: (url: string, fileName: string) => void,
    options?: { compact?: boolean; aspectClassName?: string; borderless?: boolean },
  ) => {
    const compact = options?.compact ?? false;
    const aspectClassName = options?.aspectClassName ?? (compact ? "aspect-[16/8]" : "aspect-[16/6]");
    const borderless = options?.borderless ?? false;

    return (
      <div className={`group relative w-full overflow-hidden rounded-2xl bg-slate-100/70 ${aspectClassName} ${borderless ? "" : ""}`}>
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={altText}
            className="h-full w-full object-cover"
          />
        ) : (
          renderImagePlaceholder(title, description, compact)
        )}
        <label className="absolute inset-0 flex cursor-pointer items-end justify-end p-3">
          <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm">
            {uploadingImageKey === key ? "Uploading..." : currentUrl ? "Replace image" : "Upload image"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploadingImageKey === key}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              void handleImageAssetUpload(key, file, onUploaded);
              e.currentTarget.value = "";
            }}
            data-testid={`input-inline-image-file-${key}`}
          />
        </label>
      </div>
    );
  };

  const normalizeGalleryLayout = (layout: string | undefined) => {
    if (layout === "carousel" || layout === "two-column-grid" || layout === "three-column-grid") {
      return layout;
    }
    return "";
  };

  const getGallerySlotCount = (layout: string | undefined) => {
    const normalizedLayout = normalizeGalleryLayout(layout);
    if (!normalizedLayout) {
      return 0;
    }
    if (normalizedLayout === "carousel") {
      return 3;
    }
    if (normalizedLayout === "two-column-grid") {
      return 2;
    }
    return 3;
  };

  const getGallerySlots = (content: any, options?: { preserveAll?: boolean }) => {
    const slotCount = getGallerySlotCount(content.layout);
    const images = Array.isArray(content.images) ? content.images : [];
    const totalSlots = options?.preserveAll ? Math.max(images.length, slotCount) : slotCount;
    return Array.from({ length: totalSlots }, (_, index) => ({
      url: typeof images[index]?.url === "string" ? images[index].url : "",
      alt: typeof images[index]?.alt === "string" ? images[index].alt : "",
    }));
  };

  const buildGalleryImagesFromLatest = (
    layout: "carousel" | "two-column-grid" | "three-column-grid",
    updater: (images: { url: string; alt: string }[]) => { url: string; alt: string }[],
  ) => {
    const latestContent = latestEditedContentRef.current as any;
    const latestImages = getGallerySlots({
      ...latestContent,
      layout,
    }, { preserveAll: true });
    return updater(latestImages);
  };

  const handleImageAssetUpload = async (
    key: string,
    file: File | null,
    onUploaded: (url: string, fileName: string) => void,
  ) => {
    if (!file) {
      toast({
        title: "No image selected",
        description: "Choose an image file first.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingImageKey(key);
      const moduleResponse = await apiRequest("GET", `/api/modules/${contentBlock.moduleId}`);
      const module = await moduleResponse.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", "image");

      const assetResponse = await apiRequest("POST", `/api/courses/${module.courseId}/media-upload`, formData);
      const asset = await assetResponse.json();
      onUploaded(getStoredFileUrl(asset.filename), file.name);
      toast({
        title: "Image uploaded",
        description: "The block now uses the uploaded image.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImageKey(null);
    }
  };

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

  const saveContentImmediately = (nextContent: Record<string, any>) => {
    setEditedContent(nextContent);
    const nextContentString = JSON.stringify(nextContent);
    lastSavedContentRef.current = nextContentString;
    setIsSaving(true);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await apiRequest("PUT", `/api/content-blocks/${contentBlock.id}`, {
          content: nextContent,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/modules", contentBlock.moduleId, "content-blocks"] });
      })
      .catch((error) => {
        console.error("Failed to save content immediately:", error);
        toast({
          title: "Error",
          description: "Failed to save changes. Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

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

  const handleContinueAction = (content: any) => {
    const action = content.action || "next_lesson";

    if (action === "external_url") {
      const url = String(content.url || "").trim();
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (nextLessonPath) {
      setLocation(nextLessonPath);
    }
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
  const inlineInputClass =
    "w-full border-0 bg-transparent px-0 py-0 text-inherit shadow-none placeholder:text-inherit/60 focus-visible:ring-0 focus-visible:ring-offset-0";
  const inlineTextareaClass = `min-h-0 w-full resize-none border-0 bg-transparent px-0 py-0 text-inherit shadow-none placeholder:text-inherit/60 focus-visible:ring-0 focus-visible:ring-offset-0`;

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

  const renderListBlock = (content: any, editable = false) => {
    const listType = content.type === "ordered" ? "ordered" : "unordered";
    const items = Array.isArray(content.items) ? content.items : [];

    return (
      <div
        className={editable ? "rounded-2xl border border-transparent px-4 py-3 transition-colors group-hover:border-slate-200 focus-within:border-slate-300" : "space-y-4"}
        data-testid={`${editable ? "edit" : "content"}-list-${contentBlock.id}`}
      >
        <div className="space-y-3">
        {editable ? (
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="List title"
            className={`${inlineInputClass} text-lg font-semibold text-slate-900`}
            data-testid={`input-list-title-${contentBlock.id}`}
          />
        ) : content.title ? (
          <h3 className="text-lg font-semibold text-slate-900">{content.title}</h3>
        ) : null}

        {items.length > 0 ? (
          <div className={editable ? "space-y-2" : "space-y-3"}>
            {items.map((item: any, index: number) => {
              const itemTitle = typeof item === "string"
                ? item
                : String(item?.title || item?.text || "");
              const itemDescription = typeof item === "string"
                ? ""
                : String(item?.description || "");
              const marker = listType === "ordered" ? `${index + 1}` : "";

              return (
                <div key={index} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 ${editable ? "py-0.5" : ""}`}>
                  <div
                    className={`mt-0.5 flex min-h-7 min-w-7 items-center justify-center text-sm font-semibold ${
                      listType === "ordered"
                        ? "rounded-full border border-slate-200 px-2 text-slate-700"
                        : "text-slate-400"
                    }`}
                    data-testid={`list-marker-${index}-${contentBlock.id}`}
                  >
                    {listType === "ordered" ? marker : "•"}
                  </div>

                  {editable ? (
                    <div className="space-y-1">
                      <div className="flex items-start gap-3">
                        <Input
                          value={itemTitle}
                          onChange={(e) => {
                            const nextItems = [...items];
                            const nextItem =
                              typeof nextItems[index] === "string"
                                ? { title: e.target.value, description: "", label: "" }
                                : { ...(nextItems[index] || {}), title: e.target.value };
                            nextItems[index] = nextItem;
                            setEditedContent({ ...content, items: nextItems });
                          }}
                          placeholder={`Subheading ${index + 1}`}
                          className={`${inlineInputClass} pt-0.5 text-base font-semibold leading-7 text-slate-900`}
                          data-testid={`input-list-item-title-${index}-${contentBlock.id}`}
                        />
                      </div>
                      <Textarea
                        value={itemDescription}
                        onChange={(e) => {
                          const nextItems = [...items];
                          const nextItem =
                            typeof nextItems[index] === "string"
                              ? { title: itemTitle, description: e.target.value, label: "" }
                              : { ...(nextItems[index] || {}), description: e.target.value };
                          nextItems[index] = nextItem;
                          setEditedContent({ ...content, items: nextItems });
                        }}
                        placeholder={`Paragraph ${index + 1}`}
                        className={`${inlineTextareaClass} min-h-[44px] text-sm leading-6 text-slate-600`}
                        data-testid={`input-list-item-description-${index}-${contentBlock.id}`}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 pt-0.5">
                      <div className="text-base font-semibold leading-7 text-slate-900">
                        {itemTitle || `Subheading ${index + 1}`}
                      </div>
                      <div className="text-sm leading-7 text-slate-600">
                        {itemDescription || "Add paragraph text for this list item."}
                      </div>
                    </div>
                  )}

                  {editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextItems = [...items];
                        nextItems.splice(index, 1);
                        setEditedContent({ ...content, items: nextItems });
                      }}
                      data-testid={`button-remove-list-item-${index}-${contentBlock.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        ) : editable ? (
          <div className="py-2 text-base text-slate-400">Add the first list item.</div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant={listType === "ordered" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setEditedContent({ ...content, type: "ordered" })}
              data-testid={`button-list-ordered-${contentBlock.id}`}
            >
              Numbered
            </Button>
            <Button
              variant={listType === "unordered" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setEditedContent({ ...content, type: "unordered" })}
              data-testid={`button-list-unordered-${contentBlock.id}`}
            >
              Bullets
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                const nextItems = [...items, listType === "ordered" ? { title: "", description: "", label: "" } : { title: "", description: "" }];
                setEditedContent({ ...content, items: nextItems });
              }}
              data-testid={`button-add-list-item-${contentBlock.id}`}
            >
              Add item
            </Button>
          </div>
        ) : null}
        </div>
      </div>
    );
  };

  const renderAccordionBlock = (content: any, editable = false) => {
    const items = Array.isArray(content.items) ? content.items : [];
    return (
      <div className="space-y-2" data-testid={`${editable ? "edit" : "content"}-accordion-${contentBlock.id}`}>
        {editable ? (
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="Accordion title"
            className={`${inlineInputClass} mb-3 text-lg font-semibold text-slate-900`}
            data-testid={`input-accordion-title-${contentBlock.id}`}
          />
        ) : content.title ? (
          <h3 className="mb-3 text-lg font-semibold text-slate-900">{content.title}</h3>
        ) : null}
        {items.map((item: any, index: number) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => toggleAccordionItem(index)}
              data-testid={`button-toggle-accordion-item-${index}-${contentBlock.id}`}
            >
              {editable ? (
                <Input
                  value={item.title || ""}
                  onChange={(e) => {
                    const nextItems = [...items];
                    nextItems[index] = { ...(nextItems[index] || {}), title: e.target.value };
                    setEditedContent({ ...content, items: nextItems });
                  }}
                  placeholder={`Section ${index + 1}`}
                  className={`${inlineInputClass} font-medium text-slate-900`}
                  data-testid={`input-accordion-item-title-${index}-${contentBlock.id}`}
                />
              ) : (
                <h4 className="font-medium text-slate-900">{item.title || `Accordion Item ${index + 1}`}</h4>
              )}
              <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expandedAccordionItems[index] ? "rotate-180" : ""}`} />
            </button>
            {expandedAccordionItems[index] ? (
              <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                {editable ? (
                  <div className="space-y-3">
                    <Textarea
                      value={item.content || ""}
                      onChange={(e) => {
                        const nextItems = [...items];
                        nextItems[index] = { ...(nextItems[index] || {}), content: e.target.value };
                        setEditedContent({ ...content, items: nextItems });
                      }}
                      placeholder="Section content"
                      className={`${inlineTextareaClass} min-h-[88px] text-sm leading-7 text-slate-600`}
                      data-testid={`input-accordion-item-content-${index}-${contentBlock.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextItems = [...items];
                        nextItems.splice(index, 1);
                        setEditedContent({ ...content, items: nextItems });
                      }}
                      data-testid={`button-remove-accordion-item-${index}-${contentBlock.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  item.content || "Content for this accordion section would appear here when expanded."
                )}
              </div>
            ) : null}
          </div>
        ))}
        {editable ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setEditedContent({ ...content, items: [...items, { title: "", content: "" }] })}
            data-testid={`button-add-accordion-item-${contentBlock.id}`}
          >
            Add item
          </Button>
        ) : null}
      </div>
    );
  };

  const renderFlashcardsBlock = (content: any, editable = false) => {
    const cards = Array.isArray(content.cards) ? content.cards : [];
    return (
      <div className="space-y-4" data-testid={`${editable ? "edit" : "content"}-flashcards-${contentBlock.id}`}>
        {editable ? (
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="Flashcards title"
            className={`${inlineInputClass} text-lg font-semibold text-slate-900`}
            data-testid={`input-flashcards-title-${contentBlock.id}`}
          />
        ) : content.title ? (
          <h3 className="text-lg font-semibold text-slate-900">{content.title}</h3>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card: any, index: number) => (
            <div
              key={index}
              className={`group relative text-left ${cards.length === 3 && index === 2 ? "md:col-span-2 md:mx-auto md:w-[calc(50%-0.5rem)]" : ""}`}
              data-testid={`button-toggle-flashcard-${index}-${contentBlock.id}`}
            >
              {editable ? (
                <div className="absolute right-3 top-3 z-30 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFlashcard(index)}
                    data-testid={`button-flip-flashcard-${index}-${contentBlock.id}`}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nextCards = [...cards];
                      nextCards.splice(index, 1);
                      setEditedContent({ ...content, cards: nextCards });
                    }}
                    data-testid={`button-remove-flashcard-${index}-${contentBlock.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              <div className={`relative min-h-[220px] rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] ${flippedFlashcards[index] ? "[transform:rotateY(180deg)]" : ""}`}>
                {!editable ? (
                  <button
                    type="button"
                    onClick={() => toggleFlashcard(index)}
                    className="absolute inset-0 z-10 rounded-2xl"
                    aria-label={`Flip flashcard ${index + 1}`}
                  />
                ) : null}
                <div className="absolute inset-0 flex min-h-[220px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [backface-visibility:hidden]">
                  <div className="py-4 pr-16">
                    {editable ? (
                      <Input
                        value={card.front || ""}
                        onChange={(e) => {
                          const nextCards = [...cards];
                          nextCards[index] = { ...(nextCards[index] || {}), front: e.target.value };
                          setEditedContent({ ...content, cards: nextCards });
                        }}
                        placeholder={`Card ${index + 1} front`}
                        className={`${inlineInputClass} relative z-20 text-lg font-medium leading-relaxed text-slate-900`}
                        data-testid={`input-flashcard-front-${index}-${contentBlock.id}`}
                      />
                    ) : (
                      <h4 className="relative z-20 text-lg font-medium leading-relaxed text-slate-900">{card.front || `Flashcard ${index + 1}`}</h4>
                    )}
                  </div>
                  {!editable ? (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                      <span>Click to flip</span>
                      <RotateCw className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
                <div className="absolute inset-0 flex min-h-[220px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="py-4 pr-16">
                    {editable ? (
                      <Textarea
                        value={card.back || ""}
                        onChange={(e) => {
                          const nextCards = [...cards];
                          nextCards[index] = { ...(nextCards[index] || {}), back: e.target.value };
                          setEditedContent({ ...content, cards: nextCards });
                        }}
                        placeholder={`Card ${index + 1} back`}
                        className={`${inlineTextareaClass} relative z-20 min-h-[88px] text-lg font-medium leading-relaxed text-slate-900`}
                        data-testid={`input-flashcard-back-${index}-${contentBlock.id}`}
                      />
                    ) : (
                      <h4 className="relative z-20 text-lg font-medium leading-relaxed text-slate-900">{card.back || ""}</h4>
                    )}
                  </div>
                  {!editable ? (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
                      <span>Click to flip</span>
                      <RotateCw className="h-4 w-4 rotate-180" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        {editable ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setEditedContent({ ...content, cards: [...cards, { front: "", back: "" }] })}
            data-testid={`button-add-flashcard-${contentBlock.id}`}
          >
            Add card
          </Button>
        ) : null}
      </div>
    );
  };

  const renderTimelineBlock = (content: any, editable = false) => {
    const events = (Array.isArray(content.events) ? content.events : []).slice(0, 6);
    const selectedEvent = events[activeTimelineEvent] || events[0];
    return (
      <div className="space-y-4" data-testid={`${editable ? "edit" : "content"}-timeline-${contentBlock.id}`}>
        {editable ? (
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="Timeline title"
            className={`${inlineInputClass} text-lg font-semibold text-slate-900`}
            data-testid={`input-timeline-title-${contentBlock.id}`}
          />
        ) : content.title ? (
          <h3 className="text-lg font-semibold text-slate-900">{content.title}</h3>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            {events.map((event: any, index: number) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveTimelineEvent(index)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  activeTimelineEvent === index ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                data-testid={`button-select-timeline-event-${index}-${contentBlock.id}`}
              >
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200">
                  <div className="h-3 w-3 rounded-full bg-slate-700" />
                </div>
                <div className="min-w-0">
                  {editable ? (
                    <>
                      <Input
                        value={event.date || ""}
                        onChange={(e) => {
                          const nextEvents = [...events];
                          nextEvents[index] = { ...(nextEvents[index] || {}), date: e.target.value };
                          setEditedContent({ ...content, events: nextEvents });
                        }}
                        placeholder="Date"
                        className={`${inlineInputClass} text-xs font-semibold uppercase tracking-[0.14em] text-slate-500`}
                        data-testid={`input-timeline-date-${index}-${contentBlock.id}`}
                      />
                      <Input
                        value={event.title || ""}
                        onChange={(e) => {
                          const nextEvents = [...events];
                          nextEvents[index] = { ...(nextEvents[index] || {}), title: e.target.value };
                          setEditedContent({ ...content, events: nextEvents });
                        }}
                        placeholder={`Event ${index + 1}`}
                        className={`${inlineInputClass} mt-1 font-medium text-slate-900`}
                        data-testid={`input-timeline-event-title-${index}-${contentBlock.id}`}
                      />
                    </>
                  ) : (
                    <>
                      {event.date ? <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{event.date}</div> : null}
                      <div className="mt-1 font-medium text-slate-900">{event.title || `Event ${index + 1}`}</div>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {editable ? (
              <div className="space-y-3">
                <Input
                  value={selectedEvent?.date || ""}
                  onChange={(e) => {
                    const nextEvents = [...events];
                    if (nextEvents[activeTimelineEvent]) {
                      nextEvents[activeTimelineEvent] = { ...(nextEvents[activeTimelineEvent] || {}), date: e.target.value };
                      setEditedContent({ ...content, events: nextEvents });
                    }
                  }}
                  placeholder="Date"
                  className={`${inlineInputClass} text-xs font-semibold uppercase tracking-[0.16em] text-slate-500`}
                  data-testid={`input-timeline-selected-date-${contentBlock.id}`}
                />
                <Input
                  value={selectedEvent?.title || ""}
                  onChange={(e) => {
                    const nextEvents = [...events];
                    if (nextEvents[activeTimelineEvent]) {
                      nextEvents[activeTimelineEvent] = { ...(nextEvents[activeTimelineEvent] || {}), title: e.target.value };
                      setEditedContent({ ...content, events: nextEvents });
                    }
                  }}
                  placeholder="Timeline event"
                  className={`${inlineInputClass} text-xl font-semibold text-slate-900`}
                  data-testid={`input-timeline-selected-title-${contentBlock.id}`}
                />
                <Textarea
                  value={selectedEvent?.description || ""}
                  onChange={(e) => {
                    const nextEvents = [...events];
                    if (nextEvents[activeTimelineEvent]) {
                      nextEvents[activeTimelineEvent] = { ...(nextEvents[activeTimelineEvent] || {}), description: e.target.value };
                      setEditedContent({ ...content, events: nextEvents });
                    }
                  }}
                  placeholder="Describe this event"
                  className={`${inlineTextareaClass} min-h-[120px] text-sm leading-7 text-slate-600`}
                  data-testid={`input-timeline-selected-description-${contentBlock.id}`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setEditedContent({ ...content, events: [...events, { date: "", title: "", description: "" }] })}
                  data-testid={`button-add-timeline-event-${contentBlock.id}`}
                >
                  Add event
                </Button>
              </div>
            ) : (
              <>
                {selectedEvent?.date ? <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{selectedEvent.date}</div> : null}
                <h4 className="mt-2 text-xl font-semibold text-slate-900">{selectedEvent?.title || "Timeline event"}</h4>
                <p className="mt-3 text-sm leading-7 text-slate-600">{selectedEvent?.description || "Select a timeline event to read the detail."}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderScenarioBlock = (content: any, editable = false) => {
    const choices = Array.isArray(content.choices) ? content.choices : [];
    const activeChoice = selectedScenarioChoice !== null ? choices[selectedScenarioChoice] : null;
    return (
      <div className="rounded-lg border border-slate-200 bg-transparent p-4" data-testid={`${editable ? "edit" : "content"}-scenario-${contentBlock.id}`}>
        <div className="flex items-start space-x-3">
          <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Scenario</div>
          <div className="flex-1">
            {editable ? (
              <>
                <Input
                  value={content.title || ""}
                  onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                  placeholder="Interactive Scenario"
                  className={`${inlineInputClass} mb-2 font-medium text-slate-900`}
                  data-testid={`input-scenario-title-${contentBlock.id}`}
                />
                <Textarea
                  value={content.description || ""}
                  onChange={(e) => setEditedContent({ ...content, description: e.target.value })}
                  placeholder="Describe the scenario"
                  className={`${inlineTextareaClass} mb-3 min-h-[64px] text-sm text-slate-500`}
                  data-testid={`input-scenario-description-${contentBlock.id}`}
                />
              </>
            ) : (
              <>
                <h4 className="mb-2 font-medium text-slate-900">{content.title || "Interactive Scenario"}</h4>
                <p className="mb-3 text-sm text-slate-500">{content.description || "This scenario presents learners with realistic situations and decision-making opportunities."}</p>
              </>
            )}
            <div className="space-y-2">
              {choices.map((choice: any, index: number) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedScenarioChoice(index)}
                  className={`w-full rounded p-2 text-left text-sm transition-colors ${
                    selectedScenarioChoice === index ? "bg-slate-900 text-white" : "border border-slate-200 bg-transparent text-slate-700 hover:border-slate-300"
                  }`}
                  data-testid={`button-scenario-choice-${index}-${contentBlock.id}`}
                >
                  {editable ? (
                    <Input
                      value={choice.text || ""}
                      onChange={(e) => {
                        const nextChoices = [...choices];
                        nextChoices[index] = { ...(nextChoices[index] || {}), text: e.target.value };
                        setEditedContent({ ...content, choices: nextChoices });
                      }}
                      placeholder={`Choice ${index + 1}`}
                      className={`${inlineInputClass} ${selectedScenarioChoice === index ? "text-white placeholder:text-white/70" : "text-slate-700"}`}
                      data-testid={`input-scenario-choice-${index}-${contentBlock.id}`}
                    />
                  ) : (
                    choice.text || `Choice ${index + 1}`
                  )}
                </button>
              ))}
            </div>
            {activeChoice ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-transparent p-3 text-sm text-slate-700 shadow-sm">
                {editable ? (
                  <Textarea
                    value={activeChoice.feedback || activeChoice.outcome || ""}
                    onChange={(e) => {
                      const nextChoices = [...choices];
                      nextChoices[selectedScenarioChoice ?? 0] = { ...(nextChoices[selectedScenarioChoice ?? 0] || {}), feedback: e.target.value };
                      setEditedContent({ ...content, choices: nextChoices });
                    }}
                    placeholder="Feedback for the selected choice"
                    className={`${inlineTextareaClass} min-h-[88px] text-sm leading-7 text-slate-700`}
                    data-testid={`input-scenario-feedback-${contentBlock.id}`}
                  />
                ) : (
                  activeChoice.feedback || activeChoice.outcome || "Add feedback to this choice in edit mode to display the learner outcome."
                )}
              </div>
            ) : null}
            {editable ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-full"
                onClick={() => setEditedContent({ ...content, choices: [...choices, { text: "", feedback: "" }] })}
                data-testid={`button-add-scenario-choice-${contentBlock.id}`}
              >
                Add choice
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderLabeledGraphicBlock = (content: any, editable = false) => {
    const labels = Array.isArray(content.labels) ? content.labels : [];
    const selectedLabel = labels[activeGraphicLabel] || labels[0];
    const imageUrl = content.image?.url || `https://picsum.photos/seed/labeled-${contentBlock.id}/600/400`;
    const imageAlt = content.image?.alt || "Labeled graphic";

    return (
      <div className="space-y-4" data-testid={`${editable ? "edit" : "content"}-labeled-graphic-${contentBlock.id}`}>
        <div className="relative overflow-hidden rounded-lg aspect-video bg-slate-100">
          <img src={imageUrl} alt={imageAlt} className="h-full w-full object-cover" />
          {labels.map((label: any, index: number) => (
            <button
              type="button"
              key={index}
              className={`absolute flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-sm transition-all ${
                activeGraphicLabel === index
                  ? "border-white bg-slate-900 scale-110"
                  : "border-slate-100 bg-slate-600 hover:bg-slate-700"
              }`}
              style={{
                left: `${typeof label.x === "number" || /^\d+(\.\d+)?$/.test(String(label.x || "")) ? Number(label.x) : 20 + index * 25}%`,
                top: `${typeof label.y === "number" || /^\d+(\.\d+)?$/.test(String(label.y || "")) ? Number(label.y) : 30 + index * 20}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={() => setActiveGraphicLabel(index)}
              data-testid={`button-labeled-graphic-label-${index}-${contentBlock.id}`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {editable ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
              <Input
                value={content.image?.url || ""}
                onChange={(e) => setEditedContent({ ...content, image: { ...(content.image || {}), url: e.target.value } })}
                placeholder="Image URL"
                className={editorFieldClass}
                data-testid={`input-labeled-graphic-image-url-${contentBlock.id}`}
              />
              <Input
                value={content.image?.alt || ""}
                onChange={(e) => setEditedContent({ ...content, image: { ...(content.image || {}), alt: e.target.value } })}
                placeholder="Alt text"
                className={editorFieldClass}
                data-testid={`input-labeled-graphic-image-alt-${contentBlock.id}`}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const nextIndex = labels.length;
                  setEditedContent({
                    ...content,
                    labels: [...labels, { title: "", content: "", x: Math.min(80, 20 + nextIndex * 15), y: Math.min(80, 25 + nextIndex * 12) }],
                  });
                  setActiveGraphicLabel(nextIndex);
                }}
                data-testid={`button-add-labeled-graphic-label-${contentBlock.id}`}
              >
                Add label
              </Button>
            </div>
            {selectedLabel ? (
              <div className="space-y-3">
                <Input
                  value={selectedLabel.title || ""}
                  onChange={(e) => {
                    const nextLabels = [...labels];
                    nextLabels[activeGraphicLabel] = { ...(nextLabels[activeGraphicLabel] || {}), title: e.target.value };
                    setEditedContent({ ...content, labels: nextLabels });
                  }}
                  placeholder={`Label ${activeGraphicLabel + 1} title`}
                  className={editorFieldClass}
                  data-testid={`input-labeled-graphic-label-title-${contentBlock.id}`}
                />
                <Textarea
                  value={selectedLabel.content || ""}
                  onChange={(e) => {
                    const nextLabels = [...labels];
                    nextLabels[activeGraphicLabel] = { ...(nextLabels[activeGraphicLabel] || {}), content: e.target.value };
                    setEditedContent({ ...content, labels: nextLabels });
                  }}
                  placeholder="What should display when this hotspot is clicked?"
                  className={`min-h-[88px] ${editorFieldClass}`}
                  data-testid={`input-labeled-graphic-label-content-${contentBlock.id}`}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={selectedLabel.x ?? ""}
                    onChange={(e) => {
                      const nextLabels = [...labels];
                      nextLabels[activeGraphicLabel] = { ...(nextLabels[activeGraphicLabel] || {}), x: e.target.value };
                      setEditedContent({ ...content, labels: nextLabels });
                    }}
                    placeholder="X position"
                    className={editorFieldClass}
                    data-testid={`input-labeled-graphic-label-x-${contentBlock.id}`}
                  />
                  <Input
                    value={selectedLabel.y ?? ""}
                    onChange={(e) => {
                      const nextLabels = [...labels];
                      nextLabels[activeGraphicLabel] = { ...(nextLabels[activeGraphicLabel] || {}), y: e.target.value };
                      setEditedContent({ ...content, labels: nextLabels });
                    }}
                    placeholder="Y position"
                    className={editorFieldClass}
                    data-testid={`input-labeled-graphic-label-y-${contentBlock.id}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const nextLabels = [...labels];
                    nextLabels.splice(activeGraphicLabel, 1);
                    setEditedContent({ ...content, labels: nextLabels });
                    setActiveGraphicLabel((prev) => Math.max(0, prev - 1));
                  }}
                  data-testid={`button-remove-labeled-graphic-label-${contentBlock.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {labels.length > 0 && selectedLabel ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Selected hotspot</div>
            <h4 className="mt-2 font-medium text-slate-900">{selectedLabel.title || `Label ${activeGraphicLabel + 1}`}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {selectedLabel.content || "Add content to this label to explain the selected part of the graphic."}
            </p>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Add hotspot labels to make this graphic interactive.</div>
        )}
      </div>
    );
  };

  const renderSortingActivityBlock = (content: any, editable = false) => {
    const items: Array<{ index: number; text: string; category: string }> = (Array.isArray(content.items) ? content.items : []).map((item: any, index: number) => ({
      index,
      text: typeof item === "string" ? item : String(item?.text || ""),
      category: typeof item === "string" ? "" : String(item?.category || ""),
    }));
    const categories: string[] = Array.isArray(content.categories) ? content.categories.map((category: any) => String(category || "")).filter(Boolean) : [];
    const unassignedItems = items.filter((item: { index: number }) => !sortingAssignments[item.index]);
    const currentSortingItem = unassignedItems[0] || null;
    const feedbackItems: Array<{ index: number; text: string; category: string; isCorrect: boolean; leaving?: boolean }> = Object.entries(sortingFeedback).map(([key, feedback]) => ({ index: Number(key), ...feedback }));

    return (
      <div className="space-y-6" data-testid={`${editable ? "edit" : "content"}-sorting-activity-${contentBlock.id}`}>
        {editable ? (
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="Sorting activity title"
            className={`${inlineInputClass} text-lg font-semibold text-slate-900`}
            data-testid={`input-sorting-title-${contentBlock.id}`}
          />
        ) : content.title ? (
          <h3 className="text-lg font-semibold text-slate-900">{content.title}</h3>
        ) : null}

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
              className={`flex min-h-[240px] w-full max-w-[340px] cursor-grab flex-col rounded-2xl border bg-white px-8 py-7 text-center shadow-sm transition-colors active:cursor-grabbing ${
                selectedSortingIndex === currentSortingItem.index ? "border-slate-900" : "border-slate-200"
              }`}
              data-testid={`sorting-item-${currentSortingItem.index}-${contentBlock.id}`}
            >
              <div className="mb-6 text-2xl text-slate-700">&#8801;</div>
              <div className="text-[15px] leading-10 text-slate-800">{currentSortingItem.text || `Item ${currentSortingItem.index + 1}`}</div>
            </div>
          ) : (
            <div className="flex min-h-[240px] w-full max-w-[340px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
              <div className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">Result</div>
              <div className="mt-4 text-3xl font-semibold text-slate-900">{items.filter((item: { index: number; category: string }) => item.category && sortingAssignments[item.index] === item.category).length}/{items.filter((item: { category: string }) => item.category).length || items.length}</div>
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
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category: string, categoryIndex: number) => {
            const categoryFeedbackItems = feedbackItems.filter((item: { category: string }) => item.category === category);
            return (
              <div
                key={categoryIndex}
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
                  } else if (draggedSortingIndex !== null) {
                    assignSortingItem(draggedSortingIndex, category);
                  }
                }}
                className={`min-h-[220px] rounded-xl border px-6 py-8 text-center shadow-sm transition-colors ${
                  sortingHoverCategory === category ? "border-slate-900 bg-slate-50/60" : "border-slate-300 bg-stone-100"
                }`}
                data-testid={`sorting-category-${categoryIndex}-${contentBlock.id}`}
              >
                {editable ? (
                  <Input
                    value={category}
                    onChange={(e) => {
                      const nextCategories = [...categories];
                      nextCategories[categoryIndex] = e.target.value;
                      setEditedContent({ ...content, categories: nextCategories });
                    }}
                    placeholder={`Category ${categoryIndex + 1}`}
                    className={`${inlineInputClass} text-center text-[18px] font-medium leading-10 text-slate-800`}
                    data-testid={`input-sorting-category-${categoryIndex}-${contentBlock.id}`}
                  />
                ) : (
                  <div className="text-[18px] font-medium leading-10 text-slate-800">{category}</div>
                )}
                {categoryFeedbackItems.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {categoryFeedbackItems.map((item) => (
                      <div
                        key={`${item.text}-${item.index}`}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all duration-500 ${
                          item.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        } ${item.leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}
                      >
                        <span>{item.text}</span>
                        {item.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {editable ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Categories</div>
              {categories.map((category: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={category}
                    onChange={(e) => {
                      const nextCategories = [...categories];
                      nextCategories[index] = e.target.value;
                      setEditedContent({ ...content, categories: nextCategories });
                    }}
                    className={editorFieldClass}
                    data-testid={`input-sorting-category-panel-${index}-${contentBlock.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nextCategories = [...categories];
                      nextCategories.splice(index, 1);
                      setEditedContent({ ...content, categories: nextCategories });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setEditedContent({ ...content, categories: [...categories, ""] })}
                data-testid={`button-add-sorting-category-${contentBlock.id}`}
              >
                Add category
              </Button>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Items</div>
              {items.map((item: { index: number; text: string; category: string }, index: number) => (
                <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const nextItems = [...items];
                      nextItems[index] = { ...nextItems[index], text: e.target.value };
                      setEditedContent({ ...content, items: nextItems });
                    }}
                    className={editorFieldClass}
                    data-testid={`input-sorting-item-text-${index}-${contentBlock.id}`}
                  />
                  <Select
                    value={item.category || "__none__"}
                    onValueChange={(value) => {
                      const nextItems = [...items];
                      nextItems[index] = { ...nextItems[index], category: value === "__none__" ? "" : value };
                      setEditedContent({ ...content, items: nextItems });
                    }}
                  >
                    <SelectTrigger className={editorFieldClass}>
                      <SelectValue placeholder="Correct category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No category</SelectItem>
                      {categories.map((category: string) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const nextItems = [...items];
                      nextItems.splice(index, 1);
                      setEditedContent({ ...content, items: nextItems });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setEditedContent({ ...content, items: [...items, { text: "", category: "" }] })}
                data-testid={`button-add-sorting-item-${contentBlock.id}`}
              >
                Add item
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderProcessFlowBlock = (content: any, editable = false) => {
    const steps = Array.isArray(content.steps) ? content.steps : [];
    return (
      <div className="space-y-4" data-testid={`${editable ? "edit" : "content"}-process-flow-${contentBlock.id}`}>
        {editable ? (
          <Input
            value={content.title || ""}
            onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
            placeholder="Process title"
            className={`${inlineInputClass} text-lg font-semibold text-slate-900`}
            data-testid={`input-process-flow-title-${contentBlock.id}`}
          />
        ) : content.title ? (
          <h3 className="text-lg font-semibold text-slate-900">{content.title}</h3>
        ) : null}

        {steps.length > 0 ? (
          <div className="space-y-6">
            {steps.map((step: any, index: number) => (
              <div key={index} className="relative flex items-start space-x-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                  <span className="font-semibold text-slate-700">{index + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {editable ? (
                    <div className="space-y-2">
                      <Input
                        value={step.title || ""}
                        onChange={(e) => {
                          const nextSteps = [...steps];
                          nextSteps[index] = { ...(nextSteps[index] || {}), title: e.target.value };
                          setEditedContent({ ...content, steps: nextSteps });
                        }}
                        placeholder={`Step ${index + 1}`}
                        className={`${inlineInputClass} font-medium text-slate-900`}
                        data-testid={`input-process-step-title-${index}-${contentBlock.id}`}
                      />
                      <Textarea
                        value={step.description || ""}
                        onChange={(e) => {
                          const nextSteps = [...steps];
                          nextSteps[index] = { ...(nextSteps[index] || {}), description: e.target.value };
                          setEditedContent({ ...content, steps: nextSteps });
                        }}
                        placeholder="Describe this step"
                        className={`${inlineTextareaClass} min-h-[72px] text-sm leading-7 text-slate-600`}
                        data-testid={`input-process-step-description-${index}-${contentBlock.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const nextSteps = [...steps];
                          nextSteps.splice(index, 1);
                          setEditedContent({ ...content, steps: nextSteps });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h5 className="mb-1 font-medium">{step.title || `Step ${index + 1}`}</h5>
                      {step.description ? <p>{step.description}</p> : null}
                    </>
                  )}
                </div>
                {index < steps.length - 1 ? <div className="absolute left-5 top-11 h-6 w-px bg-slate-200"></div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-muted-foreground">No process steps configured yet</div>
        )}

        {editable ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setEditedContent({ ...content, steps: [...steps, { title: "", description: "" }] })}
            data-testid={`button-add-process-step-${contentBlock.id}`}
          >
            Add step
          </Button>
        ) : null}
      </div>
    );
  };

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
          <div className="space-y-1" data-testid={`edit-heading-${contentBlock.id}`}>
            <RichTextEditor
              content={content.html || (content.text ? `<h2>${escapeHtml(content.text)}</h2>` : "")}
              onChange={(html) => setEditedContent({ ...content, html, text: stripHtml(html) })}
              placeholder="Add a clear section heading."
              className="rise-heading-editor rounded-2xl border border-transparent bg-transparent px-4 py-2 shadow-none transition-colors group-hover:border-slate-200 focus-within:border-slate-300"
              editorContentClassName="min-h-0 py-0"
              data-testid={`input-heading-content-${contentBlock.id}`}
            />
          </div>
        );

      case "statement":
        return (
          <div
            className="overflow-visible rounded-r-lg border-l-4 border-slate-300 bg-transparent p-4"
            data-testid={`edit-statement-${contentBlock.id}`}
          >
            <Textarea
              value={content.text || ""}
              onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
              placeholder="Highlight a key takeaway or important instruction."
              className={`${inlineTextareaClass} whitespace-pre-wrap break-words leading-8 text-slate-800`}
            />
          </div>
        );

      case "quote":
        return (
          <div
            className="rounded-2xl border border-transparent bg-transparent p-4 transition-colors group-hover:border-slate-200 focus-within:border-slate-300"
            data-testid={`edit-quote-${contentBlock.id}`}
          >
            <Textarea
              value={content.text || ""}
              onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
              placeholder="Paste the quote or testimonial."
              className={`${inlineTextareaClass} min-h-[56px] text-lg italic text-slate-800`}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-medium">-</span>
              <Input
                value={content.author || ""}
                onChange={(e) => setEditedContent({ ...content, author: e.target.value })}
                placeholder="Author"
                className={`${inlineInputClass} max-w-[220px] font-medium`}
                data-testid={`input-quote-author-${contentBlock.id}`}
              />
              <Input
                value={content.citation || ""}
                onChange={(e) => setEditedContent({ ...content, citation: e.target.value })}
                placeholder="Citation"
                className={`${inlineInputClass} max-w-[260px] opacity-75`}
                data-testid={`input-quote-citation-${contentBlock.id}`}
              />
            </div>
          </div>
        );
      
      case "image":
      case "ai-image":
        const editorImageProps = getImageDisplayProps(content, `content-${contentBlock.id}`);
        const singleImageUploadKey = `image-${contentBlock.id}`;
        return (
          <div className="space-y-3" data-testid={`edit-image-${contentBlock.id}`}>
            {renderImageUploadSurface(
              singleImageUploadKey,
              editorImageProps.url,
              editorImageProps.alt,
              "Add an image",
              "Click inside the image area to upload a file.",
              (url, fileName) =>
                saveContentImmediately({
                  ...content,
                  url,
                  alt: content.alt || fileName.replace(/\.[^/.]+$/, ""),
                }),
              { aspectClassName: "aspect-[16/3]", borderless: true },
            )}
          </div>
        );

      case "audio":
      case "ai-audio":
        return (
          <div
            className="rounded-2xl border border-transparent bg-transparent p-4 transition-colors group-hover:border-slate-200 focus-within:border-slate-300"
            data-testid={`edit-audio-${contentBlock.id}`}
          >
            <div className="mb-3 flex items-center space-x-4">
              <div className="text-2xl">Audio</div>
              <div className="flex-1 space-y-1">
                <Input
                  value={content.title || ""}
                  onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                  placeholder="Audio title"
                  className={`${inlineInputClass} font-medium text-slate-900`}
                  data-testid={`input-audio-title-${contentBlock.id}`}
                />
                <Textarea
                  value={content.description || ""}
                  onChange={(e) => setEditedContent({ ...content, description: e.target.value })}
                  placeholder="Describe what the learner will hear."
                  className={`${inlineTextareaClass} min-h-[48px] text-sm text-slate-500`}
                  data-testid={`input-audio-description-${contentBlock.id}`}
                />
                <Input
                  value={content.duration || ""}
                  onChange={(e) => setEditedContent({ ...content, duration: e.target.value })}
                  placeholder="Duration"
                  className={`${inlineInputClass} text-xs text-slate-400`}
                  data-testid={`input-audio-duration-${contentBlock.id}`}
                />
              </div>
              <Button variant="outline" size="sm" disabled>
                <Play className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={content.url || ""}
              onChange={(e) => setEditedContent({ ...content, url: e.target.value })}
              placeholder="Paste an audio URL"
              className={`${inlineInputClass} text-sm text-slate-500`}
              data-testid={`input-audio-url-${contentBlock.id}`}
            />
            {contentBlock.type === "ai-audio" && content.script ? (
              <Textarea
                value={content.script || ""}
                onChange={(e) => setEditedContent({ ...content, script: e.target.value })}
                placeholder="AI-generated audio script"
                className={`${inlineTextareaClass} mt-3 min-h-[88px] rounded-xl border border-slate-200 bg-transparent p-3 text-sm text-slate-700`}
                data-testid={`input-audio-script-${contentBlock.id}`}
              />
            ) : null}
          </div>
        );

      case "gallery":
        const galleryLayout = normalizeGalleryLayout(content.layout);
        const gallerySlots = getGallerySlots(content);
        const updateGalleryLayout = (layout: "carousel" | "two-column-grid" | "three-column-grid") => {
          const nextImages = getGallerySlots(
            { ...(latestEditedContentRef.current as any), layout },
            { preserveAll: true },
          );
          setEditedContent({ ...content, layout, images: nextImages });
          setActiveGalleryCarouselIndex(0);
        };
        return (
          <div className="space-y-4" data-testid={`edit-gallery-${contentBlock.id}`}>
            {renderEditorField(
              "Layout",
              <div className="flex gap-2">
                <Button
                  variant={galleryLayout === "carousel" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => updateGalleryLayout("carousel")}
                  data-testid={`button-gallery-carousel-${contentBlock.id}`}
                >
                  Carousel
                </Button>
                <Button
                  variant={galleryLayout === "two-column-grid" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => updateGalleryLayout("two-column-grid")}
                  data-testid={`button-gallery-two-column-${contentBlock.id}`}
                >
                  2 Column Grid
                </Button>
                <Button
                  variant={galleryLayout === "three-column-grid" ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => updateGalleryLayout("three-column-grid")}
                  data-testid={`button-gallery-three-column-${contentBlock.id}`}
                >
                  3 Column Grid
                </Button>
              </div>,
            )}

            {!galleryLayout ? (
              renderImagePlaceholder(
                "Choose a gallery layout",
                "Select Carousel, 2 Column Grid, or 3 Column Grid to start adding images.",
                true,
              )
            ) : galleryLayout === "carousel" ? (
              <div className="space-y-3">
                <div className="relative">
                  {renderImageUploadSurface(
                    `gallery-${contentBlock.id}-${activeGalleryCarouselIndex}`,
                    gallerySlots[activeGalleryCarouselIndex]?.url || "",
                    gallerySlots[activeGalleryCarouselIndex]?.alt || `Carousel slide ${activeGalleryCarouselIndex + 1}`,
                    `Carousel slide ${activeGalleryCarouselIndex + 1}`,
                    "Click inside the image area to upload a file for this slide.",
                    (url, fileName) => {
                      const images = buildGalleryImagesFromLatest(galleryLayout, (latestImages) => {
                        latestImages[activeGalleryCarouselIndex] = {
                          ...latestImages[activeGalleryCarouselIndex],
                          url,
                          alt: latestImages[activeGalleryCarouselIndex]?.alt || fileName.replace(/\.[^/.]+$/, ""),
                        };
                        return latestImages;
                      });
                      saveContentImmediately({ ...latestEditedContentRef.current, layout: galleryLayout, images });
                    },
                    {
                      compact: true,
                      aspectClassName: "aspect-[16/6]",
                      borderless: true,
                    },
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full"
                    onClick={() => setActiveGalleryCarouselIndex((prev) => Math.max(0, prev - 1))}
                    disabled={activeGalleryCarouselIndex === 0}
                    data-testid={`button-gallery-carousel-prev-${contentBlock.id}`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full"
                    onClick={() => setActiveGalleryCarouselIndex((prev) => Math.min(2, prev + 1))}
                    disabled={activeGalleryCarouselIndex === 2}
                    data-testid={`button-gallery-carousel-next-${contentBlock.id}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`grid gap-4 ${galleryLayout === "two-column-grid" ? "grid-cols-2" : "grid-cols-3"}`}>
                {gallerySlots.map((image: any, index: number) => (
                  <div key={index} className="p-0">
                    {renderImageUploadSurface(
                      `gallery-${contentBlock.id}-${index}`,
                      image.url || "",
                      image.alt || `Gallery image ${index + 1}`,
                      `Gallery image ${index + 1}`,
                      "Click inside the image area to upload a file for this slot.",
                      (url, fileName) => {
                        const images = buildGalleryImagesFromLatest(galleryLayout, (latestImages) => {
                          latestImages[index] = {
                            ...latestImages[index],
                            url,
                            alt: latestImages[index]?.alt || fileName.replace(/\.[^/.]+$/, ""),
                          };
                          return latestImages;
                        });
                        saveContentImmediately({ ...latestEditedContentRef.current, layout: galleryLayout, images });
                      },
                      {
                        compact: true,
                        aspectClassName: "aspect-[4/3]",
                        borderless: true,
                      },
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "video":
        return (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black" data-testid={`edit-video-${contentBlock.id}`}>
            {content.url && !String(content.url).startsWith("#") ? (
              <video
                src={content.url}
                controls
                className="aspect-video w-full"
                data-testid={`preview-video-${contentBlock.id}`}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-gray-100">
                <div className="text-center">
                  <div className="mb-2 text-4xl">Video</div>
                  <p className="text-gray-600">{content.title || "Video Content"}</p>
                </div>
              </div>
            )}
            <div className="space-y-2 border-t border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={content.title || ""}
                  onChange={(e) => setEditedContent({ ...content, title: e.target.value })}
                  placeholder="Video title"
                  className={`${inlineInputClass} text-sm font-medium text-slate-900`}
                  data-testid={`input-video-title-${contentBlock.id}`}
                />
                <Input
                  value={content.duration || ""}
                  onChange={(e) => setEditedContent({ ...content, duration: e.target.value })}
                  placeholder="15s"
                  className={`${inlineInputClass} max-w-[88px] text-right text-xs text-slate-500`}
                  data-testid={`input-video-duration-${contentBlock.id}`}
                />
              </div>
              <Input
                value={content.url || ""}
                onChange={(e) => setEditedContent({ ...content, url: e.target.value })}
                placeholder="Paste a hosted video URL"
                className={`${inlineInputClass} text-xs text-slate-500`}
                data-testid={`input-video-url-${contentBlock.id}`}
              />
            </div>
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
        return renderAccordionBlock(content, true);

      case "flashcards":
        return renderFlashcardsBlock(content, true);

      case "continue":
        return (
          <div className="space-y-3 text-center" data-testid={`edit-continue-${contentBlock.id}`}>
            <div className="inline-flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-sm transition-colors hover:border-slate-300">
              <Input
                value={content.text || ""}
                onChange={(e) => setEditedContent({ ...content, text: e.target.value })}
                placeholder="Continue"
                className={`${inlineInputClass} min-w-[180px] text-center font-medium text-slate-800`}
                data-testid={`input-continue-text-${contentBlock.id}`}
              />
              <span className="text-slate-400">→</span>
            </div>
            <div className="mx-auto flex max-w-[320px] flex-col items-center gap-2">
              <Select
                value={content.action || "next_lesson"}
                onValueChange={(value) =>
                  setEditedContent({
                    ...content,
                    action: value,
                    url: value === "external_url" ? content.url || "" : "",
                  })
                }
              >
                <SelectTrigger className="border-slate-200 bg-white text-sm shadow-none">
                  <SelectValue placeholder="Choose action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="next_lesson">Go to next lesson</SelectItem>
                  <SelectItem value="external_url">Open external URL</SelectItem>
                </SelectContent>
              </Select>
              {(content.action || "next_lesson") === "external_url" ? (
                <Input
                  value={content.url || ""}
                  onChange={(e) => setEditedContent({ ...content, url: e.target.value })}
                  placeholder="https://example.com"
                  className={`${inlineInputClass} text-center text-sm text-slate-500`}
                  data-testid={`input-continue-url-${contentBlock.id}`}
                />
              ) : (
                <div className="text-xs text-slate-400">
                  {nextLessonPath ? "This button will open the next lesson in the course." : "No next lesson available."}
                </div>
              )}
            </div>
          </div>
        );

      case "list":
        return renderListBlock(content, true);

      case "timeline":
        return renderTimelineBlock(content, true);

      case "labeled-graphic":
        return renderLabeledGraphicBlock(content, true);

      case "scenario":
        return renderScenarioBlock(content, true);

      case "sorting-activity":
        return renderSortingActivityBlock(content, true);
      case "process-flow":
        return renderProcessFlowBlock(content, true);

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
          <div className="overflow-visible rounded-r-lg border-l-4 border-slate-300 bg-transparent p-4" data-testid={`content-statement-${contentBlock.id}`}>
            <p className="whitespace-pre-wrap break-words leading-8 text-slate-800">
              {statementText}
            </p>
          </div>
        );

      case "quote":
        return (
          <div className="py-2" data-testid={`content-quote-${contentBlock.id}`}>
            <blockquote className="relative max-w-3xl pt-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 select-none text-[7rem] font-semibold leading-none text-slate-200"
              >
                "
              </div>
              <p className="relative z-10 mt-2 text-xl italic leading-9 text-slate-800">
                {content.text || "This is a sample quote that provides valuable insights."}
              </p>
            </blockquote>
            {(content.author || content.citation) && (
              <div className="mt-4 text-sm text-slate-500">
                {content.author ? <span className="font-medium text-slate-700">- {content.author}</span> : null}
                {content.citation ? <span className={content.author ? "ml-2" : ""}>{content.citation}</span> : null}
              </div>
            )}
          </div>
        );
      
      case "image":
      case "ai-image":
        const imageProps = getImageDisplayProps(content, `content-${contentBlock.id}`);
        return (
          <div data-testid={`content-image-${contentBlock.id}`}>
            {imageProps.url ? (
              <div className="w-full overflow-hidden rounded-2xl">
                <img 
                  src={imageProps.url} 
                  alt={imageProps.alt} 
                  className="aspect-[16/3] w-full object-cover" 
                />
              </div>
            ) : (
              renderImagePlaceholder(
                "Image placeholder",
                "No image has been added to this block yet.",
              )
            )}
          </div>
        );

      case "gallery":
        const previewGalleryLayout = normalizeGalleryLayout(content.layout);
        const galleryImages = getGallerySlots(content).filter((img: any) => typeof img?.url === "string" && img.url.trim());
        const activePreviewCarouselImage = galleryImages[activeGalleryCarouselIndex] || galleryImages[0];
        return (
          <div data-testid={`content-gallery-${contentBlock.id}`}>
            {galleryImages.length > 0 ? (
              previewGalleryLayout === "carousel" ? (
                activePreviewCarouselImage ? (
                  <div className="relative overflow-hidden rounded-2xl">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full"
                      onClick={() => setActiveGalleryCarouselIndex((prev) => Math.max(0, prev - 1))}
                      disabled={activeGalleryCarouselIndex === 0}
                      data-testid={`button-preview-gallery-carousel-prev-${contentBlock.id}`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full"
                      onClick={() => setActiveGalleryCarouselIndex((prev) => Math.min(galleryImages.length - 1, prev + 1))}
                      disabled={activeGalleryCarouselIndex >= galleryImages.length - 1}
                      data-testid={`button-preview-gallery-carousel-next-${contentBlock.id}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                      <img 
                        src={activePreviewCarouselImage.url} 
                        alt={activePreviewCarouselImage.alt || "Gallery image"}
                        className="aspect-[16/6] w-full object-cover"
                      />
                  </div>
                ) : null
              ) : (
                <div className={`grid gap-4 ${previewGalleryLayout === "two-column-grid" ? "grid-cols-2" : "grid-cols-3"}`}>
                  {galleryImages.map((img: any, index: number) => (
                    <div key={index} className="overflow-hidden rounded-2xl">
                      <img 
                        src={img.url} 
                        alt={img.alt || `Gallery image ${index + 1}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )
            ) : (
              renderImagePlaceholder(
                "Gallery placeholder",
                "No gallery images have been added yet.",
                true,
              )
            )}
          </div>
        );

      case "audio":
        const hasValidAudioUrl = content.url && !content.url.startsWith('#');
        return (
          <div className="p-4" data-testid={`content-audio-${contentBlock.id}`}>
            <div className="flex items-center space-x-4 mb-3">
              <div className="text-2xl">ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Âµ</div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">{content.title || "Audio Content"}</h4>
                <p className="text-sm text-slate-500">{content.description || "Audio file or recording"}</p>
                {content.duration && (
                  <p className="mt-1 text-xs text-slate-400">Duration: {content.duration}</p>
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
              <p className="text-xs italic text-slate-400">No audio file available. Please provide a valid audio URL.</p>
            )}
          </div>
        );
      
      case "video":
        const hasValidVideoUrl = content.url && !content.url.startsWith("#");
        return (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black" data-testid={`content-video-${contentBlock.id}`}>
            {hasValidVideoUrl ? (
              <video src={content.url} controls className="aspect-video w-full" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-gray-100">
                <div className="text-center">
                  <div className="text-4xl mb-2">Video</div>
                  <p className="text-gray-600">{content.title || "Video Content"}</p>
                </div>
              </div>
            )}
            {(content.title || content.duration) ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
                <div className="text-sm font-medium text-slate-900">{content.title || "Video"}</div>
                {content.duration ? (
                  <div className="text-xs text-slate-500">{content.duration}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      
      case "flashcards":
        return renderFlashcardsBlock(content);
      
      case "accordion":
        return renderAccordionBlock(content);

      case "timeline":
        return renderTimelineBlock(content);

      case "sorting-activity":
        return renderSortingActivityBlock(content);

      case "labeled-graphic":
        return renderLabeledGraphicBlock(content);

      case "scenario":
        return renderScenarioBlock(content);

      case "continue":
        return (
          <div className="text-center py-6" data-testid={`content-continue-${contentBlock.id}`}>
            <button
              type="button"
              onClick={() => handleContinueAction(content)}
              disabled={(content.action || "next_lesson") === "next_lesson" && !nextLessonPath}
              className="inline-flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-6 py-3 shadow-sm transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`link-continue-${contentBlock.id}`}
            >
              <span className="font-medium text-slate-800">
                {content.text || "Continue"}
              </span>
              <span className="text-slate-400">→</span>
            </button>
          </div>
        );

      case "list":
        return renderListBlock(content);

      case "ai-audio":
        const hasValidAiAudioUrl = content.url && !content.url.startsWith('#');
        return (
          <div className="rise-content p-4" data-testid={`content-ai-audio-${contentBlock.id}`}>
            <div className="flex items-start space-x-4 mb-3">
              <div className="text-2xl">🎵</div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-900">{content.title || "AI Generated Audio"}</h4>
                <p className="mb-2 text-slate-500">{content.description || "Audio narration generated by AI"}</p>
                {content.duration && (
                  <p className="mb-2 text-slate-400">Duration: {content.duration}</p>
                )}
                {content.script && (
                  <div className="mt-3">
                    <p className="mb-1 font-medium text-slate-700">Script Preview:</p>
                    <p className="max-h-20 overflow-y-auto rounded-xl border border-slate-200 bg-transparent p-2 text-slate-500">
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
              <div className="mt-2 rounded-xl border border-slate-200 bg-transparent p-3">
                <p className="text-slate-500">
                  ⚠️ Audio generation is currently using placeholder URLs. To enable actual audio playback:
                </p>
                <ul className="mt-2 ml-4 list-disc text-slate-500">
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
        return renderProcessFlowBlock(content);

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
        className="rise-shell rise-preview-surface rise-content content-block-preview border-b border-slate-200 bg-transparent py-4 last:border-b-0"
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


