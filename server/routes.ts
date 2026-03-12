import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { 
  insertCourseSchema, 
  insertModuleSchema, 
  insertContentBlockSchema, 
  insertCourseThemeSchema,
  insertMediaAssetSchema,
  insertQuestionBankSchema,
  insertQuizQuestionSchema,
  insertBlockTemplateSchema,
  aiGenerateTextSchema,
  aiGenerateQuizSchema,
  aiGenerateAssignmentSchema,
  type AiGenerateQuizRequest,
  type CourseWithContent,
  type MediaAssetType,
} from "@shared/schema";
import { z } from "zod";
import { generateText, generateQuiz, generateAssignment, checkRateLimit, generateCourseOutline, generateChapterImagePrompt, generateImagePromptsForOutline, generateCompleteChapterImage } from "./ai-service";
import { selectStockImage, refreshStockImageCatalog, getStockImageCatalog } from "./stock-images";
import { createScormPackage } from "./scorm-service";

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

const mediaUpload = multer({
  dest: 'uploads/', // Save to disk instead of memory
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for media
  },
  fileFilter: (req, file, cb) => {
    // Allow images, audio, and video files
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, audio, and video files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files statically
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));
  
  // Course routes
  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      const courseData = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(courseData);
      res.status(201).json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid course data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create course" });
      }
    }
  });

  app.put("/api/courses/:id", async (req, res) => {
    try {
      const updates = insertCourseSchema.partial().parse(req.body);
      const course = await storage.updateCourse(req.params.id, updates);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid course data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update course" });
      }
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCourse(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to delete course",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Course Publishing
  app.post("/api/courses/:courseId/publish/package", async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const course = await storage.getCourseWithContent(courseId);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const zipBuffer = await createScormPackage(course);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${course.title.replace(/ /g, "_")}.zip"`
      );
      res.send(zipBuffer);
    } catch (error) {
      console.error("Failed to package course:", error);
      res.status(500).json({ message: "Failed to package course" });
    }
  });

  app.post("/api/courses/:courseId/publish/direct", async (req, res) => {
    try {
      const courseId = req.params.courseId;
      // TODO: Implement direct publishing logic
      res.status(501).json({ message: "Direct publishing not implemented yet" });
    } catch (error) {
      res.status(500).json({ message: "Failed to publish course directly" });
    }
  });

  // AI Course Outline Generation
app.post("/api/courses/:id/generate-outline", async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await storage.getCourse(courseId);
        if (!course) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        // Check if modules already exist and delete them first
        const existingModules = await storage.getModulesByCourseId(courseId);
        if (existingModules && existingModules.length > 0) {
            // Delete existing modules to replace them
            for (const module of existingModules) {
                await storage.deleteModule(module.id);
            }
        }

        // Generate course outline using AI
        const outline = await generateCourseOutline(course);
        const outlineMeta = outline?._meta ?? { source: "unknown" };
        console.log("Course outline generation result:", {
            courseId,
            courseTitle: course.title,
            source: outlineMeta.source,
            reason: outlineMeta.reason,
            attempts: outlineMeta.attempts,
            model: outlineMeta.model,
        });

        // Update course title with AI-generated title
        await storage.updateCourse(courseId, {
            title: outline.title
        });

        // Create modules and chapters from the generated outline
        // Structure: Course -> Modules -> Chapters (where chapters are also stored as modules)
        // Chapters will NOT have content blocks as per requirement
        const createdModules = [];
        let globalOrder = 0;

        // Process each module from the AI outline
        for (const outlineModule of outline.modules || []) {
            // Create the parent module (e.g., "MODULE 1: Foundations of Quantum Mechanics")
            const parentModule = await storage.createModule({
                courseId,
                title: outlineModule.title,
                description: outlineModule.learning_objective || "",
                order: (globalOrder++).toString(),
                lessonType: "block", // Parent module type
            });

            // Create a default content block for the parent module
            await storage.createContentBlock({
                moduleId: parentModule.id,
                type: "text",
                content: {
                    text: ""
                },
                order: "0",
                blockStyle: "default",
                styling: {},
                accessibility: {}
            });

            createdModules.push(parentModule);

            // Create chapters under this module (stored as separate module records with parentModuleId)
            // Chapters do NOT get content blocks
            if (outlineModule.chapters && outlineModule.chapters.length > 0) {
                for (const chapter of outlineModule.chapters) {
                    const chapterModule = await storage.createModule({
                        courseId,
                        parentModuleId: parentModule.id, // Link chapter to parent module
                        title: chapter.title,
                        description: chapter.description || "",
                        order: (globalOrder++).toString(), // Use global order to keep chapters after their parent
                        lessonType: "block", // Chapter type
                    });

                    // DO NOT create content blocks for chapters as per requirement
                    // Chapters should be empty placeholders

                    createdModules.push(chapterModule);
                }
            }
        }

        res.setHeader("X-Outline-Source", String(outlineMeta.source || "unknown"));
        if (outlineMeta.reason) {
            res.setHeader("X-Outline-Fallback-Reason", String(outlineMeta.reason).slice(0, 200));
        }

        res.json({
            modules: createdModules,
            outlineMeta,
        });
    } catch (error) {
        console.error("Failed to generate course outline:", error);
        res.status(500).json({
            message: "Failed to generate course outline",
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

app.post("/api/courses/:id/generate-cover-image", async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await storage.getCourse(courseId);
        if (!course) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        // Select appropriate stock image based on course title and topic
        const stockImage = selectStockImage(course.title, course.topic);
        const imageUrl = stockImage.url;

        // Update course with selected stock image
        await storage.updateCourse(courseId, {
            coverImage: imageUrl
        });

        console.log(`? Selected stock image for course "${course.title}": ${stockImage.description}`);

        res.json({
            imageUrl,
            imageInfo: {
                id: stockImage.id,
                description: stockImage.description,
                category: stockImage.category,
                keywords: stockImage.keywords
            }
        });
    } catch (error) {
        console.error("Failed to generate cover image:", error);
        res.status(500).json({
            message: "Failed to generate cover image"
        });
    }
});

// Stock Image Management
app.get("/api/stock-images", async (req, res) => {
    try {
        const catalog = getStockImageCatalog();
        res.json({
            total: catalog.length,
            images: catalog,
            categories: [...new Set(catalog.map(img => img.category))],
            formats: [...new Set(catalog.map(img => img.format))]
        });
    } catch (error) {
        console.error("Failed to get stock images:", error);
        res.status(500).json({
            message: "Failed to get stock images"
        });
    }
});

app.post("/api/stock-images/refresh", async (req, res) => {
    try {
        const catalog = refreshStockImageCatalog();
        res.json({
            message: "Stock image catalog refreshed successfully",
            total: catalog.length,
            categories: [...new Set(catalog.map(img => img.category))],
            formats: [...new Set(catalog.map(img => img.format))]
        });
    } catch (error) {
        console.error("Failed to refresh stock images:", error);
        res.status(500).json({
            message: "Failed to refresh stock images"
        });
    }
});

// Module routes
app.get("/api/courses/:courseId/modules", async (req, res) => {
    try {
        const modules = await storage.getModulesByCourseId(req.params.courseId);
        res.json(modules);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch modules"
        });
    }
});

