import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { GraduationCap, ChartLine, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CourseWithProgress } from "@shared/schema";
import { useState, useEffect, useRef } from "react";

export default function MyCourses() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [courseToDelete, setCourseToDelete] = useState<CourseWithProgress | null>(null);
  const coverGenerationInFlightRef = useRef<Set<string>>(new Set());
  
  const { data: courses, isLoading } = useQuery<CourseWithProgress[]>({
    queryKey: ["/api/courses"],
  });

  // Function to generate cover image for a course
  const generateCoverImage = async (courseId: string, _courseTitle: string) => {
    try {
      await apiRequest("POST", `/api/courses/${courseId}/generate-cover-image`);
      // Refresh the courses list to show the new image
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
    } catch (error) {
      console.error(`Failed to generate cover image for course ${courseId}:`, error);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await apiRequest("DELETE", `/api/courses/${courseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({
        title: "Course deleted",
        description: "The course has been successfully deleted.",
      });
      setCourseToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete the course. Please try again.",
        variant: "destructive",
      });
    },
  });

  const repairLaunchMutation = useMutation({
    mutationFn: async (course: CourseWithProgress) => {
      const endpoint = course.referenceFileCount && course.referenceFileCount > 0
        ? `/api/courses/${course.id}/generate-outline-from-files`
        : `/api/courses/${course.id}/generate-outline`;
      const response = await apiRequest("POST", endpoint);
      const payload = await response.json();
      return { course, payload };
    },
    onSuccess: async ({ payload }) => {
      const modules = Array.isArray(payload?.modules) ? payload.modules : [];
      const topLevelModules = modules
        .filter((module: any) => !module.parentModuleId)
        .sort((a: any, b: any) => parseInt(a.order) - parseInt(b.order));
      const firstParentModule = topLevelModules[0];
      const firstChapterModule = modules
        .filter((module: any) => module.parentModuleId === firstParentModule?.id)
        .sort((a: any, b: any) => parseInt(a.order) - parseInt(b.order))[0];
      const launchModule = firstChapterModule || firstParentModule;

      await queryClient.invalidateQueries({ queryKey: ["/api/courses"] });

      if (!launchModule?.id) {
        toast({
          title: "Launch unavailable",
          description: "The course outline was generated, but no launchable lesson was created.",
          variant: "destructive",
        });
        return;
      }

      setLocation(`/module/${launchModule.id}/content`);
    },
    onError: (error) => {
      toast({
        title: "Launch failed",
        description: error instanceof Error ? error.message : "Failed to prepare this course for launch.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!courses?.length) {
      return;
    }

    for (const course of courses) {
      if (course.coverImage || coverGenerationInFlightRef.current.has(course.id)) {
        continue;
      }

      coverGenerationInFlightRef.current.add(course.id);
      generateCoverImage(course.id, course.title).finally(() => {
        coverGenerationInFlightRef.current.delete(course.id);
      });
    }
  }, [courses]);


  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" data-testid="text-my-courses-title">
            My Courses
          </h1>
          <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground" data-testid="text-my-courses-description">
            Manage and edit your created courses
          </p>
        </div>
        <Link href="/course-setup" data-testid="link-create-new-course">
          <Button
            size="lg"
            variant="ai"
            className="h-12 rounded-full px-6 shadow-[0_14px_30px_rgba(139,92,246,0.24)]"
            data-testid="button-create-new-course"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Create New Course
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid justify-center gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" data-testid="card-courses-container">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="mx-auto flex h-full min-h-[332px] w-full max-w-[248px] flex-col overflow-hidden rounded-[22px] border border-black/8 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] animate-pulse dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_16px_36px_rgba(0,0,0,0.22)]"
              data-testid={`skeleton-course-${i}`}
            >
              <div className="aspect-[5/3] bg-muted" />
              <div className="flex flex-1 flex-col justify-between space-y-4 px-6 py-6">
                <div className="h-5 w-2/3 rounded-full bg-muted" />
                <div className="h-4 w-2/3 rounded-full bg-muted" />
                <div className="h-4 w-1/3 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid justify-center gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" data-testid="card-courses-container">
          {courses.map((course, index) => {
            const launchUrl = course.firstModuleId
              ? course.firstContentBlockId
                ? `/module/${course.firstModuleId}/content/${course.firstContentBlockId}`
                : `/module/${course.firstModuleId}/content`
              : `/my-courses`;
            const requiresRepair = !course.firstModuleId;
            const isRepairingCourse = repairLaunchMutation.isPending && repairLaunchMutation.variables?.id === course.id;
            const cardClassName = "flex h-full min-h-[332px] w-full flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white text-left shadow-[0_12px_32px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_38px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-zinc-950 dark:shadow-[0_16px_36px_rgba(0,0,0,0.26)]";
            const cardContent = (
              <>
                <div className="relative aspect-[5/3] overflow-hidden bg-[linear-gradient(160deg,#eef4ff_0%,#f8fafc_52%,#ffffff_100%)] dark:bg-[linear-gradient(160deg,#111827_0%,#0f172a_52%,#020617_100%)]">
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {index % 2 === 0 ? (
                        <GraduationCap className="h-12 w-12 text-slate-500 dark:text-slate-300" strokeWidth={1.5} />
                      ) : (
                        <ChartLine className="h-12 w-12 text-slate-500 dark:text-slate-300" strokeWidth={1.5} />
                      )}
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/22 via-black/8 to-transparent" />
                  <div className="absolute left-3 top-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                        course.status === "published"
                          ? "bg-emerald-500/90 text-white"
                          : "bg-white/88 text-slate-700 backdrop-blur-sm dark:bg-black/55 dark:text-slate-100"
                      }`}
                      data-testid={`status-course-${course.id}`}
                    >
                      {course.status === "published" ? "Published" : "Draft"}
                    </span>
                  </div>
                  {requiresRepair && (
                    <div className="absolute bottom-3 left-3">
                      <span className="inline-flex items-center rounded-full bg-slate-900/78 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-sm dark:bg-white/14">
                        {isRepairingCourse ? "Preparing" : "Generate Outline"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between px-6 pb-6 pt-5">
                  <div className="space-y-2.5">
                    <h3
                      className="min-h-[69px] line-clamp-3 text-[17px] font-semibold leading-[1.35] tracking-[-0.02em] text-slate-900 dark:text-slate-50"
                      data-testid={`text-course-title-${course.id}`}
                    >
                      {course.title}
                    </h3>
                    <p
                      className="line-clamp-3 min-h-[66px] text-[13px] leading-5 text-slate-500 dark:text-slate-400"
                      data-testid={`text-course-audience-${course.id}`}
                    >
                      {course.targetAudience ? `For ${course.targetAudience}` : "Audience details to be defined"}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-200/80 pt-3 text-[12px] text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <span className="uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Updated</span>
                    <span data-testid={`text-course-updated-${course.id}`}>
                      {new Date(course.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </>
            );

            return (
              <div
                key={course.id}
                className="group relative mx-auto w-full max-w-[248px]"
                data-testid={`card-course-${course.id}`}
              >
                {requiresRepair ? (
                  <button
                    type="button"
                    onClick={() => repairLaunchMutation.mutate(course)}
                    disabled={isRepairingCourse}
                    className={`${cardClassName} disabled:cursor-wait disabled:opacity-70`}
                  >
                    {cardContent}
                  </button>
                ) : (
                  <Link
                    href={launchUrl}
                    className={cardClassName}
                  >
                    {cardContent}
                  </Link>
                )}

                <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/94 text-slate-600 shadow-sm backdrop-blur-sm transition-colors duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/15 dark:bg-black/55 dark:text-slate-200 dark:hover:border-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCourseToDelete(course);
                    }}
                    data-testid={`button-delete-course-${course.id}`}
                    aria-label="Delete course"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="flex min-h-[380px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50/70 px-8 py-16 text-center dark:border-white/12 dark:bg-white/[0.02]"
          data-testid="card-courses-container"
        >
          <GraduationCap className="mb-5 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 text-xl font-semibold" data-testid="text-no-courses-title">No courses yet</h3>
          <p className="mb-6 max-w-md text-[15px] leading-7 text-muted-foreground" data-testid="text-no-courses-description">
            Get started by creating your first course with AI assistance.
          </p>
          <Link href="/course-setup" data-testid="link-create-first-course">
            <Button data-testid="button-create-first-course" variant="ai" className="rounded-full px-6">
              <Sparkles className="mr-2 h-4 w-4" />
              Create Your First Course
            </Button>
          </Link>
        </div>
      )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-course">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">Delete Course</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Are you sure you want to delete "{courseToDelete?.title}"? This action cannot be undone and will permanently remove the course and all its content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => courseToDelete && deleteMutation.mutate(courseToDelete.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

