import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, BookOpen, FileText, Plus, PanelLeft, Pencil, Copy, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Module, ContentBlock } from "@shared/schema";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  CSS,
} from "@dnd-kit/utilities";

interface CourseNavigationProps {
  courseId: string;
  currentModuleId?: string;
  currentBlockId?: string;
  onAddModule?: () => void;
  onAddLesson?: (parentModuleId: string) => void;
  courseTitle?: string;
  onToggleVisibility?: () => void;
}

interface ModuleItemProps {
  module: Module;
  modules: Module[];
  isExpanded: boolean;
  onToggle: () => void;
  currentModuleId?: string;
  currentBlockId?: string;
  onAddLesson?: (parentModuleId: string) => void;
  dragHandleProps?: any;
  isDragging?: boolean;
}

interface SortableModuleItemProps extends ModuleItemProps {
  id: string;
}

interface SortableLessonItemProps {
  lesson: Module;
  currentModuleId?: string;
  isEditing: boolean;
  editingTitle: string;
  onEdit: (lesson: Module) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (lesson: Module) => void;
  onTitleChange: (title: string) => void;
  renderActionsMenu: (module: Module, compact: boolean, active: boolean) => React.ReactNode;
  id: string;
}

// Sortable wrapper for modules
function SortableModuleItem(props: SortableModuleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ModuleItem {...props} dragHandleProps={{ ...attributes, ...listeners }} isDragging={isDragging} />
    </div>
  );
}

// Sortable wrapper for lessons
function SortableLessonItem(props: SortableLessonItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { lesson, currentModuleId, isEditing, editingTitle, onEdit, onCancelEdit, onSubmitEdit, onTitleChange, renderActionsMenu } = props;
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  
  const isChapterActive = currentModuleId === lesson.id;
  const handleLessonClick = () => {
    const parentModuleId = lesson.parentModuleId ?? lesson.id;
    const lessonHash = `#lesson-${lesson.id}`;
    const targetPath = `/module/${parentModuleId}/content`;

    if (window.location.pathname === targetPath) {
      const target = document.querySelector(lessonHash);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (window.location.hash !== lessonHash) {
        window.history.replaceState(null, "", `${targetPath}${lessonHash}`);
      }
      return;
    }

    setLocation(`${targetPath}${lessonHash}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer text-[13px] transition-all duration-150 ${
        isChapterActive 
          ? "bg-sky-50 text-sky-700 font-medium" 
          : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
      }`}
      onClick={handleLessonClick}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-0.5 -ml-1"
      >
        <GripVertical className="h-3 w-3" />
      </div>
      <FileText className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editingTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={() => void onSubmitEdit(lesson)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              void onSubmitEdit(lesson);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-md border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-900 focus-visible:ring-slate-300"
        />
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate course-nav-chapter">{lesson.title}</span>
          {renderActionsMenu(lesson, true, isChapterActive)}
        </>
      )}
    </div>
  );
}