app.get("/api/modules/:id", async (req, res) => {
    try {
        const module = await storage.getModule(req.params.id);
        if (!module) {
            return res.status(404).json({
                message: "Module not found"
            });
        }
        res.json(module);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch module"
        });
    }
});

app.post("/api/courses/:courseId/modules", async (req, res) => {
    try {
        const moduleData = insertModuleSchema.parse({
            ...req.body,
            courseId: req.params.courseId
        });
        const module = await storage.createModule(moduleData);

        res.status(201).json(module);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid module data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create module"
            });
        }
    }
});

app.post("/api/modules", async (req, res) => {
    try {
        const moduleData = insertModuleSchema.parse(req.body);
        const module = await storage.createModule(moduleData);

        // Ensure at least one chapter (content block) exists for a newly created module
        try {
            await storage.createContentBlock({
                moduleId: module.id,
                type: "text",
                content: {
                    text: ""
                },
                order: "0",
                blockStyle: "default",
                styling: {},
                accessibility: {}
            });
        } catch (e) {
            // If chapter creation fails, still return module; client can add blocks later
        }

        res.status(201).json(module);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid module data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create module"
            });
        }
    }
});

app.put("/api/modules/:id", async (req, res) => {
    try {
        const updates = insertModuleSchema.partial().parse(req.body);
        const module = await storage.updateModule(req.params.id, updates);
        if (!module) {
            return res.status(404).json({
                message: "Module not found"
            });
        }
        res.json(module);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid module data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update module"
            });
        }
    }
});

app.put("/api/courses/:courseId/modules/reorder", async (req, res) => {
    try {
        const {
            moduleIds
        } = req.body;
        if (!Array.isArray(moduleIds)) {
            return res.status(400).json({
                message: "moduleIds must be an array"
            });
        }

        await storage.reorderModules(req.params.courseId, moduleIds);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to reorder modules"
        });
    }
});

app.delete("/api/modules/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteModule(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Module not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete module"
        });
    }
});

// Content Block routes
app.get("/api/modules/:moduleId/content-blocks", async (req, res) => {
    try {
        const contentBlocks = await storage.getContentBlocksByModuleId(req.params.moduleId);
        res.json(contentBlocks);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch content blocks"
        });
    }
});

