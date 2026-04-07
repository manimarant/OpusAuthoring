import { useState } from "react";
import { createPortal } from "react-dom";
import { 
  Type, 
  Heading1, 
  Image, 
  Video, 
  HelpCircle,
  FileText,
  MessageSquare,
  Quote,
  List,
  Images,
  Music,
  ChevronRight,
  Clock,
  Target,
  Drama,
  CreditCard,
  ArrowDownUp,
  Workflow,
  Sparkles,
  Palette,
  Mic,
  MoreHorizontal,
  ChevronLeft,
  CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContentBlockMenuProps {
  onAddContent: (type: string, content: any) => void;
  onClose: () => void;
  mode?: "default" | "mini";
}

const quickTools = [
  {
    type: "ai-text",
    title: "AI Text",
    icon: FileText,
  },
  {
    type: "ai-image",
    title: "AI Image",
    icon: Image,
  },
  {
    type: "ai-video",
    title: "AI Video",
    icon: Video,
  },
  {
    type: "ai-audio",
    title: "AI Audio",
    icon: Mic,
  },
  {
    type: "ai-assignment",
    title: "AI Assignment",
    icon: CheckSquare,
  },
  {
    type: "ai-quiz",
    title: "AI Quiz",
    icon: HelpCircle,
  },
];

const allTools = [
  {
    category: "AI-Powered",
    items: [
      { 
        type: "ai-text", 
        title: "AI Text", 
        description: "Generate text content using AI based on your course objectives",
        icon: Sparkles,
        color: "bg-violet-50 dark:bg-violet-950/30",
        iconColor: "text-violet-600 dark:text-violet-400",
      },
      { 
        type: "ai-quiz", 
        title: "AI Quiz", 
        description: "Generate interactive quiz questions automatically",
        icon: HelpCircle,
        color: "bg-blue-50 dark:bg-blue-950/30",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      { 
        type: "ai-assignment", 
        title: "AI Assignment", 
        description: "Create structured assignments with tasks and grading rubrics",
        icon: CheckSquare,
        color: "bg-emerald-50 dark:bg-emerald-950/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      },
      { 
        type: "ai-image", 
        title: "AI Image", 
        description: "Create custom images and graphics using AI generation",
        icon: Palette,
        color: "bg-pink-50 dark:bg-pink-950/30",
        iconColor: "text-pink-600 dark:text-pink-400",
      },
      { 
        type: "ai-video", 
        title: "AI Video", 
        description: "Generate a short Tavus presenter video for the selected chapter",
        icon: Video,
        color: "bg-red-50 dark:bg-red-950/30",
        iconColor: "text-red-600 dark:text-red-400",
      },
      { 
        type: "ai-audio", 
        title: "AI Audio", 
        description: "Generate narration and audio content with AI voices",
        icon: Mic,
        color: "bg-purple-50 dark:bg-purple-950/30",
        iconColor: "text-purple-600 dark:text-purple-400",
      },
    ],
  },
  {
    category: "Text",
    items: [
      { 
        type: "text", 
        title: "Text", 
        description: "Add paragraphs and rich text content with formatting options",
        icon: Type,
        color: "bg-slate-50 dark:bg-slate-950/30",
        iconColor: "text-slate-600 dark:text-slate-400",
      },
      { 
        type: "heading", 
        title: "Heading", 
        description: "Create section headers to organize your content structure",
        icon: Heading1,
        color: "bg-gray-50 dark:bg-gray-950/30",
        iconColor: "text-gray-600 dark:text-gray-400",
      },
      { 
        type: "statement", 
        title: "Statement", 
        description: "Highlight key points and important information",
        icon: MessageSquare,
        color: "bg-amber-50 dark:bg-amber-950/30",
        iconColor: "text-amber-600 dark:text-amber-400",
      },
      { 
        type: "quote", 
        title: "Quote", 
        description: "Display quotes and citations from experts or sources",
        icon: Quote,
        color: "bg-indigo-50 dark:bg-indigo-950/30",
        iconColor: "text-indigo-600 dark:text-indigo-400",
      },
      { 
        type: "list", 
        title: "List", 
        description: "Create bulleted or numbered lists for better readability",
        icon: List,
        color: "bg-emerald-50 dark:bg-emerald-950/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
      },
    ],
  },
  {
    category: "Media",
    items: [
      { 
        type: "image", 
        title: "Image", 
        description: "Add images and graphics to illustrate concepts",
        icon: Image,
        color: "bg-blue-50 dark:bg-blue-950/30",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      { 
        type: "gallery", 
        title: "Gallery", 
        description: "Display multiple images in a grid or carousel layout",
        icon: Images,
        color: "bg-cyan-50 dark:bg-cyan-950/30",
        iconColor: "text-cyan-600 dark:text-cyan-400",
      },
      { 
        type: "video", 
        title: "Video", 
        description: "Embed videos from YouTube, Vimeo, or upload your own",
        icon: Video,
        color: "bg-red-50 dark:bg-red-950/30",
        iconColor: "text-red-600 dark:text-red-400",
      },
      { 
        type: "audio", 
        title: "Audio", 
        description: "Add audio files, podcasts, or music tracks",
        icon: Music,
        color: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
        iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
      },
    ],
  },
  {
    category: "Interactive",
    items: [
      { 
        type: "accordion", 
        title: "Accordion", 
        description: "Create expandable sections for organized information",
        icon: ChevronRight,
        color: "bg-teal-50 dark:bg-teal-950/30",
        iconColor: "text-teal-600 dark:text-teal-400",
      },
      { 
        type: "timeline", 
        title: "Timeline", 
        description: "Display events and milestones in chronological order",
        icon: Clock,
        color: "bg-lime-50 dark:bg-lime-950/30",
        iconColor: "text-lime-600 dark:text-lime-400",
      },
      { 
        type: "labeled-graphic", 
        title: "Labeled Graphic", 
        description: "Add interactive labels and hotspots to images",
        icon: Target,
        color: "bg-rose-50 dark:bg-rose-950/30",
        iconColor: "text-rose-600 dark:text-rose-400",
      },
      { 
        type: "scenario", 
        title: "Scenario", 
        description: "Create branching scenarios and decision-making exercises",
        icon: Drama,
        color: "bg-violet-50 dark:bg-violet-950/30",
        iconColor: "text-violet-600 dark:text-violet-400",
      },
      { 
        type: "flashcards", 
        title: "Flashcards", 
        description: "Build flip cards for memorization and quick review",
        icon: CreditCard,
        color: "bg-sky-50 dark:bg-sky-950/30",
        iconColor: "text-sky-600 dark:text-sky-400",
      },
      { 
        type: "sorting-activity", 
        title: "Sorting", 
        description: "Create drag-and-drop sorting and categorization activities",
        icon: ArrowDownUp,
        color: "bg-orange-50 dark:bg-orange-950/30",
        iconColor: "text-orange-600 dark:text-orange-400",
      },
      { 
        type: "process-flow", 
        title: "Process Flow", 
        description: "Visualize processes and workflows with diagrams",
        icon: Workflow,
        color: "bg-green-50 dark:bg-green-950/30",
        iconColor: "text-green-600 dark:text-green-400",
      },
      { 
        type: "quiz", 
        title: "Quiz", 
        description: "Add multiple choice, true/false, or fill-in-the-blank questions",
        icon: HelpCircle,
        color: "bg-blue-50 dark:bg-blue-950/30",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      { 
        type: "continue", 
        title: "Continue", 
        description: "Add a continue button to control content progression",
        icon: ChevronRight,
        color: "bg-slate-50 dark:bg-slate-950/30",
        iconColor: "text-slate-600 dark:text-slate-400",
      },
    ],
  },
];

export default function ContentBlockMenu({ onAddContent, onClose, mode = "default" }: ContentBlockMenuProps) {
  const [showMore, setShowMore] = useState(false);
  const isMini = mode === "mini";

  const generateMockContent = (type: string) => {
    switch (type) {
      case "ai-text":
        return { text: "", html: "<p></p>" };
      case "text":
        return { text: "", html: "" };
      case "ai-quiz":
        return { questions: [], title: "", description: "", isGenerated: false };
      case "heading":
        return { text: "New Heading", level: 2, html: "<h2>New Heading</h2>" };
      case "statement":
        return { text: "Important statement", style: "emphasis", html: "<div class='statement-block'><p>Important statement</p></div>" };
      case "quote":
        return { text: "Quote text", author: "", citation: "", html: "<blockquote><p>Quote text</p></blockquote>" };
      case "ai-image":
      case "image":
        return { url: "", alt: "", caption: "" };
      case "gallery":
        return { layout: "", images: [] };
      case "ai-video":
        return { title: "", url: "#", duration: "", provider: "tavus" };
      case "ai-audio":
      case "audio":
        return { title: "", description: "", url: "#", duration: "" };
      case "video":
        return { title: "", url: "#", duration: "" };
      case "accordion":
        return { title: "", items: [] };
      case "timeline":
        return { events: [], orientation: "vertical" };
      case "labeled-graphic":
        return { image: { url: "", alt: "" }, labels: [] };
      case "scenario":
        return { title: "", description: "", choices: [] };
      case "flashcards":
        return { title: "", cards: [] };
      case "sorting-activity":
        return { items: [], categories: [] };
      case "process-flow":
        return { title: "", steps: [] };
      case "quiz":
        return { 
          title: "", 
          description: "", 
          questions: [], 
          isGenerated: false 
        };
      case "continue":
        return { text: "Continue", action: "next_lesson", url: "" };
      case "list":
        return {
          title: "",
          items: [{ title: "", description: "" }],
          type: "unordered",
        };
      default:
        return {};
    }
  };

  const handleToolClick = (type: string) => {
    const mockContent = generateMockContent(type);
    onAddContent(type, mockContent);
    onClose();
  };

  return (
    <>
      {/* Left sidebar panel - shown when More is clicked - rendered via portal */}
      {showMore && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40" 
            onClick={() => setShowMore(false)}
          />
          
          {/* Sidebar */}
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-background border-r border-border shadow-2xl z-50 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Content blocks</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMore(false)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* Tools list */}
            <div className="p-2">
              {allTools.map((category) => (
                <div key={category.category} className="mb-6 last:mb-0">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">
                    {category.category}
                  </h3>
                  <div className="space-y-1">
                    {category.items.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.type}
                          onClick={() => handleToolClick(tool.type)}
                          className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left group"
                          data-testid={`tool-${tool.type}`}
                        >
                          <div className={cn(
                            "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity",
                            tool.color || "bg-muted"
                          )}>
                            <Icon className={cn(
                              "h-5 w-5",
                              tool.iconColor || "text-muted-foreground"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-foreground mb-0.5">
                              {tool.title}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Bottom toolbar */}
      <div className={`flex items-center gap-1 rounded-full border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${isMini ? "px-1.5 py-1.5" : "px-2 py-2"}`}>
        {!isMini && (
          <div className="pl-2 pr-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Add
          </div>
        )}
        {quickTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Button
              key={tool.type}
              variant="ghost"
              size="sm"
              onClick={() => handleToolClick(tool.type)}
              className={isMini ? "h-9 rounded-full px-2.5 text-xs text-slate-700 hover:bg-slate-100" : "h-10 rounded-full px-3 text-sm text-slate-700 hover:bg-slate-100"}
              data-testid={`quick-tool-${tool.type}`}
            >
              <Icon className="h-4 w-4" />
              {!isMini && <span>{tool.title}</span>}
            </Button>
          );
        })}
        
        <div className="mx-1 h-6 w-px bg-slate-200" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className={isMini ? "h-9 rounded-full px-2.5 text-xs text-slate-700 hover:bg-slate-100" : "h-10 rounded-full px-3 text-sm text-slate-700 hover:bg-slate-100"}
          data-testid="button-more-tools"
        >
          <MoreHorizontal className="h-4 w-4" />
          {!isMini && <span>More</span>}
        </Button>
      </div>
    </>
  );
}

