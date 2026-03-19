import { useCallback, useEffect, useRef, useState } from "react";
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Eye, PanelLeft, Plus, Sparkles, Upload } from "lucide-react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ContentBlock, Course, Module } from "@shared/schema";
import ContentBlockComponent from "@/components/course/content-block";
import ContentBlockMenu from "@/components/course/content-block-menu";
import CourseNavigation from "@/components/course/course-navigation";

type AiPreview =
  | { type: "text"; content: { text?: string; html?: string } }
  | { type: "image"; content: { url?: string; alt?: string; caption?: string } }
  | {
      type: "audio";
      content: {
        title?: string;
        description?: string;
        script?: string;
        url?: string;
        duration?: string;
      };
    };

type LtiPublishResult = {
  configId: string;
  version: string;
  registrationUrl?: string;
  loginInitiationUrl: string;
  launchUrl: string;
  jwksUrl: string;
  platformIssuer?: string;
  clientId?: string;
  deploymentId?: string;
  instructions: string[];
};

const surfaceClass = "bg-white";

export default function ModuleContent() {
  const [, params] = useRoute("/module/:moduleId/content/:contentBlockId?");
  const moduleId = params?.moduleId as string;
  const contentBlockId = params?.contentBlockId as string | undefined;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [orderedBlocks, setOrderedBlocks] = useState<ContentBlock[]>([]);
  const [isNavVisible, setIsNavVisible] = useState(() => {
    const saved = localStorage.getItem("courseNavVisible");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isAiAssistantVisible, setIsAiAssistantVisible] = useState(false);
  const [isDirectPublishDialogOpen, setIsDirectPublishDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState<AiPreview | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiSubmitting, setIsAiSubmitting] = useState(false);
  const [activeInsertIndex, setActiveInsertIndex] = useState<number | null>(null);
  const [ltiPlatformName, setLtiPlatformName] = useState("");
  const [ltiPlatformIssuer, setLtiPlatformIssuer] = useState("");
  const [ltiClientId, setLtiClientId] = useState("");
  const [ltiDeploymentId, setLtiDeploymentId] = useState("");
  const [ltiAuthLoginUrl, setLtiAuthLoginUrl] = useState("");
  const [ltiKeysetUrl, setLtiKeysetUrl] = useState("");
  const [ltiPublishResult, setLtiPublishResult] = useState<LtiPublishResult | null>(null);
  const [courseTitleDraft, setCourseTitleDraft] = useState("");
  const [courseObjectiveDraft, setCourseObjectiveDraft] = useState("");

  const isUpdatingFromServerRef = useRef(false);
  const activeInsertMenuRef = useRef<HTMLDivElement | null>(null);
  const courseTitleRef = useRef<HTMLHeadingElement | null>(null);
  const courseObjectiveRef = useRef<HTMLParagraphElement | null>(null);

  const parseObjectives = (value?: string | null) =>
    String(value || "")
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\s]+/, "").trim())
      .filter(Boolean);
  const objectivesToParagraph = (items: string[], maxItems: number) =>
    items.slice(0, maxItems).join(" ");

  const { data: module, isInitialLoading: moduleInitialLoading } = useQuery<Module>({
    queryKey: ["/api/modules", moduleId],
    enabled: !!moduleId,
    staleTime: 30000,
    placeholderData: (previousData: Module | undefined) => previousData,
  });

  const { data: course } = useQuery<Course>({
    queryKey: ["/api/courses", module?.courseId],
    enabled: !!module?.courseId,
    staleTime: 60000,
    placeholderData: (previousData: Course | undefined) => previousData,
  });

  const { data: courseModules } = useQuery<Module[]>({
    queryKey: ["/api/courses", module?.courseId, "modules"],
    enabled: !!module?.courseId,
    staleTime: 30000,
    placeholderData: (previousData: Module[] | undefined) => previousData,
  });

  const { data: contentBlocks, isInitialLoading: blocksInitialLoading } = useQuery<ContentBlock[]>({
    queryKey: ["/api/modules", moduleId, "content-blocks"],
    enabled: !!moduleId,
    staleTime: 10000,
    placeholderData: (previousData: ContentBlock[] | undefined) => previousData,
  });

  useEffect(() => {
    if (!contentBlockId && contentBlocks && contentBlocks.length > 0) {
      const firstBlock = [...contentBlocks].sort((a, b) => parseInt(a.order) - parseInt(b.order))[0];
      setLocation(`/module/${moduleId}/content/${firstBlock.id}`, { replace: true });
    }
  }, [contentBlockId, contentBlocks, moduleId, setLocation]);

  useEffect(() => {
    if (contentBlocks) {
      isUpdatingFromServerRef.current = true;
      setOrderedBlocks([...contentBlocks].sort((a, b) => parseInt(a.order) - parseInt(b.order)));
      setTimeout(() => {
        isUpdatingFromServerRef.current = false;
      }, 100);
    }
  }, [contentBlocks]);

  useEffect(() => {
    localStorage.setItem("courseNavVisible", JSON.stringify(isNavVisible));
  }, [isNavVisible]);

  const currentModule = module;
  const parentModule = currentModule?.parentModuleId
    ? courseModules?.find((candidate) => candidate.id === currentModule.parentModuleId)
    : undefined;
  const displayModule = parentModule ?? currentModule;
  const displayChapter = parentModule ? currentModule : undefined;
  const fallbackModuleLocation = useMemo(() => {
    if (!courseModules || courseModules.length === 0) {
      return null;
    }

    const topLevelModules = courseModules
      .filter((candidate: any) => !candidate.parentModuleId)
      .sort((a, b) => parseInt(a.order) - parseInt(b.order));

    for (const topLevelModule of topLevelModules) {
      const chapters = courseModules
        .filter((candidate: any) => candidate.parentModuleId === topLevelModule.id)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));
      if (chapters.length > 0) {
        return `/module/${chapters[0].id}/content`;
      }
      return `/module/${topLevelModule.id}/content`;
    }

    return null;
  }, [courseModules]);

  const courseObjectives = parseObjectives(course?.learningObjectives);
  const moduleObjectives = parseObjectives(displayModule?.description);
  const courseObjectivesParagraph = objectivesToParagraph(courseObjectives, 5);
  const moduleObjectivesParagraph = objectivesToParagraph(moduleObjectives, 3);
  const chapterSummary = String(displayChapter?.description || "").replace(/<[^>]*>/g, "").trim();

  useEffect(() => {
    setCourseTitleDraft(course?.title ?? "");
    setCourseObjectiveDraft(objectivesToParagraph(parseObjectives(course?.learningObjectives), 5));
  }, [course?.learningObjectives, course?.title]);

  useEffect(() => {
    if (courseTitleRef.current && document.activeElement !== courseTitleRef.current) {
      courseTitleRef.current.textContent = courseTitleDraft;
    }
  }, [courseTitleDraft]);

  useEffect(() => {
    if (courseObjectiveRef.current && document.activeElement !== courseObjectiveRef.current) {
      courseObjectiveRef.current.textContent = courseObjectiveDraft;
    }
  }, [courseObjectiveDraft]);

  useEffect(() => {
    if (!moduleInitialLoading && !module && fallbackModuleLocation && fallbackModuleLocation !== `/module/${moduleId}/content`) {
      setLocation(fallbackModuleLocation, { replace: true });
    }
  }, [fallbackModuleLocation, module, moduleId, moduleInitialLoading, setLocation]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "\\") {
        event.preventDefault();
        setIsNavVisible((prev: boolean) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const reorderMutation = useMutation({
    mutationFn: async (blocks: ContentBlock[]) => {
      await Promise.all(
        blocks.map((block) =>
          apiRequest("PUT", `/api/content-blocks/${block.id}`, {
            order: block.order,
          }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "content-blocks"] });
    },
  });

  const updateCourseDetailsMutation = useMutation({
    mutationFn: async (updates: Partial<Course>) => {
      if (!course) {
        throw new Error("Course not loaded");
      }
      const response = await apiRequest("PUT", `/api/courses/${course.id}`, updates);
      return response.json() as Promise<Course>;
    },
    onSuccess: (updatedCourse) => {
      queryClient.setQueryData(["/api/courses", updatedCourse.id], updatedCourse);
      queryClient.setQueryData<Course[]>(["/api/courses"], (existing) =>
        existing?.map((candidate) => (candidate.id === updatedCourse.id ? updatedCourse : candidate)) ?? existing,
      );
      toast({
        title: "Updated",
        description: "Course details saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update course details.",
        variant: "destructive",
      });
    },
  });

  const saveCourseTitle = async () => {
    if (!course) {
      return;
    }
    const nextTitle = courseTitleDraft.trim();
    if (!nextTitle || nextTitle === course.title) {
      setCourseTitleDraft(course.title ?? "");
      return;
    }
    await updateCourseDetailsMutation.mutateAsync({ title: nextTitle });
  };

  const saveCourseObjective = async () => {
    if (!course) {
      return;
    }
    const nextObjective = courseObjectiveDraft.trim();
    if (nextObjective === (course.learningObjectives ?? "").trim()) {
      setCourseObjectiveDraft(course.learningObjectives ?? "");
      return;
    }
    await updateCourseDetailsMutation.mutateAsync({ learningObjectives: nextObjective });
  };

  useEffect(() => {
    if (!orderedBlocks.length || !contentBlocks || isUpdatingFromServerRef.current) {
      return;
    }

    const orderChanged = orderedBlocks.some((block, index) => {
      const serverBlock = contentBlocks.find((candidate) => candidate.id === block.id);
      return serverBlock && serverBlock.order !== index.toString();
    });

    if (orderChanged) {
      const timeoutId = setTimeout(() => {
        reorderMutation.mutate(orderedBlocks);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [contentBlocks, orderedBlocks, reorderMutation]);

  const moveBlock = useCallback((dragId: string, hoverId: string) => {
    setOrderedBlocks((prevBlocks) => {
      const dragIndex = prevBlocks.findIndex((block) => block.id === dragId);
      const hoverIndex = prevBlocks.findIndex((block) => block.id === hoverId);

      if (dragIndex === -1 || hoverIndex === -1 || dragIndex === hoverIndex) {
        return prevBlocks;
      }

      const newBlocks = [...prevBlocks];
      const [draggedBlock] = newBlocks.splice(dragIndex, 1);
      newBlocks.splice(hoverIndex, 0, draggedBlock);

      return newBlocks.map((block, index) => ({
        ...block,
        order: index.toString(),
      }));
    });
  }, []);

  const createContentBlockMutation = useMutation({
    mutationFn: async (blockData: { type: string; content: unknown; order: string; metadata?: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/modules/${moduleId}/content-blocks`, blockData);
      return response.json();
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "content-blocks"] });
      if (variables.metadata?.isAiGenerated) {
        toast({
          title: String(variables.metadata.successTitle || "Content created"),
          description: String(variables.metadata.successDescription || "Content block has been added successfully."),
        });
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to add content block";
      toast({
        title: "Error creating block",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Create top-level modules
  const createModuleMutation = useMutation({
    mutationFn: async () => {
      if (!module) {
        throw new Error("Module not loaded");
      }

      const modulesResponse = await apiRequest("GET", `/api/courses/${module.courseId}/modules`);
      const modules = (await modulesResponse.json()) as Module[];
      const topLevelModules = modules.filter((candidate: any) => !candidate.parentModuleId);
      const nextOrder =
        topLevelModules.length > 0
          ? Math.max(...topLevelModules.map((candidate) => parseInt(candidate.order))) + 1
          : 0;

      const response = await apiRequest("POST", `/api/courses/${module.courseId}/modules`, {
        title: "Untitled Module",
        description: "",
        order: nextOrder.toString(),
        lessonType: "block",
      });

      return response.json() as Promise<Module>;
    },
    onSuccess: async (newModule) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/courses", newModule.courseId, "modules"] });
      setLocation(`/module/${newModule.id}/content`);
      toast({
        title: "Module created",
        description: "A new module has been added to the course.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create module",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create lessons under a specific module
  const createLessonMutation = useMutation({
    mutationFn: async (parentModuleId: string) => {
      if (!module) {
        throw new Error("Module not loaded");
      }

      const modulesResponse = await apiRequest("GET", `/api/courses/${module.courseId}/modules`);
      const modules = (await modulesResponse.json()) as Module[];
      const lessonsInModule = modules.filter((candidate: any) => candidate.parentModuleId === parentModuleId);
      const nextOrder =
        lessonsInModule.length > 0
          ? Math.max(...lessonsInModule.map((candidate) => parseInt(candidate.order))) + 1
          : 0;

      const response = await apiRequest("POST", `/api/courses/${module.courseId}/modules`, {
        parentModuleId,
        title: "Untitled page",
        description: "",
        order: nextOrder.toString(),
        lessonType: "block",
      });

      return response.json() as Promise<Module>;
    },
    onSuccess: async (newLesson) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/courses", newLesson.courseId, "modules"] });
      setLocation(`/module/${newLesson.id}/content`);
      toast({
        title: "Lesson created",
        description: "A new lesson has been added to the module.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create lesson",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const insertBlockAt = useCallback(
    async (type: string, content: any, insertIndex: number, metadata?: Record<string, unknown>) => {
      const response = await apiRequest("POST", `/api/modules/${moduleId}/content-blocks`, {
        type,
        content,
        order: (orderedBlocks.length || 0).toString(),
      });
      const createdBlock = (await response.json()) as ContentBlock;

      const nextBlocks = [...orderedBlocks];
      nextBlocks.splice(insertIndex, 0, createdBlock);

      await Promise.all(
        nextBlocks.map((block, index) =>
          apiRequest("PUT", `/api/content-blocks/${block.id}`, {
            order: index.toString(),
          }),
        ),
      );

      await queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId, "content-blocks"] });
      setActiveInsertIndex(null);

      if (metadata?.isAiGenerated) {
        toast({
          title: String(metadata.successTitle || "Content created"),
          description: String(metadata.successDescription || "Content block has been added successfully."),
        });
      }
    },
    [moduleId, orderedBlocks, toast],
  );

  const handleAddContentBlock = async (type: string, content: any, insertIndex = orderedBlocks.length) => {
    const order = insertIndex.toString();

    if (type === "ai-quiz") {
      try {
        toast({
          title: "Generating quiz...",
          description: "AI is creating quiz questions for you.",
        });

        const response = await apiRequest("POST", "/api/ai/generate-quiz", {
          moduleId,
          prompt: "Generate quiz questions for this lesson content. Focus on testing understanding of key concepts and learning objectives.",
          questionCount: 3,
          difficulty: "medium",
          questionTypes: ["multiple-choice"],
          includeCourseContext: true,
        });

        const data = await response.json();
        const transformedQuestions = data.questions.map((question: any) => {
          let correctAnswer = question.correctAnswer || "";
          if (correctAnswer && question.options && correctAnswer.length > 1) {
            const correctIndex = question.options.findIndex(
              (option: string) => option === correctAnswer || option.includes(correctAnswer),
            );
            if (correctIndex !== -1) {
              correctAnswer = String.fromCharCode(65 + correctIndex);
            }
          }

          return {
            ...question,
            correctAnswer,
            options: question.options || ["", "", "", ""],
          };
        });

        const quizContent = {
          ...content,
          questions: transformedQuestions,
          title: "Generated Quiz",
          description: data.description || "Test your understanding of the content",
          isGenerated: true,
        };

        if (insertIndex === orderedBlocks.length) {
          createContentBlockMutation.mutate({
            type,
            content: quizContent,
            order,
            metadata: {
              isAiGenerated: true,
              successTitle: "Quiz generated successfully",
              successDescription: `Generated ${transformedQuestions.length} questions using ${data.model}`,
            },
          });
        } else {
          await insertBlockAt(type, quizContent, insertIndex, {
            isAiGenerated: true,
            successTitle: "Quiz generated successfully",
            successDescription: `Generated ${transformedQuestions.length} questions using ${data.model}`,
          });
        }
        return;
      } catch (error) {
        toast({
          title: "Quiz generation failed",
          description: error instanceof Error ? error.message : "The AI service is temporarily unavailable.",
          variant: "destructive",
        });
        return;
      }
    }

    if (type === "ai-assignment") {
      try {
        toast({
          title: "Generating assignment...",
          description: "AI is creating an assignment for you.",
        });

        const response = await apiRequest("POST", "/api/ai/generate-assignment", {
          moduleId,
          prompt: "Create an assignment that helps students apply and demonstrate their understanding of the key concepts from this lesson module.",
          assignmentType: "project",
          difficulty: "medium",
          taskCount: 3,
          includeRubric: true,
          includeCourseContext: true,
        });

        const data = await response.json();
        const assignmentContent = {
          ...content,
          ...data.assignment,
          isGenerated: true,
        };

        if (insertIndex === orderedBlocks.length) {
          createContentBlockMutation.mutate({
            type,
            content: assignmentContent,
            order,
            metadata: {
              isAiGenerated: true,
              successTitle: "Assignment generated successfully",
              successDescription: `Created assignment using ${data.model}`,
            },
          });
        } else {
          await insertBlockAt(type, assignmentContent, insertIndex, {
            isAiGenerated: true,
            successTitle: "Assignment generated successfully",
            successDescription: `Created assignment using ${data.model}`,
          });
        }
        return;
      } catch (error) {
        toast({
          title: "Assignment generation failed",
          description: error instanceof Error ? error.message : "The AI service is temporarily unavailable.",
          variant: "destructive",
        });
        return;
      }
    }

    if (insertIndex === orderedBlocks.length) {
      createContentBlockMutation.mutate({ type, content, order });
      setActiveInsertIndex(null);
      return;
    }

    await insertBlockAt(type, content, insertIndex);
  };

  const handlePackageCourse = async () => {
    if (!course) {
      return;
    }

    try {
      const response = await apiRequest("POST", `/api/courses/${course.id}/publish/package`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${course.title.replace(/ /g, "_")}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast({
        title: "Error",
        description: "Failed to package course. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLtiPublish = async () => {
    if (!course) {
      return;
    }

    try {
      const response = await apiRequest("POST", `/api/courses/${course.id}/publish/lti`, {
        platformName: ltiPlatformName.trim(),
        platformIssuer: ltiPlatformIssuer.trim(),
        clientId: ltiClientId.trim(),
        deploymentId: ltiDeploymentId.trim(),
        authLoginUrl: ltiAuthLoginUrl.trim(),
        keysetUrl: ltiKeysetUrl.trim(),
      });
      const result = await response.json() as LtiPublishResult;
      setLtiPublishResult(result);
      toast({
        title: "LTI configuration ready",
        description: "Use the generated LTI 1.3 login, launch, and JWKS URLs in your LMS external tool settings.",
      });
    } catch (error) {
      toast({
        title: "LTI setup failed",
        description: error instanceof Error ? error.message : "Failed to prepare LTI configuration.",
        variant: "destructive",
      });
    }
  };

  const handleLtiRegistrationSetup = async () => {
    if (!course) {
      return;
    }

    try {
      const response = await apiRequest("POST", `/api/courses/${course.id}/publish/lti-registration`, {
        platformName: ltiPlatformName.trim(),
      });
      const result = await response.json() as LtiPublishResult;
      setLtiPublishResult(result);
      toast({
        title: "Registration URL ready",
        description: "Paste the generated registration URL into MoodleCloud's LTI 1.3 registration flow.",
      });
    } catch (error) {
      toast({
        title: "LTI setup failed",
        description: error instanceof Error ? error.message : "Failed to prepare the MoodleCloud registration URL.",
        variant: "destructive",
      });
    }
  };

  const handleAiSubmit = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      return;
    }

    try {
      setIsAiSubmitting(true);
      const lowerPrompt = prompt.toLowerCase();
      const wantsImage = /\b(image|picture|illustration|diagram|figure|icon|graphic|photo|visual|cover)\b/.test(lowerPrompt);
      const wantsAudio = /\b(audio|narration|voiceover|podcast|speech|spoken)\b/.test(lowerPrompt);

      if (wantsImage) {
        const response = await apiRequest("POST", "/api/ai/generate-image", { prompt });
        const data = await response.json();
        setAiPreview({
          type: "image",
          content: {
            url: data.url,
            caption: prompt,
            alt: prompt,
          },
        });
        return;
      }

      if (wantsAudio) {
        const response = await apiRequest("POST", "/api/ai/generate-audio", {
          moduleId,
          type: "explanation",
          prompt,
          includeCourseContext: true,
          style: { tone: "friendly", readingLevel: "intermediate" },
          length: "medium",
        });
        const data = await response.json();
        setAiPreview({
          type: "audio",
          content: {
            title: `Audio: ${module?.title || ""}`,
            description: "AI-generated audio narration",
            script: data.script,
            url: data.audioUrl,
            duration: data.duration || "",
          },
        });
        return;
      }

      const response = await apiRequest("POST", "/api/ai/generate-text", {
        moduleId,
        type: "explanation",
        prompt,
        includeCourseContext: true,
        style: { tone: "neutral", readingLevel: "intermediate" },
        length: "medium",
      });
      const data = await response.json();
      const text = String(data.text || "");
      const html = text.includes("<")
        ? text
        : text
            .split("\n\n")
            .map((paragraph) => `<p>${paragraph.trim().split("\n").join("<br>")}</p>`)
            .join("");
      setAiPreview({ type: "text", content: { text, html } });
    } catch {
      toast({
        title: "AI request failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAiSubmitting(false);
    }
  };

  const handleAddPreviewToCanvas = () => {
    if (!aiPreview) {
      return;
    }

    const order =
      contentBlocks && contentBlocks.length > 0
        ? (Math.max(...contentBlocks.map((block) => parseInt(block.order))) + 1).toString()
        : "0";

    if (aiPreview.type === "text") {
      createContentBlockMutation.mutate({ type: "ai-text", content: aiPreview.content, order });
    }
    if (aiPreview.type === "image") {
      createContentBlockMutation.mutate({ type: "ai-image", content: aiPreview.content, order });
    }
    if (aiPreview.type === "audio") {
      createContentBlockMutation.mutate({ type: "ai-audio", content: aiPreview.content, order });
    }

    setAiPreview(null);
    setAiPrompt("");
  };

  const isInitialLoad = moduleInitialLoading || blocksInitialLoading;

  if (isInitialLoad) {
    return (
      <div className="flex h-screen bg-[#f3f5f8] pt-16">
        <div className="hidden w-[320px] border-r border-slate-200 bg-white xl:block" />
        <main className="flex-1 overflow-auto px-6 py-8">
          <div className="mx-auto max-w-[980px] space-y-6 animate-pulse">
            <div className="h-28 rounded-2xl bg-white" />
            <div className="h-40 rounded-2xl bg-white" />
            <div className="h-40 rounded-2xl bg-white" />
            <div className="h-16 rounded-2xl bg-white" />
          </div>
        </main>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f3f5f8] px-6">
        <div className={`${surfaceClass} max-w-md p-8 text-center`}>
          <h1 className="text-2xl font-semibold text-slate-900">Module not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            The selected module could not be loaded. Return to your course list and try again.
          </p>
          <Button className="mt-6" onClick={() => setLocation("/my-courses")} data-testid="button-back-to-courses-missing-module">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Dialog open={isDirectPublishDialogOpen} onOpenChange={setIsDirectPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Direct Publish to LMS</DialogTitle>
            <DialogDescription>Use the MoodleCloud registration URL first. Manual LTI values are only needed for fallback setup.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Preferred: MoodleCloud registration URL</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Generate a registration URL, paste it into MoodleCloud's LTI 1.3 registration flow, and let Moodle register itself automatically.
              </p>
              <Button type="button" className="mt-3" onClick={handleLtiRegistrationSetup}>
                Generate Registration URL
              </Button>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lti-platform-name" className="text-right">
                LMS Name
              </Label>
              <Input id="lti-platform-name" className="col-span-3" value={ltiPlatformName} onChange={(event) => setLtiPlatformName(event.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lti-platform-issuer" className="text-right">
                Issuer
              </Label>
              <Input id="lti-platform-issuer" className="col-span-3" value={ltiPlatformIssuer} onChange={(event) => setLtiPlatformIssuer(event.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lti-client-id" className="text-right">
                Client ID
              </Label>
              <Input id="lti-client-id" className="col-span-3" value={ltiClientId} onChange={(event) => setLtiClientId(event.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lti-deployment-id" className="text-right">
                Deployment ID
              </Label>
              <Input id="lti-deployment-id" className="col-span-3" value={ltiDeploymentId} onChange={(event) => setLtiDeploymentId(event.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lti-auth-login-url" className="text-right">
                Auth URL
              </Label>
              <Input id="lti-auth-login-url" className="col-span-3" value={ltiAuthLoginUrl} onChange={(event) => setLtiAuthLoginUrl(event.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lti-keyset-url" className="text-right">
                Platform JWKS
              </Label>
              <Input id="lti-keyset-url" className="col-span-3" value={ltiKeysetUrl} onChange={(event) => setLtiKeysetUrl(event.target.value)} />
            </div>
            {ltiPublishResult ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Launch configuration</div>
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Registration URL</div>
                    <Input value={ltiPublishResult.registrationUrl || ""} readOnly className="mt-1 bg-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Login initiation URL</div>
                    <Input value={ltiPublishResult.loginInitiationUrl} readOnly className="mt-1 bg-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Launch URL</div>
                    <Input value={ltiPublishResult.launchUrl} readOnly className="mt-1 bg-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tool JWKS URL</div>
                    <Input value={ltiPublishResult.jwksUrl} readOnly className="mt-1 bg-white" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Setup steps</div>
                    <div className="mt-1 space-y-1 text-sm text-slate-600">
                      {ltiPublishResult.instructions.map((instruction) => (
                        <div key={instruction}>{instruction}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={handleLtiPublish}>Generate Manual LTI 1.3 Setup</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Course</DialogTitle>
            <DialogDescription>Choose the format to publish your course.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              onClick={() => {
                handlePackageCourse();
                setIsPublishDialogOpen(false);
              }}
            >
              SCORM
            </Button>
            <Button
              onClick={() => {
                setIsDirectPublishDialogOpen(true);
                setIsPublishDialogOpen(false);
              }}
            >
              LTI
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-white">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/my-courses")}
                className="h-9 w-9 rounded-full p-0"
                data-testid="button-back-to-courses"
                title="Back to My Courses"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{course?.title || "Course"}</div>
                <div className="truncate text-xs text-slate-500">{module.title}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isPreviewMode ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAiAssistantVisible((prev) => !prev)}
                  className="rounded-full border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                  data-testid="button-ai-assistant-toggle"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-violet-600" />
                  AI
                </Button>
              ) : null}
              <Button
                variant={isPreviewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreviewMode((prev) => !prev)}
                className="rounded-full"
                data-testid="button-preview"
              >
                <Eye className="mr-2 h-4 w-4" />
                {isPreviewMode ? "Exit preview" : "Preview"}
              </Button>
              {isPreviewMode ? (
                <Button
                  size="sm"
                  onClick={() => setIsPublishDialogOpen(true)}
                  className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
                  data-testid="button-publish-course"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Publish
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex h-screen pt-16">
          {isNavVisible && (
            <aside className="hidden w-[320px] shrink-0 border-r border-slate-200 bg-white lg:block">
              <CourseNavigation
                courseId={module.courseId}
                currentModuleId={moduleId}
                currentBlockId={contentBlockId}
                courseTitle={course?.title}
                onAddModule={() => createModuleMutation.mutate()}
                onAddLesson={(parentModuleId: string) => createLessonMutation.mutate(parentModuleId)}
                onToggleVisibility={() => setIsNavVisible(false)}
              />
            </aside>
          )}

          <main className="flex-1 overflow-auto">
            {!isNavVisible ? (
              <div className="fixed left-4 top-24 z-30 hidden lg:block">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNavVisible(true)}
                  className="rounded-full bg-white shadow-sm"
                  data-testid="button-show-nav"
                  title="Show outline"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <div className="rise-shell mx-auto max-w-[980px] px-4 py-8 sm:px-6">
              <div className={`${surfaceClass} ${isPreviewMode ? "rise-preview-surface" : "rise-editor-surface"}`}>
                <section className="border-b border-slate-200 px-8 py-8">
                  <div className="space-y-6">
                  <div className="space-y-3">
                    <h1
                      ref={courseTitleRef}
                      contentEditable={!isPreviewMode}
                      suppressContentEditableWarning={!isPreviewMode}
                      onInput={
                        isPreviewMode
                          ? undefined
                          : (event: React.FormEvent<HTMLHeadingElement>) => setCourseTitleDraft(event.currentTarget.textContent || "")
                      }
                      onBlur={isPreviewMode ? undefined : () => void saveCourseTitle()}
                      onKeyDown={(event) => {
                        if (isPreviewMode) {
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setCourseTitleDraft(course?.title ?? "");
                          event.currentTarget.textContent = course?.title ?? "";
                          event.currentTarget.blur();
                        }
                      }}
                      className={`rise-lesson-title max-w-3xl ${isPreviewMode ? "" : "outline-none"}`}
                    >
                      {courseTitleDraft || "Course"}
                    </h1>
                    <p
                      ref={courseObjectiveRef}
                      contentEditable={!isPreviewMode}
                      suppressContentEditableWarning={!isPreviewMode}
                      onInput={
                        isPreviewMode
                          ? undefined
                          : (event: React.FormEvent<HTMLParagraphElement>) => setCourseObjectiveDraft(event.currentTarget.textContent || "")
                      }
                      onBlur={isPreviewMode ? undefined : () => void saveCourseObjective()}
                      className={`rise-lesson-description max-w-4xl whitespace-pre-wrap text-slate-700 ${isPreviewMode ? "" : "outline-none"}`}
                    >
                      {courseObjectiveDraft}
                    </p>
                  </div>

                  {displayModule ? (
                    <div className="border-t border-slate-200 pt-6">
                    <h2 className="text-2xl font-semibold text-slate-900">{displayModule.title}</h2>
                    {moduleObjectivesParagraph ? (
                      <div className="mt-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Learning Objective</div>
                        <p className="rise-lesson-description mt-2 max-w-4xl text-slate-600">
                          {moduleObjectivesParagraph}
                        </p>
                      </div>
                    ) : null}
                    </div>
                  ) : null}

                  {displayChapter ? (
                    <div className="border-t border-slate-200 pt-6">
                    <h3 className="text-lg font-semibold text-slate-900">{displayChapter.title}</h3>
                    {chapterSummary ? (
                      <p className="rise-lesson-description mt-2 max-w-3xl text-slate-500">
                        {chapterSummary}
                      </p>
                    ) : null}
                    </div>
                  ) : null}
                  </div>
                </section>

                {isPreviewMode ? (
                  <div data-testid="preview-content-container">
                    <div className="px-8 py-2">
                  {orderedBlocks.length > 0 ? (
                    orderedBlocks.map((block) => (
                      <div key={block.id}>
                        <ContentBlockComponent contentBlock={block} previewMode />
                      </div>
                    ))
                  ) : null}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="px-8 py-2">
                    {orderedBlocks.length > 0 ? (
                      orderedBlocks.map((block, index) => (
                        <div key={block.id} className="group/insert">
                          <ContentBlockComponent
                            contentBlock={block}
                            onMoveBlock={moveBlock}
                          />
                            <div
                              ref={activeInsertIndex === index + 1 ? activeInsertMenuRef : null}
                              className="relative flex items-center justify-center py-1"
                            >
                              <div
                                className={`absolute left-0 right-0 h-px bg-slate-200 transition-opacity duration-150 ${
                                  activeInsertIndex === index + 1 ? "opacity-100" : "opacity-0 group-hover/insert:opacity-100"
                                }`}
                              />
                              {activeInsertIndex === index + 1 ? (
                                <>
                                  <button
                                    type="button"
                                    aria-hidden="true"
                                    className="fixed inset-0 z-10 cursor-default"
                                    onClick={() => setActiveInsertIndex(null)}
                                  />
                                  <div className="relative z-20">
                                    <ContentBlockMenu
                                      onAddContent={(type, content) => {
                                        void handleAddContentBlock(type, content, index + 1);
                                      }}
                                      onClose={() => setActiveInsertIndex(null)}
                                      mode="mini"
                                    />
                                  </div>
                                </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setActiveInsertIndex(index + 1)}
                                className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-white opacity-0 shadow-sm transition-all duration-150 group-hover/insert:opacity-100 hover:bg-slate-900 focus:opacity-100"
                                aria-label="Insert block"
                              >
                                <Plus className="h-2.5 w-2.5 stroke-[2.75]" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <div className="text-lg font-medium text-slate-900">Start building this lesson</div>
                        <p className="mt-2 text-sm text-slate-500">
                          Use the quick toolbar below to add text, media, interactions, and AI-generated blocks.
                        </p>
                      </div>
                    )}

                    <div className="sticky bottom-6 z-20 flex justify-center pt-2">
                      <ContentBlockMenu
                        onAddContent={(type, content) => {
                          void handleAddContentBlock(type, content);
                        }}
                        onClose={() => undefined}
                      />
                    </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>

          {isAiAssistantVisible && (
            <aside className="hidden w-[360px] shrink-0 border-l border-slate-200 bg-white xl:block">
              <div className="flex h-full flex-col">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-900">AI assistant</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Generate text, images, and narration for the current lesson without leaving the editor.
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-auto p-5">
                  <Textarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Describe what you want to create..."
                    className="min-h-[140px] resize-none rounded-2xl border-slate-200"
                  />

                  <Button
                    onClick={handleAiSubmit}
                    disabled={!aiPrompt.trim() || isAiSubmitting}
                    className="w-full rounded-full bg-slate-900 text-white hover:bg-slate-800"
                  >
                    {isAiSubmitting ? "Generating..." : "Generate"}
                  </Button>

                  {aiPreview && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      {aiPreview.type === "text" && (
                        <div className="max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {aiPreview.content.text || ""}
                        </div>
                      )}

                      {aiPreview.type === "image" && (
                        <div className="space-y-3">
                          <img
                            src={aiPreview.content.url}
                            alt={aiPreview.content.alt}
                            className="max-h-56 w-full rounded-xl object-contain"
                          />
                          <div className="text-xs text-slate-500">{aiPreview.content.caption}</div>
                        </div>
                      )}

                      {aiPreview.type === "audio" && (
                        <div className="space-y-2 text-sm text-slate-700">
                          <div className="font-medium">{aiPreview.content.title || "Audio"}</div>
                          <div className="text-slate-500">{aiPreview.content.description}</div>
                          <a
                            href={aiPreview.content.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-sky-700 underline"
                          >
                            Preview audio
                          </a>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Button size="sm" className="rounded-full" onClick={handleAddPreviewToCanvas}>
                          Add to lesson
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAiPreview(null)}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </DndProvider>
  );
}