app.post("/api/modules/:moduleId/content-blocks", async (req, res) => {
    try {
        const contentBlockData = insertContentBlockSchema.parse({
            ...req.body,
            moduleId: req.params.moduleId
        });

        // If it's an ai-text block, generate AI content automatically
        if (contentBlockData.type === 'ai-text') {
            const module = await storage.getModule(req.params.moduleId);
            if (module) {
                const course = await storage.getCourse(module.courseId);
                if (course) {
                    try {
                        // Create a proper AI request object
                        const aiRequest = {
                            moduleId: req.params.moduleId,
                            provider: 'gemini' as const,
                            type: 'explanation' as const,
                            prompt: `Generate an introductory paragraph for a lesson module titled "${module.title}". This should provide a clear, engaging introduction that explains what the learner will discover in this section. Keep it concise but informative (2-3 paragraphs).`,
                            length: 'medium' as const,
                            style: {
                                tone: 'friendly' as const,
                                readingLevel: 'intermediate' as const
                            },
                            includeCourseContext: false
                        };

                        const courseContext = {
                            title: course.title,
                            topic: course.topic,
                            objectives: course.learningObjectives
                        };

                        // Generate relevant introductory content for the module
                        const aiResult = await generateText(aiRequest, courseContext);

                        // Set the generated text as default content for ai-text blocks
                        contentBlockData.content = {
                            text: aiResult.text.replace(/<[^>]*>/g, ''), // Plain text version
                            html: `<p>${aiResult.text}</p>` // HTML version
                        };
                    } catch (aiError) {
                        // Continue with empty content if AI generation fails
                        contentBlockData.content = contentBlockData.content || {};
                    }
                }
            }
        }

        // If it's an ai-audio block, generate AI audio content automatically
        if (contentBlockData.type === 'ai-audio') {
            const module = await storage.getModule(req.params.moduleId);
            if (module) {
                const course = await storage.getCourse(module.courseId);
                if (course) {
                    try {
                        // Generate audio script using AI
                        const aiRequest = {
                            moduleId: req.params.moduleId,
                            provider: 'gemini' as const,
                            type: 'explanation' as const,
                            prompt: `Create a concise audio script (2-3 minutes) for a lesson module titled "${module.title}". This should be engaging narration that explains key concepts in a conversational tone. Include natural pauses and transitions.`,
                            length: 'medium' as const,
                            style: {
                                tone: 'friendly' as const,
                                readingLevel: 'intermediate' as const
                            },
                            includeCourseContext: false
                        };

                        const courseContext = {
                            title: course.title,
                            topic: course.topic,
                            objectives: course.learningObjectives
                        };

                        // Generate audio script
                        const aiResult = await generateText(aiRequest, courseContext);

                        // For now, we'll store the script and a placeholder audio URL
                        // In a real implementation, you'd convert the text to speech here
                        contentBlockData.content = {
                            title: `Audio: ${module.title}`,
                            description: "AI-generated audio narration",
                            script: aiResult.text,
                            url: `#audio-placeholder-${Date.now()}`, // Placeholder URL
                            duration: "2:30", // Estimated duration
                            isGenerated: true
                        };

                        console.log("? AI Audio content generated successfully");
                    } catch (aiError) {
                        console.error('Failed to generate AI audio content:', aiError);
                        // Continue with default content if AI generation fails
                        contentBlockData.content = {
                            title: "AI Generated Audio",
                            description: "Audio narration generated by AI",
                            script: "",
                            url: "#",
                            duration: "",
                            isGenerated: false
                        };
                    }
                }
            }
        }

        // If it's an ai-image block, generate image URL
        if (contentBlockData.type === 'ai-image') {
            try {
                const prompt = (contentBlockData as any).content?.prompt || "Illustration related to the lesson";
                const url = await mockGenerateImage(prompt, undefined, prompt);
                contentBlockData.content = {
                    url,
                    caption: (contentBlockData as any).content?.caption || "",
                    alt: (contentBlockData as any).content?.alt || ""
                };
            } catch {
                contentBlockData.content = contentBlockData.content || {};
            }
        }

        // If it's a quiz block (AI or regular), initialize quiz content
        if (contentBlockData.type === 'ai-quiz' || contentBlockData.type === 'quiz') {
            const quizContent = contentBlockData.content && typeof contentBlockData.content === "object" && !Array.isArray(contentBlockData.content)
                ? contentBlockData.content as { questions?: unknown[] }
                : undefined;
            if (contentBlockData.type === 'ai-quiz' && (!quizContent?.questions || quizContent.questions.length === 0)) {
                console.log("?? Auto-generating quiz questions for AI Quiz block...");
                const module = await storage.getModule(req.params.moduleId);
                if (module) {
                    console.log("?? Module found:", module.title);
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        console.log("?? Course found:", course.title);
                        try {
                            // Create a quiz generation request based on module content
                            const quizRequest: AiGenerateQuizRequest = {
                                moduleId: req.params.moduleId,
                                provider: 'gemini' as const,
                                prompt: `Create quiz questions for this lesson content. The lesson is part of a course about "${course.topic}" with learning objectives: "${course.learningObjectives}". Generate questions that test understanding of the key concepts covered in this lesson.`,
                                questionCount: 3,
                                difficulty: 'medium' as const,
                                questionTypes: ['multiple-choice', 'true-false'],
                                includeCourseContext: true
                            };

                            const courseContext = {
                                title: course.title,
                                topic: course.topic,
                                objectives: course.learningObjectives
                            };

                            console.log("?? Generating quiz with AI...");
                            // Generate quiz questions automatically
                            const quizResult = await generateQuiz(quizRequest, courseContext);
                            console.log("? Quiz generated successfully:", quizResult.questions.length, "questions");

                            // Set the generated quiz as default content without a title
                            contentBlockData.content = {
                                title: "",
                                description: "Test your understanding of the content",
                                questions: quizResult.questions,
                                isGenerated: true
                            };
                        } catch (quizError) {
                            // Quiz generation failed, continue with empty content
                            // Continue with empty structure if AI generation fails
                            contentBlockData.content = {
                                title: "",
                                description: "",
                                questions: [],
                                isGenerated: false
                            };
                        }
                    } else {
                        console.log("? Course not found for module");
                        contentBlockData.content = {
                            title: "",
                            description: "",
                            questions: [],
                            isGenerated: false
                        };
                    }
                } else {
                    console.log("? Module not found");
                    // Fallback if module not found
                    contentBlockData.content = {
                        title: "",
                        description: "",
                        questions: [],
                        isGenerated: false
                    };
                }
            } else if (contentBlockData.type === 'quiz') {
                // Regular quiz block - initialize with empty structure
                console.log("?? Initializing regular quiz block...");
                contentBlockData.content = {
                    title: "",
                    description: "",
                    questions: [],
                    isGenerated: false
                };
            } else {
                // AI quiz with questions already provided - keep them
                console.log("? AI Quiz block already has questions, skipping generation");
            }
        }

        // If it's an assignment block (AI or regular), initialize assignment content
        if (contentBlockData.type === 'ai-assignment' || contentBlockData.type === 'assignment') {
            const assignmentContent = contentBlockData.content && typeof contentBlockData.content === "object" && !Array.isArray(contentBlockData.content)
                ? contentBlockData.content as { tasks?: unknown[] }
                : undefined;
            if (contentBlockData.type === 'ai-assignment' && (!assignmentContent?.tasks || assignmentContent.tasks.length === 0)) {
                console.log("?? Auto-generating assignment for AI Assignment block...");
                const module = await storage.getModule(req.params.moduleId);
                if (module) {
                    console.log("?? Module found:", module.title);
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        console.log("?? Course found:", course.title);
                        try {
                            // Create an assignment generation request based on module content
                            const assignmentRequest = {
                                prompt: `Create an assignment for this lesson module titled "${module.title}". The lesson is part of a course about "${course.topic}" with learning objectives: "${course.learningObjectives}". Design an assignment that helps students apply the concepts from this lesson.`,
                                difficulty: 'medium' as const,
                                taskCount: 3,
                                assignmentType: 'project' as const,
                                includeRubric: true
                            };

                            const courseContext = {
                                title: course.title,
                                topic: course.topic,
                                objectives: course.learningObjectives
                            };

                            console.log("?? Generating assignment with AI...");
                            // Generate assignment automatically
                            const assignmentResult = await generateAssignment(assignmentRequest, courseContext);
                            console.log("? Assignment generated successfully");

                            // Set the generated assignment as default content
                            contentBlockData.content = {
                                ...assignmentResult.assignment,
                                isGenerated: true
                            };
                        } catch (assignmentError) {
                            // Assignment generation failed, continue with empty content
                            console.error("? Assignment generation failed:", assignmentError);
                            contentBlockData.content = {
                                title: "",
                                objectives: [],
                                description: "",
                                tasks: [],
                                submissionGuidelines: {
                                    format: "",
                                    deadline: "",
                                    instructions: ""
                                },
                                rubric: [],
                                resources: [],
                                tips: [],
                                isGenerated: false
                            };
                        }
                    } else {
                        console.log("? Course not found for module");
                        contentBlockData.content = {
                            title: "",
                            objectives: [],
                            description: "",
                            tasks: [],
                            submissionGuidelines: {
                                format: "",
                                deadline: "",
                                instructions: ""
                            },
                            rubric: [],
                            resources: [],
                            tips: [],
                            isGenerated: false
                        };
                    }
                } else {
                    console.log("? Module not found");
                    // Fallback if module not found
                    contentBlockData.content = {
                        title: "",
                        objectives: [],
                        description: "",
                        tasks: [],
                        submissionGuidelines: {
                            format: "",
                            deadline: "",
                            instructions: ""
                        },
                        rubric: [],
                        resources: [],
                        tips: [],
                        isGenerated: false
                    };
                }
            } else if (contentBlockData.type === 'assignment') {
                // Regular assignment block - initialize with empty structure
                console.log("?? Initializing regular assignment block...");
                contentBlockData.content = {
                    title: "",
                    objectives: [],
                    description: "",
                    tasks: [],
                    submissionGuidelines: {
                        format: "",
                        deadline: "",
                        instructions: ""
                    },
                    rubric: [],
                    resources: [],
                    tips: [],
                    isGenerated: false
                };
            } else {
                // AI assignment with content already provided - keep it
                console.log("? AI Assignment block already has content, skipping generation");
            }
        }

        console.log("?? Saving content block with data:", JSON.stringify(contentBlockData, null, 2));
        const contentBlock = await storage.createContentBlock(contentBlockData);
        console.log("? Content block created:", contentBlock.id, "type:", contentBlock.type, "content:", JSON.stringify(contentBlock.content, null, 2));
        res.status(201).json(contentBlock);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid content block data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create content block"
            });
        }
    }
});

