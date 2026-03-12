import { X, Brain, Edit, Puzzle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ContentTypeModalProps {
  open: boolean;
  onClose: () => void;
  onAddContent: (type: string, content: any) => void;
  isLoading?: boolean;
}

const contentTypes = {
  ai: [
    {
      type: "ai-text",
      title: "AI Text Block",
      description: "Generate explanatory text content",
      icon: "📝",
      color: "bg-blue-100 text-blue-600",
    },
    {
      type: "ai-quiz",
      title: "AI Quiz",
      description: "Generate interactive quiz questions automatically",
      icon: "",
      color: "bg-blue-100 text-blue-600",
    },
    {
      type: "ai-image",
      title: "AI Image",
      description: "Create custom diagrams and visuals",
      icon: "🎨",
      color: "bg-green-100 text-green-600",
    },
    {
      type: "ai-audio",
      title: "AI Audio",
      description: "Generate narration and explanations",
      icon: "🔊",
      color: "bg-purple-100 text-purple-600",
    },
  ],
  standard: [
    {
      type: "text",
      title: "Text",
      description: "Add paragraphs and headings",
      icon: "📝",
      color: "bg-gray-100 text-gray-600",
    },
    {
      type: "heading",
      title: "Heading",
      description: "Section headers and titles",
      icon: "📰",
      color: "bg-slate-100 text-slate-600",
    },
    {
      type: "statement",
      title: "Statement",
      description: "Highlighted text for emphasis",
      icon: "💬",
      color: "bg-amber-100 text-amber-600",
    },
    {
      type: "quote",
      title: "Quote",
      description: "Blockquotes and testimonials",
      icon: "💭",
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      type: "list",
      title: "List",
      description: "Create bullet or numbered lists",
      icon: "📋",
      color: "bg-green-100 text-green-600",
    },
    {
      type: "image",
      title: "Image Upload",
      description: "Add your own images",
      icon: "🖼️",
      color: "bg-blue-100 text-blue-600",
    },
    {
      type: "gallery",
      title: "Image Gallery",
      description: "Multiple images in a grid",
      icon: "🖼️",
      color: "bg-cyan-100 text-cyan-600",
    },
    {
      type: "video",
      title: "Video",
      description: "Embed YouTube or Vimeo videos",
      icon: "🎥",
      color: "bg-red-100 text-red-600",
    },
    {
      type: "audio",
      title: "Audio",
      description: "Upload audio files or recordings",
      icon: "🎵",
      color: "bg-pink-100 text-pink-600",
    },
  ],
  interactive: [
    {
      type: "accordion",
      title: "Accordion",
      description: "Collapsible content sections",
      icon: "📂",
      color: "bg-teal-100 text-teal-600",
    },
    {
      type: "timeline",
      title: "Timeline",
      description: "Chronological events and milestones",
      icon: "⏰",
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      type: "labeled-graphic",
      title: "Labeled Graphic",
      description: "Interactive image with hotspots",
      icon: "🎯",
      color: "bg-rose-100 text-rose-600",
    },
    {
      type: "scenario",
      title: "Scenario",
      description: "Interactive decision-making scenarios",
      icon: "🎭",
      color: "bg-violet-100 text-violet-600",
    },
    {
      type: "flashcards",
      title: "Flashcards",
      description: "Interactive flashcard sets",
      icon: "🃏",
      color: "bg-purple-100 text-purple-600",
    },
    {
      type: "sorting-activity",
      title: "Sorting Activity",
      description: "Drag and drop sorting exercises",
      icon: "↕️",
      color: "bg-orange-100 text-orange-600",
    },
    {
      type: "process-flow",
      title: "Process Flow",
      description: "Step-by-step workflows",
      icon: "🔄",
      color: "bg-green-100 text-green-600",
    },
    {
      type: "quiz",
      title: "Quiz",
      description: "Knowledge check questions",
      icon: "",
      color: "bg-blue-100 text-blue-600",
    },
    {
      type: "continue",
      title: "Continue Block",
      description: "Navigation and progress controls",
      icon: "➡️",
      color: "bg-sky-100 text-sky-600",
    },
  ],
};

export default function ContentTypeModal({ open, onClose, onAddContent, isLoading }: ContentTypeModalProps) {
  const handleContentTypeSelect = (type: string) => {
    // Generate mock content based on type
    const mockContent = generateMockContent(type);
    onAddContent(type, mockContent);
  };

  const generateMockContent = (type: string) => {
    switch (type) {
      case "ai-text":
      case "text":
        return {
          text: "This is sample text content that would be generated or entered for this content block.",
          html: "<p>This is sample text content that would be generated or entered for this content block.</p>"
        };
      case "heading":
        return {
          text: "Sample Heading",
          level: 2,
          html: "<h2>Sample Heading</h2>"
        };
      case "statement":
        return {
          text: "This is an important statement that emphasizes key information.",
          style: "emphasis",
          html: "<div class='statement-block'><p>This is an important statement that emphasizes key information.</p></div>"
        };
      case "quote":
        return {
          text: "This is a sample quote that provides valuable insights.",
          author: "Expert Source",
          citation: "Source Publication, 2024",
          html: "<blockquote><p>This is a sample quote that provides valuable insights.</p><cite>Expert Source</cite></blockquote>"
        };
      case "ai-image":
      case "image":
        return {
          url: "https://picsum.photos/800/400",
          alt: "Sample image",
          caption: "AI-generated or uploaded image",
          isPlaceholder: true
        };
      case "gallery":
        return {
          images: [
            { url: "https://picsum.photos/seed/gallery1/400/300", alt: "Gallery image 1", caption: "First image", isPlaceholder: true },
            { url: "https://picsum.photos/seed/gallery2/400/300", alt: "Gallery image 2", caption: "Second image", isPlaceholder: true },
            { url: "https://picsum.photos/seed/gallery3/400/300", alt: "Gallery image 3", caption: "Third image", isPlaceholder: true }
          ],
          layout: "grid"
        };
      case "ai-audio":
      case "audio":
        return {
          title: "Sample Audio Content",
          description: "Audio narration or music",
          url: "#",
          duration: "2:30"
        };
      case "video":
        return {
          title: "Sample Video",
          url: "#",
          duration: "5:30"
        };
      case "accordion":
        return {
          sections: [
            { title: "Section 1", content: "Content for the first expandable section." },
            { title: "Section 2", content: "Content for the second expandable section." },
            { title: "Section 3", content: "Content for the third expandable section." }
          ]
        };
      case "timeline":
        return {
          events: [
            { date: "2020", title: "First Event", description: "Description of the first timeline event." },
            { date: "2021", title: "Second Event", description: "Description of the second timeline event." },
            { date: "2022", title: "Third Event", description: "Description of the third timeline event." }
          ],
          orientation: "vertical"
        };
      case "labeled-graphic":
        return {
          image: { url: "https://picsum.photos/seed/graphic/600/400", alt: "Interactive graphic", isPlaceholder: true },
          hotspots: [
            { x: 30, y: 40, title: "Point 1", description: "Information about this area" },
            { x: 60, y: 70, title: "Point 2", description: "Information about this area" }
          ]
        };
      case "scenario":
        return {
          title: "Sample Scenario",
          description: "Make a decision based on the following situation...",
          choices: [
            { id: "a", text: "Option A", feedback: "This choice leads to..." },
            { id: "b", text: "Option B", feedback: "This choice leads to..." }
          ]
        };
      case "flashcards":
        return {
          cards: [
            { front: "Question 1", back: "Answer 1" },
            { front: "Question 2", back: "Answer 2" }
          ]
        };
      case "list":
        return {
          items: ["List item 1", "List item 2", "List item 3"],
          ordered: false
        };
      case "sorting-activity":
        return {
          title: "Sort these items",
          items: ["Item A", "Item B", "Item C"],
          categories: ["Category 1", "Category 2"]
        };
      case "process-flow":
        return {
          title: "Process Flow",
          steps: [
            { title: "Step 1", description: "First step description" },
            { title: "Step 2", description: "Second step description" },
            { title: "Step 3", description: "Third step description" }
          ]
        };
      case "quiz":
        return {
          title: "Sample Quiz",
          description: "Test your knowledge with this sample quiz",
          questions: [
            {
              question: "Sample question?",
              options: ["Option A", "Option B", "Option C", "Option D"],
              correctAnswer: "A",
              type: "multiple-choice"
            }
          ],
          isGenerated: false
        };
      case "continue":
        return {
          text: "Click to continue to the next section",
          navigationRestricted: false,
          completionRequired: true
        };
      default:
        return { content: "Sample content for " + type };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="content-type-modal">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="text-2xl font-bold" data-testid="modal-title">Add Content Block</DialogTitle>
              <p className="text-muted-foreground mt-2" data-testid="modal-description">
                Choose the type of content you want to add to your chapter
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-modal">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* AI-Powered Content */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center" data-testid="section-ai-content">
              <Brain className="mr-2 h-5 w-5 text-blue-600" />
              AI-Powered Content
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {contentTypes.ai.map((type) => (
                <Card 
                  key={type.type}
                  className="cursor-pointer hover:shadow-md transition-all border-border hover:border-primary"
                  onClick={() => handleContentTypeSelect(type.type)}
                  data-testid={`content-type-${type.type}`}
                >
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${type.color}`}>
                      <span className="text-xl">{type.icon}</span>
                    </div>
                    <h4 className="font-medium mb-1" data-testid={`title-${type.type}`}>{type.title}</h4>
                    <p className="text-sm text-muted-foreground" data-testid={`description-${type.type}`}>
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Standard Content */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center" data-testid="section-standard-content">
              <Edit className="mr-2 h-5 w-5 text-orange-600" />
              Standard Content
            </h3>
            <div className="grid md:grid-cols-4 gap-4">
              {contentTypes.standard.map((type) => (
                <Card 
                  key={type.type}
                  className="cursor-pointer hover:shadow-md transition-all border-border hover:border-primary"
                  onClick={() => handleContentTypeSelect(type.type)}
                  data-testid={`content-type-${type.type}`}
                >
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${type.color}`}>
                      <span className="text-xl">{type.icon}</span>
                    </div>
                    <h4 className="font-medium mb-1" data-testid={`title-${type.type}`}>{type.title}</h4>
                    <p className="text-sm text-muted-foreground" data-testid={`description-${type.type}`}>
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Interactive Elements */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center" data-testid="section-interactive-content">
              <Puzzle className="mr-2 h-5 w-5 text-purple-600" />
              Interactive Elements
            </h3>
            <div className="grid md:grid-cols-4 gap-4">
              {contentTypes.interactive.map((type) => (
                <Card 
                  key={type.type}
                  className="cursor-pointer hover:shadow-md transition-all border-border hover:border-primary"
                  onClick={() => handleContentTypeSelect(type.type)}
                  data-testid={`content-type-${type.type}`}
                >
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${type.color}`}>
                      <span className="text-xl">{type.icon}</span>
                    </div>
                    <h4 className="font-medium mb-1" data-testid={`title-${type.type}`}>{type.title}</h4>
                    <p className="text-sm text-muted-foreground" data-testid={`description-${type.type}`}>
                      {type.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