function ModuleItem({ module, modules, isExpanded, onToggle, currentModuleId, currentBlockId, onAddLesson, dragHandleProps, isDragging }: ModuleItemProps) {
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  
  const isActive = currentModuleId === module.id;

  // Fetch child modules (chapters) using the module's ID as parentModuleId
  const { data: childModules } = useQuery<Module[]>({
    queryKey: ["/api/courses", module.courseId, "modules"],
    enabled: isExpanded,
    select: (allModules) => allModules
      .filter((m: any) => m.parentModuleId === module.id)
      .sort((a, b) => parseInt(a.order) - parseInt(b.order))
  });

  // Fetch content blocks for backward compatibility
  const { data: blocks } = useQuery<ContentBlock[]>({
    queryKey: ["/api/modules", module.id, "content-blocks"],
    enabled: isExpanded,
  });
  
  const handleModuleClick = () => {
    if (isExpanded && blocks && blocks.length > 0) {
      const first = [...blocks].sort((a, b) => parseInt(a.order) - parseInt(b.order))[0];
      if (first) {
        setLocation(`/module/${module.id}/content/${first.id}`);
        return;
      }
    }
    setLocation(`/module/${module.id}/content`);
  };

  const sortedBlocks = useMemo(
    () => (blocks || []).slice().sort((a, b) => parseInt(a.order) - parseInt(b.order)),
    [blocks]
  );

  const getChapterTitle = (block: ContentBlock) => {
    const content: any = block.content || {};
    const raw = content.text || content.html || "";
    if (!raw) return "Untitled";
    // First sentence/line as chapter label
    const plain = String(raw).replace(/<[^>]*>/g, "");
    const firstLine = plain.split(/\n|\. /)[0]?.trim();
    return firstLine || "Untitled";
  };

  const refreshOutline = async (updatedModule?: Module) => {
    if (updatedModule) {
      queryClient.setQueryData<Module[]>(["/api/courses", module.courseId, "modules"], (existing) =>
        existing?.map((candidate) => (candidate.id === updatedModule.id ? updatedModule : candidate)) ?? existing,
      );
      queryClient.setQueryData<Module>(["/api/modules", updatedModule.id], updatedModule);
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/courses", module.courseId, "modules"] });
  };

  const duplicateContentBlocks = async (sourceModuleId: string, targetModuleId: string) => {
    const response = await apiRequest("GET", `/api/modules/${sourceModuleId}/content-blocks`);
    const sourceBlocks = (await response.json()) as ContentBlock[];

    for (const block of sourceBlocks.sort((a, b) => parseInt(a.order) - parseInt(b.order))) {
      await apiRequest("POST", `/api/modules/${targetModuleId}/content-blocks`, {
        type: block.type,
        content: block.content,
        order: block.order,
        blockStyle: (block as any).blockStyle ?? "default",
        styling: (block as any).styling ?? {},
        accessibility: (block as any).accessibility ?? {},
      });
    }
  };

  const handleEditModule = async (target: Module) => {
    setEditingModuleId(target.id);
    setDraftTitle(target.title);
  };

  useEffect(() => {
    if (!editingModuleId) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingModuleId]);

  const cancelEditing = () => {
    setEditingModuleId(null);
    setDraftTitle("");
  };

  const submitEditing = async (target: Module) => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === target.title) {
      cancelEditing();
      return;
    }

    await apiRequest("PUT", `/api/modules/${target.id}`, {
      title: nextTitle,
    });
    const updatedTarget = { ...target, title: nextTitle } as Module;
    cancelEditing();
    await refreshOutline(updatedTarget);
  };

  const handleDeleteModule = async (target: Module) => {
    const targetChildren = modules.filter((candidate: any) => candidate.parentModuleId === target.id);
    const isParentModule = !target.parentModuleId;
    const remainingModules = modules.filter(
      (candidate: any) => candidate.id !== target.id && !targetChildren.some((child) => child.id === candidate.id),
    );
    const getFirstNavigableLocation = (availableModules: Module[]) => {
      const topLevelModules = availableModules
        .filter((candidate: any) => !candidate.parentModuleId)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));

      for (const topLevelModule of topLevelModules) {
        const chapters = availableModules
          .filter((candidate: any) => candidate.parentModuleId === topLevelModule.id)
          .sort((a, b) => parseInt(a.order) - parseInt(b.order));
        if (chapters.length > 0) {
          return `/module/${topLevelModule.id}/content`;
        }
        return `/module/${topLevelModule.id}/content`;
      }

      return null;
    };
    const nextLocation = (() => {
      if (currentModuleId !== target.id && !targetChildren.some((child) => child.id === currentModuleId)) {
        return null;
      }

      if (!isParentModule && target.parentModuleId) {
        const siblingChapters = remainingModules
          .filter((candidate: any) => candidate.parentModuleId === target.parentModuleId)
          .sort((a, b) => parseInt(a.order) - parseInt(b.order));
        if (siblingChapters.length > 0) {
          return `/module/${target.parentModuleId}/content`;
        }
      }

      return getFirstNavigableLocation(remainingModules);
    })();
    const confirmed = window.confirm(
      isParentModule
        ? `Delete "${target.title}" and its chapters?`
        : `Delete "${target.title}"?`,
    );
    if (!confirmed) {
      return;
    }

    for (const child of targetChildren) {
      await apiRequest("DELETE", `/api/modules/${child.id}`);
    }
    await apiRequest("DELETE", `/api/modules/${target.id}`);
    if (nextLocation) {
      setLocation(nextLocation);
    }
    await refreshOutline();
  };

  const handleDuplicateModule = async (target: Module) => {
    const isParentModule = !target.parentModuleId;
    const siblings = modules.filter((candidate: any) =>
      isParentModule ? !candidate.parentModuleId : candidate.parentModuleId === target.parentModuleId,
    );
    const nextOrder =
      siblings.length > 0 ? Math.max(...siblings.map((candidate) => parseInt(candidate.order))) + 1 : 0;

    const duplicateResponse = await apiRequest("POST", `/api/courses/${target.courseId}/modules`, {
      parentModuleId: target.parentModuleId ?? undefined,
      title: `${target.title} Copy`,
      description: target.description ?? "",
      duration: target.duration ?? "",
      order: nextOrder.toString(),
      lessonType: target.lessonType ?? "block",
      thumbnail: target.thumbnail ?? "",
      icon: (target as any).icon ?? "book",
      navigationSettings: (target as any).navigationSettings ?? {},
    });

    const duplicatedModule = (await duplicateResponse.json()) as Module;

    if (isParentModule) {
      const childModulesToDuplicate = modules
        .filter((candidate: any) => candidate.parentModuleId === target.id)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));
      let childOrder =
        modules.filter((candidate: any) => candidate.parentModuleId === duplicatedModule.id).length;

      for (const childModule of childModulesToDuplicate) {
        const childResponse = await apiRequest("POST", `/api/courses/${childModule.courseId}/modules`, {
          parentModuleId: duplicatedModule.id,
          title: childModule.title,
          description: childModule.description ?? "",
          duration: childModule.duration ?? "",
          order: String(childOrder++),
          lessonType: childModule.lessonType ?? "block",
          thumbnail: childModule.thumbnail ?? "",
          icon: (childModule as any).icon ?? "book",
          navigationSettings: (childModule as any).navigationSettings ?? {},
        });
        const duplicatedChild = (await childResponse.json()) as Module;
        await duplicateContentBlocks(childModule.id, duplicatedChild.id);
      }
    } else {
      await duplicateContentBlocks(target.id, duplicatedModule.id);
    }

    await refreshOutline();
  };

  const renderActionsMenu = (target: Module, compact = false, active = false) => (
    <div className="ml-2 flex-shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={
              compact
                ? "flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-sm font-medium leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                : "flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-sm font-medium leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            }
            onClick={(e) => e.stopPropagation()}
            title="More actions"
            aria-label="More actions"
            data-testid="button-row-actions"
          >
            <span className="block leading-none tracking-tight">...</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onSelect={() => {
              void handleEditModule(target);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit title
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void handleDuplicateModule(target);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onSelect={() => {
              void handleDeleteModule(target);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Module Header */}
      <div
        className={`group grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 ${
          isActive 
            ? "bg-sky-50 text-sky-700 font-medium shadow-[inset_0_0_0_1px_rgba(14,165,233,0.2)]" 
            : "hover:bg-slate-50 text-slate-700"
        } ${isDragging ? "opacity-50" : ""}`}
        onClick={handleModuleClick}
      >
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-0.5 -ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 hover:bg-transparent -ml-1"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-4 w-4 transition-transform duration-200" />
          )}
        </Button>
        <BookOpen className="h-4 w-4 flex-shrink-0 opacity-70" />
        {editingModuleId === module.id ? (
          <Input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => void submitEditing(module)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                void submitEditing(module);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditing();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-900 focus-visible:ring-slate-300"
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] course-nav-module">{module.title}</span>
            {renderActionsMenu(module, false, isActive)}
          </>
        )}
      </div>

      {/* Chapters - Show child modules if they exist, otherwise show content blocks */}
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? '1000px' : '0px',
          opacity: isExpanded ? 1 : 0
        }}
      >
        {childModules && childModules.length > 0 && (
          <div className="ml-7 space-y-1 pt-1 pb-2">
            <SortableContext
              items={childModules.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {childModules.map((childModule) => (
                <SortableLessonItem
                  key={childModule.id}
                  id={childModule.id}
                  lesson={childModule}
                  currentModuleId={currentModuleId}
                  isEditing={editingModuleId === childModule.id}
                  editingTitle={draftTitle}
                  onEdit={handleEditModule}
                  onCancelEdit={cancelEditing}
                  onSubmitEdit={submitEditing}
                  onTitleChange={setDraftTitle}
                  renderActionsMenu={renderActionsMenu}
                />
              ))}
            </SortableContext>
            {/* Add Lesson Button - Show after existing lessons */}
            {onAddLesson && (
              <div className="flex items-end justify-start pt-1 pb-0 ml-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddLesson(module.id);
                  }}
                  className="flex items-center gap-1.5 h-6 px-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add Page
                </Button>
              </div>
            )}
          </div>
        )}
        {/* Show plus button for empty modules when expanded */}
        {(!childModules || childModules.length === 0) && (!sortedBlocks || sortedBlocks.length === 0) && isExpanded && onAddLesson && (
          <div className="ml-7 flex items-end justify-start pt-1 pb-0">
            <div className="ml-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddLesson(module.id);
                }}
                className="flex items-center gap-1.5 h-6 px-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add Page
              </Button>
            </div>
          </div>
        )}
        {/* Fallback: Show content blocks if no child modules (backward compatibility) */}
        {(!childModules || childModules.length === 0) && sortedBlocks && sortedBlocks.length > 0 && (
          <div className="ml-7 space-y-1 pt-1 pb-2">
            {sortedBlocks.map((block) => {
              const isChapterActive = currentBlockId === block.id;
              return (
                <div
                  key={block.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer text-[13px] transition-all duration-150 ${
                    isChapterActive 
                      ? "bg-sky-50 text-sky-700 font-medium" 
                      : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => setLocation(`/module/${module.id}/content/${block.id}`)}
                >
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                  <span className="truncate course-nav-chapter">{getChapterTitle(block)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CourseNavigation({ courseId, currentModuleId, currentBlockId, onAddModule, onAddLesson, courseTitle = 'Course Content', onToggleVisibility }: CourseNavigationProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: modules } = useQuery<Module[]>({
    queryKey: ["/api/courses", courseId, "modules"],
    enabled: !!courseId,
  });

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !modules) {
      return;
    }

    const activeModule = modules.find(m => m.id === active.id);
    const overModule = modules.find(m => m.id === over.id);

    if (!activeModule || !overModule) {
      return;
    }

    // Check if both are top-level modules or both are lessons under the same parent
    const activeIsTopLevel = !activeModule.parentModuleId;
    const overIsTopLevel = !overModule.parentModuleId;
    
    if (activeIsTopLevel && overIsTopLevel) {
      // Reordering top-level modules
      const topLevelModules = modules
        .filter(m => !m.parentModuleId)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));
      
      const oldIndex = topLevelModules.findIndex(m => m.id === active.id);
      const newIndex = topLevelModules.findIndex(m => m.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedModules = arrayMove(topLevelModules, oldIndex, newIndex);
        await reorderTopLevelModules(reorderedModules);
      }
    } else if (!activeIsTopLevel && !overIsTopLevel && activeModule.parentModuleId === overModule.parentModuleId) {
      // Reordering lessons within the same module
      const lessonsInModule = modules
        .filter(m => m.parentModuleId === activeModule.parentModuleId)
        .sort((a, b) => parseInt(a.order) - parseInt(b.order));
      
      const oldIndex = lessonsInModule.findIndex(m => m.id === active.id);
      const newIndex = lessonsInModule.findIndex(m => m.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedLessons = arrayMove(lessonsInModule, oldIndex, newIndex);
        await reorderLessonsInModule(reorderedLessons, activeModule.parentModuleId!);
      }
    }
  };

  const reorderTopLevelModules = async (reorderedModules: Module[]) => {
    try {
      // Update orders on reordered modules
      await Promise.all(
        reorderedModules.map((module, index) =>
          apiRequest("PUT", `/api/modules/${module.id}`, {
            order: index.toString(),
          })
        )
      );
      
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "modules"] });
    } catch (error) {
      console.error("Failed to reorder modules:", error);
    }
  };

  const reorderLessonsInModule = async (reorderedLessons: Module[], parentModuleId: string) => {
    try {
      // Update orders on reordered lessons
      await Promise.all(
        reorderedLessons.map((lesson, index) =>
          apiRequest("PUT", `/api/modules/${lesson.id}`, {
            order: index.toString(),
          })
        )
      );
      
      // Invalidate and refetch
      await queryClient.invalidateQueries({ queryKey: ["/api/courses", courseId, "modules"] });
    } catch (error) {
      console.error("Failed to reorder lessons:", error);
    }
  };

  // Auto-expand the current module's parent (for chapters) or the module itself
  useEffect(() => {
    if (currentModuleId && modules) {
      setExpandedModules(prev => {
        const currentModule = modules.find(m => m.id === currentModuleId);
        if (!currentModule) return prev;
        
        const next = new Set(prev);
        
        // If this is a chapter (has parentModuleId), expand the parent
        if ((currentModule as any).parentModuleId) {
          next.add((currentModule as any).parentModuleId);
        } else {
          // If this is a parent module, expand it
          next.add(currentModuleId);
        }
        
        return next;
      });
    }
  }, [currentModuleId, modules]);

  // Prefetch adjacent chapters for smoother navigation
  useEffect(() => {
    if (!currentModuleId || !modules) return;

    const currentModule = modules.find(m => m.id === currentModuleId);
    if (!currentModule) return;

    // Get parent module to find siblings
    const parentModuleId = (currentModule as any).parentModuleId;
    if (!parentModuleId) return;

    // Find all siblings (chapters under same parent)
    const siblings = modules
      .filter(m => (m as any).parentModuleId === parentModuleId)
      .sort((a, b) => parseInt(a.order) - parseInt(b.order));

    const currentIndex = siblings.findIndex(m => m.id === currentModuleId);
    if (currentIndex === -1) return;

    // Prefetch previous and next chapters
    const prefetchModule = (module: Module) => {
      // Prefetch module data
      queryClient.prefetchQuery({
        queryKey: ["/api/modules", module.id],
        queryFn: async () => {
          const response = await apiRequest("GET", `/api/modules/${module.id}`);
          return response.json();
        },
        staleTime: 30000,
      });

      // Prefetch content blocks
      queryClient.prefetchQuery({
        queryKey: ["/api/modules", module.id, "content-blocks"],
        queryFn: async () => {
          const response = await apiRequest("GET", `/api/modules/${module.id}/content-blocks`);
          return response.json();
        },
        staleTime: 10000,
      });
    };

    // Prefetch previous chapter
    if (currentIndex > 0) {
      prefetchModule(siblings[currentIndex - 1]);
    }

    // Prefetch next chapter
    if (currentIndex < siblings.length - 1) {
      prefetchModule(siblings[currentIndex + 1]);
    }
  }, [currentModuleId, modules]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{courseTitle}</div>
            <div className="mt-1 text-xs text-slate-500">
              {modules?.filter((m: any) => !m.parentModuleId).length || 0} module
              {(modules?.filter((m: any) => !m.parentModuleId).length || 0) === 1 ? "" : "s"}
            </div>
          </div>
          {onToggleVisibility ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              className="h-9 w-9 rounded-full p-0 text-slate-500 hover:text-slate-900"
              data-testid="button-hide-nav"
              title="Hide outline"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        {onAddModule && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddModule}
            className="mt-4 w-full justify-start rounded-xl border-dashed border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Module
          </Button>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-129px)] px-3 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2 pr-2">
            {modules && modules.length > 0 ? (
              <SortableContext
                items={modules
                  .filter((m: any) => !m.parentModuleId)
                  .sort((a, b) => parseInt(a.order) - parseInt(b.order))
                  .map(m => m.id)
                }
                strategy={verticalListSortingStrategy}
              >
                {modules
                  .filter((m: any) => !m.parentModuleId)
                  .slice()
                  .sort((a, b) => parseInt(a.order) - parseInt(b.order))
                  .map((module) => (
                    <SortableModuleItem
                      key={module.id}
                      id={module.id}
                      module={module}
                      modules={modules}
                      isExpanded={expandedModules.has(module.id)}
                      onToggle={() => toggleModule(module.id)}
                      currentModuleId={currentModuleId}
                      currentBlockId={currentBlockId}
                      onAddLesson={onAddLesson}
                    />
                  ))
                }
              </SortableContext>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No modules yet
              </div>
            )}
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="opacity-60">
                <ModuleItem
                  module={modules?.find(m => m.id === activeId)!}
                  modules={modules || []}
                  isExpanded={false}
                  onToggle={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  );
}