app.get("/api/content-blocks/:id", async (req, res) => {
    try {
        const contentBlock = await storage.getContentBlock(req.params.id);
        if (!contentBlock) {
            return res.status(404).json({
                message: "Content block not found"
            });
        }
        console.log("?? Retrieved content block:", contentBlock.id, "type:", contentBlock.type, "content:", JSON.stringify(contentBlock.content, null, 2));
        res.json(contentBlock);
    } catch (error) {
        console.error("? Error fetching content block:", error);
        res.status(500).json({
            message: "Failed to fetch content block"
        });
    }
});

app.put("/api/content-blocks/:id", async (req, res) => {
    try {
        const updates = insertContentBlockSchema.partial().parse(req.body);
        if (updates.order !== undefined) {
            console.log(`[DRAG] Updating block ${req.params.id.substring(0, 8)} order to "${updates.order}"`);
        }
        const contentBlock = await storage.updateContentBlock(req.params.id, updates);
        if (!contentBlock) {
            return res.status(404).json({
                message: "Content block not found"
            });
        }
        if (updates.order !== undefined) {
            console.log(`[DRAG] Block ${req.params.id.substring(0, 8)} now has order="${contentBlock.order}"`);
        }
        res.json(contentBlock);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid content block data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update content block"
            });
        }
    }
});

app.delete("/api/content-blocks/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteContentBlock(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Content block not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete content block"
        });
    }
});

