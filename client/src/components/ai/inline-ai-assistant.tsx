import { useState } from "react";
import { Sparkles, Loader2, WandSparkles, Check, Minimize2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface InlineAiAssistantProps {
  moduleId: string;
  currentText: string;
  onContentGenerated: (content: string) => void;
}

export default function InlineAiAssistant({ 
  moduleId, 
  currentText, 
  onContentGenerated
}: InlineAiAssistantProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(false);

  const generateContentMutation = useMutation({
    mutationFn: async (params: { prompt: string; actionType?: string }) => {
      const response = await apiRequest("POST", "/api/ai/generate-text", {
        moduleId,
        provider: "gemini",
        type: params.actionType || "custom",
        prompt: params.prompt,
        currentText: currentText,
        style: {
          tone: "neutral",
          readingLevel: "intermediate",
        },
        length: "medium",
        includeCourseContext: true,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }
      
      const jsonData = await response.json();
      return jsonData as {
        text: string;
        provider: string;
        model: string;
        tokensUsed?: number;
      };
    },
    onSuccess: (data) => {
      onContentGenerated(data.text);
      setCustomPrompt("");
      setShowQuickActions(false);
    },
  });

  const handleQuickAction = (actionType: string, prompt: string) => {
    generateContentMutation.mutate({ prompt, actionType });
  };

  const quickActions = [
    { 
      icon: WandSparkles, 
      label: "Improve writing", 
      action: "improve",
      prompt: "Improve the writing quality and clarity of this text while maintaining its meaning",
      color: "text-blue-600"
    },
    { 
      icon: Minimize2, 
      label: "Make shorter", 
      action: "shorten",
      prompt: "Make this text more concise while preserving the key information",
      color: "text-purple-600"
    },
    { 
      icon: Languages, 
      label: "Simplify language", 
      action: "simplify",
      prompt: "Simplify the language to make it easier to understand",
      color: "text-orange-600"
    },
  ];

  return (
    <div className="border rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="p-3 space-y-3">
        {generateContentMutation.isPending ? (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <Sparkles className="w-4 h-4" />
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI is writing</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <Input
                data-testid="input-ai-prompt"
                placeholder="Ask AI to edit or generate..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onFocus={() => setShowQuickActions(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (customPrompt.trim()) {
                      generateContentMutation.mutate({ prompt: customPrompt });
                    }
                  }
                }}
                className="flex-1 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
              />
              <Button
                data-testid="button-ai-submit"
                onClick={() => {
                  if (customPrompt.trim()) {
                    generateContentMutation.mutate({ prompt: customPrompt });
                  }
                }}
                disabled={!customPrompt.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>

            {showQuickActions && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {quickActions.map((action) => (
                  <button
                    key={action.action}
                    data-testid={`button-quick-${action.action}`}
                    onClick={() => handleQuickAction(action.action, action.prompt)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left",
                      "hover:bg-white/80 dark:hover:bg-gray-800/80"
                    )}
                  >
                    <action.icon className={cn("w-4 h-4", action.color)} />
                    <span className="text-gray-700 dark:text-gray-300">{action.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
