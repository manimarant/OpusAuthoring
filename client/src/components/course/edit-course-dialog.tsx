import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import type { Course } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const editCourseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  learningObjectives: z.string().min(1, "Learning objectives are required"),
});

type EditCourseForm = z.infer<typeof editCourseSchema>;

interface EditCourseDialogProps {
  course?: Course;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCourseDialog({ course, open, onOpenChange }: EditCourseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<EditCourseForm>({
    resolver: zodResolver(editCourseSchema),
    defaultValues: {
      title: course?.title ?? "",
      topic: course?.topic ?? "",
      targetAudience: course?.targetAudience ?? "",
      learningObjectives: course?.learningObjectives ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      title: course?.title ?? "",
      topic: course?.topic ?? "",
      targetAudience: course?.targetAudience ?? "",
      learningObjectives: course?.learningObjectives ?? "",
    });
  }, [course, form]);

  const updateCourseMutation = useMutation({
    mutationFn: async (data: EditCourseForm) => {
      if (!course) {
        throw new Error("Course not loaded");
      }
      await apiRequest("PUT", `/api/courses/${course.id}`, data);
    },
    onSuccess: () => {
      if (!course) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/courses", course.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Course details updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update course details. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditCourseForm) => {
    if (!course) {
      return;
    }
    updateCourseMutation.mutate(data);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Course Details</AlertDialogTitle>
        </AlertDialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetAudience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="learningObjectives"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Learning Objectives</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction type="submit" disabled={updateCourseMutation.isPending}>
                {updateCourseMutation.isPending ? "Saving..." : "Save"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