// File upload routes
app.post("/api/courses/:courseId/upload", upload.array('files'), async (req, res) => {
    try {
        if (!req.files || !Array.isArray(req.files)) {
            return res.status(400).json({
                message: "No files uploaded"
            });
        }

        const courseId = req.params.courseId;
        const course = await storage.getCourse(courseId);
        if (!course) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        const uploadedFiles = [];
        for (const file of req.files) {
            const referenceFile = await storage.createReferenceFile({
                courseId,
                filename: file.filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size.toString()
            });
            uploadedFiles.push(referenceFile);
        }

        res.status(201).json(uploadedFiles);
    } catch (error) {
        res.status(500).json({
            message: "Failed to upload files"
        });
    }
});

// Media Asset Upload route
app.post("/api/courses/:courseId/media-upload", (req, res, next) => {
    console.log("Initial req.body before Multer:", req.body); // Added log
    console.log("Received media upload request.");
    mediaUpload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error("Multer error during media upload:", err);
            return res.status(400).json({
                message: err.message
            });
        } else if (err) {
            console.error("Unknown error during media upload:", err);
            return res.status(500).json({
                message: err.message
            });
        }
        console.log("Multer processed file. req.file:", req.file);
        if (req.file) {
            console.log("Uploaded file mimetype:", req.file.mimetype);
        }
        // Everything went fine.
        next();
    });
}, async (req, res) => {
    try {
        console.log("Entering media upload route handler.");
        if (!req.file) {
            console.error("No file uploaded in handler.");
            return res.status(400).json({
                message: "No file uploaded"
            });
        }

        const courseId = req.params.courseId;
        const course = await storage.getCourse(courseId);
        if (!course) {
            console.error("Course not found for media upload:", courseId);
            return res.status(404).json({
                message: "Course not found"
            });
        }

        const {
            originalname,
            mimetype,
            size,
            filename
        } = req.file;
        const assetType = req.body.assetType as MediaAssetType; // Get assetType from form data
        console.log("AssetType from request body:", assetType);

        if (!assetType || !['image', 'audio', 'video'].includes(assetType)) {
            console.error("Invalid or missing assetType:", assetType);
            return res.status(400).json({
                message: "Invalid or missing assetType"
            });
        }

        const mediaAsset = await storage.createMediaAsset({
            courseId,
            filename,
            originalName: originalname,
            mimetype,
            size: size.toString(),
            assetType,
            metadata: {}
        });

        console.log("Media asset created successfully:", mediaAsset);
        res.status(201).json(mediaAsset);
    } catch (error) {
        console.error("Failed to upload media asset in handler:", error);
        res.status(500).json({
            message: "Failed to upload media asset"
        });
    }
});

app.get("/api/courses/:courseId/files", async (req, res) => {
    try {
        const files = await storage.getReferenceFilesByCourseId(req.params.courseId);
        res.json(files);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch files"
        });
    }
});

app.delete("/api/reference-files/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteReferenceFile(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Reference file not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete reference file"
        });
    }
});

// AI Content Generation (mock endpoints removed - using real OpenAI integration)

// AI Image Generation endpoint (uses Gemini API)
app.post("/api/ai/generate-image", async (req, res) => {
    try {
        const {
            prompt
        } = req.body as {
            prompt: string
        };
        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                message: "Prompt is required"
            });
        }

        const {
            imagePrompt,
            suggestedStyle
        } = await generateChapterImagePrompt(prompt);
        res.json({
            imagePrompt,
            suggestedStyle,
            note: "This is an AI-generated image prompt. Use with image generation services."
        });
    } catch (error) {
        console.error("Failed to generate image:", error);
        res.status(500).json({
            message: "Failed to generate image"
        });
    }
});

// AI Complete Chapter Image Generation (generates actual images with DALL-E or contextual placeholders)
app.post("/api/ai/generate-chapter-image", async (req, res) => {
    try {
        const {
            chapterTitle,
            moduleTitle,
            courseId,
            size = "1024x1024"
        } = req.body;

        if (!chapterTitle || typeof chapterTitle !== "string") {
            return res.status(400).json({
                message: "Chapter title is required"
            });
        }

        // Validate size parameter
        const validSizes = ["1024x1024", "1024x1792", "1792x1024"];
        if (!validSizes.includes(size)) {
            return res.status(400).json({
                message: `Invalid size. Must be one of: ${validSizes.join(", ")}`
            });
        }

        // Get course context if courseId provided
        let courseContext;
        if (courseId) {
            try {
                const course = await storage.getCourse(courseId);
                if (course) {
                    courseContext = {
                        title: course.title,
                        topic: course.topic,
                        objectives: course.learningObjectives
                    };
                }
            } catch (contextError) {
                console.warn("Failed to fetch course context:", contextError);
            }
        }

        console.log(`?? Generating image for chapter: "${chapterTitle}"`);
        console.log(`?? Requested size: ${size}`);
        
        // Generate complete image (prompt + actual image or contextual placeholder)
        const result = await generateCompleteChapterImage(
            chapterTitle,
            moduleTitle,
            courseContext,
            size as "1024x1024" | "1024x1792" | "1792x1024"
        );

        // Log result for debugging
        if (result.isAIGenerated) {
            console.log("? Real DALL-E image generated successfully");
        } else {
            console.log("??  Using contextual placeholder image");
        }

        res.json(result);
    } catch (error) {
        console.error("Failed to generate chapter image:", error);
        res.status(500).json({
            message: "Failed to generate chapter image",
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// Course Theme routes
app.get("/api/course-themes", async (req, res) => {
    try {
        const themes = await storage.getCourseThemes();
        res.json(themes);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch course themes"
        });
    }
});

app.get("/api/course-themes/:id", async (req, res) => {
    try {
        const theme = await storage.getCourseTheme(req.params.id);
        if (!theme) {
            return res.status(404).json({
                message: "Course theme not found"
            });
        }
        res.json(theme);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch course theme"
        });
    }
});

app.post("/api/course-themes", async (req, res) => {
    try {
        const themeData = insertCourseThemeSchema.parse(req.body);
        const theme = await storage.createCourseTheme(themeData);
        res.status(201).json(theme);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid theme data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create course theme"
            });
        }
    }
});

app.put("/api/course-themes/:id", async (req, res) => {
    try {
        const updates = insertCourseThemeSchema.partial().parse(req.body);
        const theme = await storage.updateCourseTheme(req.params.id, updates);
        if (!theme) {
            return res.status(404).json({
                message: "Course theme not found"
            });
        }
        res.json(theme);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid theme data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update course theme"
            });
        }
    }
});

app.delete("/api/course-themes/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteCourseTheme(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Course theme not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete course theme"
        });
    }
});

// Media Asset routes
app.get("/api/courses/:courseId/media-assets", async (req, res) => {
    try {
        const assets = await storage.getMediaAssetsByCourseId(req.params.courseId);
        res.json(assets);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch media assets"
        });
    }
});

app.get("/api/media-assets/:id", async (req, res) => {
    try {
        const asset = await storage.getMediaAsset(req.params.id);
        if (!asset) {
            return res.status(404).json({
                message: "Media asset not found"
            });
        }
        res.json(asset);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch media asset"
        });
    }
});

app.post("/api/courses/:courseId/media-assets", async (req, res) => {
    try {
        const assetData = insertMediaAssetSchema.parse({
            ...req.body,
            courseId: req.params.courseId
        });
        const asset = await storage.createMediaAsset(assetData);
        res.status(201).json(asset);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid media asset data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create media asset"
            });
        }
    }
});

app.put("/api/media-assets/:id", async (req, res) => {
    try {
        const updates = insertMediaAssetSchema.partial().parse(req.body);
        const asset = await storage.updateMediaAsset(req.params.id, updates);
        if (!asset) {
            return res.status(404).json({
                message: "Media asset not found"
            });
        }
        res.json(asset);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid media asset data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update media asset"
            });
        }
    }
});

app.delete("/api/media-assets/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteMediaAsset(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Media asset not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete media asset"
        });
    }
});

// Question Bank routes
app.get("/api/courses/:courseId/question-banks", async (req, res) => {
    try {
        const banks = await storage.getQuestionBanksByCourseId(req.params.courseId);
        res.json(banks);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch question banks"
        });
    }
});

app.get("/api/question-banks/:id", async (req, res) => {
    try {
        const bank = await storage.getQuestionBank(req.params.id);
        if (!bank) {
            return res.status(404).json({
                message: "Question bank not found"
            });
        }
        res.json(bank);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch question bank"
        });
    }
});

app.post("/api/courses/:courseId/question-banks", async (req, res) => {
    try {
        const bankData = insertQuestionBankSchema.parse({
            ...req.body,
            courseId: req.params.courseId
        });
        const bank = await storage.createQuestionBank(bankData);
        res.status(201).json(bank);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid question bank data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create question bank"
            });
        }
    }
});

app.put("/api/question-banks/:id", async (req, res) => {
    try {
        const updates = insertQuestionBankSchema.partial().parse(req.body);
        const bank = await storage.updateQuestionBank(req.params.id, updates);
        if (!bank) {
            return res.status(404).json({
                message: "Question bank not found"
            });
        }
        res.json(bank);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid question bank data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update question bank"
            });
        }
    }
});

app.delete("/api/question-banks/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteQuestionBank(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Question bank not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete question bank"
        });
    }
});

// Quiz Question routes
app.get("/api/question-banks/:bankId/questions", async (req, res) => {
    try {
        const questions = await storage.getQuizQuestionsByBankId(req.params.bankId);
        res.json(questions);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch quiz questions"
        });
    }
});

app.get("/api/modules/:moduleId/quiz-questions", async (req, res) => {
    try {
        const questions = await storage.getQuizQuestionsByModuleId(req.params.moduleId);
        res.json(questions);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch quiz questions"
        });
    }
});

app.get("/api/quiz-questions/:id", async (req, res) => {
    try {
        const question = await storage.getQuizQuestion(req.params.id);
        if (!question) {
            return res.status(404).json({
                message: "Quiz question not found"
            });
        }
        res.json(question);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch quiz question"
        });
    }
});

app.post("/api/quiz-questions", async (req, res) => {
    try {
        const questionData = insertQuizQuestionSchema.parse(req.body);
        const question = await storage.createQuizQuestion(questionData);
        res.status(201).json(question);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid quiz question data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create quiz question"
            });
        }
    }
});

app.put("/api/quiz-questions/:id", async (req, res) => {
    try {
        const updates = req.body; // Let storage layer handle validation
        const question = await storage.updateQuizQuestion(req.params.id, updates);
        if (!question) {
            return res.status(404).json({
                message: "Quiz question not found"
            });
        }
        res.json(question);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid quiz question data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update quiz question"
            });
        }
    }
});

app.delete("/api/quiz-questions/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteQuizQuestion(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Quiz question not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete quiz question"
        });
    }
});

// Block Template routes
app.get("/api/block-templates", async (req, res) => {
    try {
        const templates = await storage.getBlockTemplates();
        res.json(templates);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch block templates"
        });
    }
});

app.get("/api/block-templates/public", async (req, res) => {
    try {
        const templates = await storage.getPublicBlockTemplates();
        res.json(templates);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch public block templates"
        });
    }
});

app.get("/api/block-templates/:id", async (req, res) => {
    try {
        const template = await storage.getBlockTemplate(req.params.id);
        if (!template) {
            return res.status(404).json({
                message: "Block template not found"
            });
        }
        res.json(template);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch block template"
        });
    }
});

app.post("/api/block-templates", async (req, res) => {
    try {
        const templateData = insertBlockTemplateSchema.parse(req.body);
        const template = await storage.createBlockTemplate(templateData);
        res.status(201).json(template);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid block template data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to create block template"
            });
        }
    }
});

app.put("/api/block-templates/:id", async (req, res) => {
    try {
        const updates = insertBlockTemplateSchema.partial().parse(req.body);
        const template = await storage.updateBlockTemplate(req.params.id, updates);
        if (!template) {
            return res.status(404).json({
                message: "Block template not found"
            });
        }
        res.json(template);
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid block template data",
                errors: error.errors
            });
        } else {
            res.status(500).json({
                message: "Failed to update block template"
            });
        }
    }
});

app.delete("/api/block-templates/:id", async (req, res) => {
    try {
        const deleted = await storage.deleteBlockTemplate(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                message: "Block template not found"
            });
        }
        res.status(204).send();
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete block template"
        });
    }
});

// AI Audio Generation endpoint
app.post("/api/ai/generate-audio", async (req, res) => {
    try {
        console.log("?? AI Generate Audio Request:", req.body);

        // Rate limiting check
        const clientId = req.ip || 'unknown';
        const rateLimit = checkRateLimit(clientId);

        if (!rateLimit.allowed) {
            console.log("?? Rate limit exceeded for client:", clientId);
            return res.status(429).json({
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: rateLimit.retryAfter
            });
        }

        // Validate request body
        const requestData = aiGenerateTextSchema.parse(req.body);
        console.log("? Validated audio request data:", requestData);

        // Get course context if requested
        let courseContext;
        if (requestData.includeCourseContext) {
            try {
                const module = await storage.getModule(requestData.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        courseContext = {
                            title: course.title,
                            topic: course.topic,
                            objectives: course.learningObjectives
                        };
                    }
                }
            } catch (contextError) {
                console.warn("Failed to fetch course context:", contextError);
            }
        }

        // Generate audio script
        console.log("?? Calling generateText for audio script with:", {
            requestData,
            courseContext
        });
        const result = await generateText(requestData, courseContext);
        console.log("? Generated audio script:", result);

        // For now, return the script with a placeholder audio URL
        // In a real implementation, you'd convert the script to audio here
        res.json({
            script: result.text,
            audioUrl: `#audio-placeholder-${Date.now()}`,
            duration: "2:30", // Estimated duration
            provider: result.provider,
            model: result.model
        });
    } catch (error) {
        console.error("?? AI Audio generation error:", error);
        res.status(500).json({
            message: "Failed to generate audio content",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// AI Content Generation endpoint
app.post("/api/ai/generate-text", async (req, res) => {
    try {
        console.log("?? AI Generate Text Request:", req.body);

        // Rate limiting check
        const clientId = req.ip || 'unknown';
        const rateLimit = checkRateLimit(clientId);

        if (!rateLimit.allowed) {
            console.log("?? Rate limit exceeded for client:", clientId);
            return res.status(429).json({
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: rateLimit.retryAfter
            });
        }

        // Validate request body
        const requestData = aiGenerateTextSchema.parse(req.body);
        console.log("? Validated request data:", requestData);

        // Get course context if requested
        let courseContext;
        if (requestData.includeCourseContext) {
            try {
                const module = await storage.getModule(requestData.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        courseContext = {
                            title: course.title,
                            topic: course.topic,
                            objectives: course.learningObjectives
                        };
                    }
                }
            } catch (contextError) {
                // Continue without context if there's an error fetching it
                console.warn("Failed to fetch course context:", contextError);
            }
        }

        // Generate content
        console.log("?? Calling generateText with:", {
            requestData,
            courseContext
        });
        const result = await generateText(requestData, courseContext);
        console.log("? Generated result:", result);

        res.json({
            text: result.text,
            provider: result.provider,
            model: result.model,
            tokensUsed: result.tokensUsed
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid request data",
                errors: error.errors
            });
        } else if (error instanceof Error) {
            if (error.message.includes("Rate limit exceeded")) {
                res.status(429).json({
                    message: error.message
                });
            } else if (error.message.includes("Invalid API key")) {
                res.status(401).json({
                    message: "AI service configuration error"
                });
            } else if (error.message.includes("service is temporarily unavailable")) {
                res.status(503).json({
                    message: error.message
                });
            } else {
                console.error("AI generation error:", error);
                res.status(500).json({
                    message: "Failed to generate content"
                });
            }
        } else {
            console.error("AI generation error:", error);
            res.status(500).json({
                message: "Failed to generate content"
            });
        }
    }
});

// AI Chapter Image Prompt Generation endpoint
app.post("/api/ai/generate-chapter-image-prompt", async (req, res) => {
    try {
        const {
            chapterTitle,
            moduleTitle,
            courseId
        } = req.body;

        if (!chapterTitle || typeof chapterTitle !== "string") {
            return res.status(400).json({
                message: "Chapter title is required"
            });
        }

        // Get course context if courseId is provided
        let courseContext;
        if (courseId) {
            try {
                const course = await storage.getCourse(courseId);
                if (course) {
                    courseContext = {
                        title: course.title,
                        topic: course.topic,
                        objectives: course.learningObjectives
                    };
                }
            } catch (contextError) {
                console.warn("Failed to fetch course context:", contextError);
            }
        }

        // Generate image prompt
        const result = await generateChapterImagePrompt(chapterTitle, moduleTitle, courseContext);

        res.json(result);
    } catch (error) {
        console.error("Failed to generate chapter image prompt:", error);
        res.status(500).json({
            message: "Failed to generate image prompt",
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// AI Quiz Generation endpoint
app.post("/api/ai/generate-quiz", async (req, res) => {
    try {
        // Rate limiting check
        const clientId = req.ip || 'unknown';
        const rateLimit = checkRateLimit(clientId);

        if (!rateLimit.allowed) {
            return res.status(429).json({
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: rateLimit.retryAfter
            });
        }

        // Validate request body
        const requestData = aiGenerateQuizSchema.parse(req.body);

        // Get course context if requested
        let courseContext;
        if (requestData.includeCourseContext) {
            try {
                const module = await storage.getModule(requestData.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        courseContext = {
                            title: course.title,
                            topic: course.topic,
                            objectives: course.learningObjectives
                        };
                    }
                }
            } catch (contextError) {
                // Continue without context if there's an error fetching it
            }
        }

        // Generate quiz
        const result = await generateQuiz(requestData, courseContext);

        res.json({
            questions: result.questions,
            description: result.description,
            provider: result.provider,
            model: result.model,
            tokensUsed: result.tokensUsed
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid request data",
                errors: error.errors
            });
        } else if (error instanceof Error) {
            if (error.message.includes("Rate limit exceeded")) {
                res.status(429).json({
                    message: error.message
                });
            } else if (error.message.includes("Invalid API key")) {
                res.status(401).json({
                    message: "AI service configuration error"
                });
            } else if (error.message.includes("service is temporarily unavailable")) {
                res.status(503).json({
                    message: error.message
                });
            } else {
                console.error("AI quiz generation error:", error);
                res.status(500).json({
                    message: "Failed to generate quiz"
                });
            }
        } else {
            console.error("AI quiz generation error:", error);
            res.status(500).json({
                message: "Failed to generate quiz"
            });
        }
    }
});

// AI Assignment Generation endpoint
app.post("/api/ai/generate-assignment", async (req, res) => {
    try {
        // Rate limiting check
        const clientId = req.ip || 'unknown';
        const rateLimit = checkRateLimit(clientId);

        if (!rateLimit.allowed) {
            return res.status(429).json({
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: rateLimit.retryAfter
            });
        }

        // Validate request body
        const requestData = aiGenerateAssignmentSchema.parse(req.body);

        // Get course context if requested
        let courseContext;
        if (requestData.includeCourseContext) {
            try {
                const module = await storage.getModule(requestData.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        courseContext = {
                            title: course.title,
                            topic: course.topic,
                            objectives: course.learningObjectives
                        };
                    }
                }
            } catch (contextError) {
                // Continue without context if there's an error fetching it
            }
        }

        // Generate assignment
        const result = await generateAssignment({
            prompt: requestData.prompt,
            difficulty: requestData.difficulty,
            taskCount: requestData.taskCount,
            assignmentType: requestData.assignmentType,
            includeRubric: requestData.includeRubric
        }, courseContext);

        res.json({
            assignment: result.assignment,
            provider: result.provider,
            model: result.model,
            tokensUsed: result.tokensUsed
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Invalid request data",
                errors: error.errors
            });
        } else if (error instanceof Error) {
            if (error.message.includes("Rate limit exceeded")) {
                res.status(429).json({
                    message: error.message
                });
            } else if (error.message.includes("Invalid API key")) {
                res.status(401).json({
                    message: "AI service configuration error"
                });
            } else if (error.message.includes("service is temporarily unavailable")) {
                res.status(503).json({
                    message: error.message
                });
            } else {
                console.error("AI assignment generation error:", error);
                res.status(500).json({
                    message: "Failed to generate assignment"
                });
            }
        } else {
            console.error("AI assignment generation error:", error);
            res.status(500).json({
                message: "Failed to generate assignment"
            });
        }
    }
});

const httpServer = createServer(app);
return httpServer;
}



async function mockGenerateText(prompt: string, context ? : string): Promise < string > {
    // Mock text generation with relevant content
    const templates = [
        `This section covers the fundamental concepts of ${prompt}. Understanding these principles is crucial for building a strong foundation in the subject.`,
        `In this module, we'll explore ${prompt} through practical examples and real-world applications that demonstrate key concepts.`,
        `${prompt} represents an important aspect of this field. Let's examine how it relates to the broader context and why it matters.`
    ];

    return templates[Math.floor(Math.random() * templates.length)];
}

// Note: Image prompt generation uses Gemini API (FREE)
// To generate actual images, use the prompts with:
// - DALL-E (OpenAI) - ~$0.04/image
// - Stable Diffusion (local/free) - 100% free
// - Midjourney - subscription based
// - Vertex AI Imagen (Google Cloud) - ~$0.04/image

async function mockGenerateImage(prompt: string, style ? : string, seed ? : string): Promise < string > {
    // Returns placeholder - use the image prompt generation endpoints instead
    const imageId = seed || Math.floor(Math.random() * 1000);
    return `https://picsum.photos/seed/${imageId}/800/400`;
}

async function mockGenerateAudio(text: string, voice ? : string): Promise < string > {
    // Return a placeholder audio URL that would be replaced with actual AI-generated content
    const audioId = Math.floor(Math.random() * 1000);
    return `https://www.soundjay.com/misc/sounds/bell-ringing-${audioId}.wav`;
}
