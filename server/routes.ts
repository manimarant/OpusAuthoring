import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import fs from "fs/promises";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { db } from "./db";
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
  aiGenerateVideoSchema,
  ltiPlatforms,
  ltiStates,
  type AiGenerateQuizRequest,
  type CourseWithContent,
  type MediaAssetType,
} from "@shared/schema";
import { z } from "zod";
import { generateText, generateQuiz, generateAssignment, checkRateLimit, generateCourseOutline, generateChapterImagePrompt, generateImagePromptsForOutline, generateCompleteChapterImage, generateVideoWithTavus, generateVideoPrompt, generateCompleteVideo, tavusFetch } from "./ai-service";
import { refreshStockImageCatalog, getStockImageCatalog } from "./stock-images";
import { createScormPackage } from "./scorm-service";
import { getUploadsDir } from "./app";
import {
  clearAuthCookie,
  defaultPassword,
  ensureDefaultUsers,
  getAuthenticatedUser,
  hashPassword,
  requireAuth,
  setAuthCookie,
  toAuthUser,
  verifyPassword,
} from "./auth";
import * as jose from "jose";
import { nanoid } from "nanoid";
import fetch from "node-fetch";

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

async function persistGeneratedImage(imageUrl: string): Promise<string> {
  if (!imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return imageUrl;
  }

  const [, mimeType, base64Data] = match;
  const extension = mimeType.split("/")[1] || "png";
  const uploadsDir = path.join(getUploadsDir(), "generated-images");
  await fs.mkdir(uploadsDir, { recursive: true });

  const filename = `generated-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const filepath = path.join(uploadsDir, filename);
  await fs.writeFile(filepath, Buffer.from(base64Data, "base64"));

  return `/api/uploads/generated-images/${filename}`;
}

async function persistGeneratedAudio(audioBuffer: Buffer, extension = "mp3"): Promise<string> {
  const uploadsDir = path.join(getUploadsDir(), "generated-audio");
  await fs.mkdir(uploadsDir, { recursive: true });

  const filename = `generated-audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const filepath = path.join(uploadsDir, filename);
  await fs.writeFile(filepath, audioBuffer);

  return `/api/uploads/generated-audio/${filename}`;
}

async function buildSourceMaterialFromReferenceFiles(courseId: string): Promise<string> {
  const files = await storage.getReferenceFilesByCourseId(courseId);
  if (files.length === 0) {
    return "";
  }

  const sourceSections: string[] = [
    `Uploaded source files:\n${files.map((file) => `- ${file.originalName} (${file.mimetype})`).join("\n")}`,
  ];

  for (const file of files) {
    const isPlainText =
      file.mimetype.startsWith("text/") ||
      file.originalName.toLowerCase().endsWith(".txt") ||
      file.originalName.toLowerCase().endsWith(".md");

    if (!isPlainText) {
      continue;
    }

    try {
      const filePath = path.join(getUploadsDir(), file.filename);
      const rawText = await fs.readFile(filePath, "utf8");
      const normalizedText = rawText.replace(/\s+/g, " ").trim();
      if (!normalizedText) {
        continue;
      }

      sourceSections.push(
        `Content from ${file.originalName}:\n${normalizedText.slice(0, 20000)}`
      );
    } catch (error) {
      console.warn(`Failed to read uploaded source file ${file.originalName}:`, error);
    }
  }

  return sourceSections.join("\n\n");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function replaceCourseOutline(courseId: string, outline: any, options?: { createChapterBlocks?: boolean }) {
  const existingModules = await storage.getModulesByCourseId(courseId);
  if (existingModules.length > 0) {
    for (const module of existingModules) {
      await storage.deleteModule(module.id);
    }
  }

  const createdModules = [];
  let globalOrder = 0;

  for (const outlineModule of outline.modules || []) {
    const parentModule = await storage.createModule({
      courseId,
      title: outlineModule.title,
      description: outlineModule.learning_objective || "",
      order: (globalOrder++).toString(),
      lessonType: "block",
    });

    await storage.createContentBlock({
      moduleId: parentModule.id,
      type: "text",
      content: {
        text: "",
      },
      order: "0",
      blockStyle: "default",
      styling: {},
      accessibility: {},
    });

    createdModules.push(parentModule);

    if (outlineModule.chapters && outlineModule.chapters.length > 0) {
      for (const chapter of outlineModule.chapters) {
        const chapterModule = await storage.createModule({
          courseId,
          parentModuleId: parentModule.id,
          title: chapter.title,
          description: chapter.description || "",
          order: (globalOrder++).toString(),
          lessonType: "block",
        });

        if (options?.createChapterBlocks) {
          await storage.createContentBlock({
            moduleId: chapterModule.id,
            type: "text",
            content: {
              text: chapter.description || "",
            },
            order: "0",
            blockStyle: "default",
            styling: {},
            accessibility: {},
          });
        }

        createdModules.push(chapterModule);
      }
    }
  }

  return createdModules;
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function clampNarrationToFifteenSeconds(value: string): string {
  const maxWordCount = 34;
  return stripHtmlTags(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWordCount)
    .join(" ")
    .trim();
}

async function generateKeyPair() {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', { extractable: true });
  const publicJwk = await jose.exportJWK(publicKey);
  const privateJwk = await jose.exportJWK(privateKey);
  
  // Add kid to JWK
  const kid = nanoid();
  publicJwk.kid = kid;
  privateJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  return {
    publicKey: JSON.stringify(publicJwk),
    privateKey: JSON.stringify(privateJwk),
    kid
  };
}

async function generateElevenLabsAudio(text: string): Promise<{ audioUrl: string; duration: string; voiceId: string; modelId: string; script: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ElevenLabs API key not configured");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";
  const script = clampNarrationToFifteenSeconds(text);

  if (!script) {
    throw new Error("Generated audio script was empty");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script,
      model_id: modelId,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const audioUrl = await persistGeneratedAudio(audioBuffer, "mp3");

  return {
    audioUrl,
    duration: "0:15",
    voiceId,
    modelId,
    script,
  };
}

function getAppUrl(req: express.Request): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  
  // Try to determine from request headers (standard way for proxies like Vercel)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  if (host) {
    return `${protocol}://${host}`;
  }

  // Fallback for Vercel
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Default fallback to registered domain
  return `https://opus-authoring.vercel.app`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureDefaultUsers();
  const isSecureCookie = app.get("env") === "production";

  // Serve uploaded files statically
  const uploadsPath = getUploadsDir();
  app.use('/uploads', express.static(uploadsPath));
  app.use('/api/uploads', express.static(uploadsPath));

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      return res.json({
        user: toAuthUser(user),
        defaultPassword,
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to get authenticated user" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      setAuthCookie(res, user.id, isSecureCookie);
      return res.json({
        user: toAuthUser(user),
      });
    } catch (error) {
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    clearAuthCookie(res, isSecureCookie);
    return res.status(204).end();
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      const user = res.locals.user;

      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      if (user.username.toLowerCase() === "guest") {
        return res.status(403).json({ message: "Guest password cannot be changed" });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }

      if (!verifyPassword(currentPassword, user.password)) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long" });
      }

      if (newPassword === currentPassword) {
        return res.status(400).json({ message: "New password must be different from the current password" });
      }

      const updatedUser = await storage.updateUserPassword(user.id, hashPassword(newPassword));
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        user: toAuthUser(updatedUser),
      });
    } catch (error) {
      return res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) {
      return next();
    }

    const publicApiPrefixes = ["/api/auth", "/api/lti", "/api/uploads"];
    if (publicApiPrefixes.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }

    return requireAuth(req, res, next);
  });
  
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

        const createdModules = await replaceCourseOutline(courseId, outline);

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

app.post("/api/courses/:id/generate-outline-from-files", async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await storage.getCourse(courseId);
        if (!course) {
            return res.status(404).json({
                message: "Course not found"
            });
        }

        const referenceFiles = await storage.getReferenceFilesByCourseId(courseId);
        if (referenceFiles.length === 0) {
            return res.status(400).json({
                message: "No uploaded files found for this course"
            });
        }

        const sourceMaterial = await buildSourceMaterialFromReferenceFiles(courseId);
        const outline = await generateCourseOutline({
            title: course.title,
            topic: course.topic,
            learningObjectives: course.learningObjectives,
            sourceMaterial,
        });
        const outlineMeta = outline?._meta ?? { source: "unknown" };

        await storage.updateCourse(courseId, {
            title: outline.title || course.title,
            learningObjectives: Array.isArray(outline.course_objectives) && outline.course_objectives.length > 0
                ? outline.course_objectives.join("\n")
                : course.learningObjectives,
        });

        const createdModules = await replaceCourseOutline(courseId, outline, { createChapterBlocks: true });

        res.setHeader("X-Outline-Source", String(outlineMeta.source || "unknown"));
        if (outlineMeta.reason) {
            res.setHeader("X-Outline-Fallback-Reason", String(outlineMeta.reason).slice(0, 200));
        }

        res.json({
            modules: createdModules,
            outlineMeta,
        });
    } catch (error) {
        console.error("Failed to generate course outline from uploaded files:", error);
        res.status(500).json({
            message: "Failed to generate course outline from uploaded files",
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

        const generatedImage = await generateCompleteChapterImage(
            course.title,
            undefined,
            {
                title: course.title,
                topic: course.topic,
                objectives: course.learningObjectives,
            },
            "1792x1024",
            {
                sourceText: course.learningObjectives,
                preferredStyle: "editorial educational cover illustration",
                allowFallback: true,
            }
        );
        const imageUrl = await persistGeneratedImage(generatedImage.imageUrl);

        await storage.updateCourse(courseId, {
            coverImage: imageUrl
        });

        console.log(`Generated cover image for course "${course.title}"`, {
            aiGenerated: generatedImage.isAIGenerated,
            prompt: generatedImage.imagePrompt,
            style: generatedImage.suggestedStyle,
        });

        res.json({
            imageUrl,
            imageInfo: {
                description: generatedImage.visualBrief,
                prompt: generatedImage.imagePrompt,
                style: generatedImage.suggestedStyle,
                aiGenerated: generatedImage.isAIGenerated,
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

        if (contentBlockData.type === "ai-image") {
            const content = (contentBlockData.content || {}) as Record<string, any>;
            const currentUrl = String(content.url || "");
            const shouldGenerateImage = !currentUrl || currentUrl.includes("picsum.photos");

            if (shouldGenerateImage) {
                const module = await storage.getModule(req.params.moduleId);
                if (module) {
                    let courseContext: { title: string; topic: string; objectives: string } | undefined;
                    try {
                        const course = await storage.getCourse(module.courseId);
                        if (course) {
                            courseContext = {
                                title: course.title,
                                topic: course.topic,
                                objectives: course.learningObjectives,
                            };
                        }
                    } catch (contextError) {
                        console.warn("Failed to fetch course context for ai-image block:", contextError);
                    }

                    const generatedImage = await generateCompleteChapterImage(
                        module.title,
                        undefined,
                        courseContext,
                        "1792x1024",
                        { allowFallback: false }
                    );

                    const persistedImageUrl = await persistGeneratedImage(generatedImage.imageUrl);
                    contentBlockData.content = {
                        ...content,
                        url: persistedImageUrl,
                        alt: content.alt || module.title,
                        caption: content.caption || generatedImage.visualBrief || module.title,
                        imagePrompt: generatedImage.imagePrompt,
                        suggestedStyle: generatedImage.suggestedStyle,
                        isGenerated: true,
                    };
                }
            }
        }

        // If it's an ai-text block, generate AI content automatically if none provided
        if (contentBlockData.type === 'ai-text') {
            const providedContent = contentBlockData.content as any;
            // Check if content is actually provided and not just an empty placeholder from the client
            const hasContent = providedContent && 
                              ((providedContent.text && providedContent.text.trim().length > 0) || 
                               (providedContent.html && providedContent.html.replace(/<[^>]*>/g, '').trim().length > 0));

            if (!hasContent) {
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
                                prompt: `Generate educational content for a lesson module titled "${module.title}". Provide a clear, engaging explanation of the core concepts in this section. Keep it concise but informative (2-3 paragraphs).`,
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

                            // Generate relevant content for the module
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
        }

        // If it's an ai-audio block, generate AI audio content automatically
        if (contentBlockData.type === 'ai-audio') {
            const audioContent = contentBlockData.content && typeof contentBlockData.content === "object" && !Array.isArray(contentBlockData.content)
                ? contentBlockData.content as { url?: string; script?: string }
                : undefined;
            const hasProvidedAudio = Boolean(audioContent?.url && !String(audioContent.url).startsWith("#") && audioContent?.script);

            if (!hasProvidedAudio) {
                const module = await storage.getModule(req.params.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
                        try {
                            const chapterSummary = stripHtmlTags(String(module.description || ""));
                            const aiRequest = {
                                moduleId: req.params.moduleId,
                                provider: 'gemini' as const,
                                type: 'explanation' as const,
                                prompt: `Write a spoken lesson narration for the chapter titled "${module.title}". ${chapterSummary ? `Chapter summary: ${chapterSummary}. ` : ""}Keep it under 35 words so the audio stays within 15 seconds. Use a concise educational tone and focus only on the most important takeaway.`,
                                length: 'short' as const,
                                style: {
                                    tone: 'friendly' as const,
                                    readingLevel: 'intermediate' as const
                                },
                                includeCourseContext: true
                            };

                            const courseContext = {
                                title: course.title,
                                topic: course.topic,
                                objectives: course.learningObjectives
                            };

                            const aiResult = await generateText(aiRequest, courseContext);
                            const generatedAudio = await generateElevenLabsAudio(aiResult.text);
                            contentBlockData.content = {
                                title: `Audio: ${module.title}`,
                                description: "AI-generated audio narration",
                                script: generatedAudio.script,
                                url: generatedAudio.audioUrl,
                                duration: generatedAudio.duration,
                                voiceId: generatedAudio.voiceId,
                                modelId: generatedAudio.modelId,
                                isGenerated: true
                            };

                        } catch (aiError) {
                            console.error('Failed to generate AI audio content:', aiError);
                            // Continue with default content if AI generation fails
                            contentBlockData.content = {
                                title: "AI Generated Audio",
                                description: "Audio narration generation failed",
                                script: "",
                                url: "#",
                                duration: "",
                                isGenerated: false
                            };
                        }
                    }
                }
            }
        }

        // If it's a quiz block (AI or regular), initialize quiz content
        if (contentBlockData.type === 'ai-quiz' || contentBlockData.type === 'quiz') {
            const quizContent = contentBlockData.content && typeof contentBlockData.content === "object" && !Array.isArray(contentBlockData.content)
                ? contentBlockData.content as { questions?: unknown[] }
                : undefined;
            if (contentBlockData.type === 'ai-quiz' && (!quizContent?.questions || quizContent.questions.length === 0)) {
                const module = await storage.getModule(req.params.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
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

                            // Generate quiz questions automatically
                            const quizResult = await generateQuiz(quizRequest, courseContext);

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
                        contentBlockData.content = {
                            title: "",
                            description: "",
                            questions: [],
                            isGenerated: false
                        };
                    }
                } else {
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
                contentBlockData.content = {
                    title: "",
                    description: "",
                    questions: [],
                    isGenerated: false
                };
            } else {
                // AI quiz with questions already provided - keep them
            }
        }

        // If it's an assignment block (AI or regular), initialize assignment content
        if (contentBlockData.type === 'ai-assignment' || contentBlockData.type === 'assignment') {
            const assignmentContent = contentBlockData.content && typeof contentBlockData.content === "object" && !Array.isArray(contentBlockData.content)
                ? contentBlockData.content as { tasks?: unknown[] }
                : undefined;
            if (contentBlockData.type === 'ai-assignment' && (!assignmentContent?.tasks || assignmentContent.tasks.length === 0)) {
                const module = await storage.getModule(req.params.moduleId);
                if (module) {
                    const course = await storage.getCourse(module.courseId);
                    if (course) {
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

                            // Generate assignment automatically
                            const assignmentResult = await generateAssignment(assignmentRequest, courseContext);

                            // Set the generated assignment as default content
                            contentBlockData.content = {
                                ...assignmentResult.assignment,
                                isGenerated: true
                            };
                        } catch (assignmentError) {
                            // Assignment generation failed, continue with empty content
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
            }
        }

        const contentBlock = await storage.createContentBlock(contentBlockData);
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
        res.json(contentBlock);
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch content block"
        });
    }
});

app.put("/api/content-blocks/:id", async (req, res) => {
    try {
        const updates = insertContentBlockSchema.partial().parse(req.body);
        const contentBlock = await storage.updateContentBlock(req.params.id, updates);
        if (!contentBlock) {
            return res.status(404).json({
                message: "Content block not found"
            });
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

// AI Image Generation endpoint
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

        const result = await generateCompleteChapterImage(prompt, undefined, undefined, "1792x1024");
        res.json({
            url: result.imageUrl,
            imagePrompt: result.imagePrompt,
            suggestedStyle: result.suggestedStyle,
            isAIGenerated: result.isAIGenerated,
            model: "black-forest-labs/FLUX.1-schnell"
        });
    } catch (error) {
        console.error("Failed to generate image:", error);
        res.status(500).json({
            message: "Failed to generate image"
        });
    }
});

// AI Complete Chapter Image Generation
app.post("/api/ai/generate-chapter-image", async (req, res) => {
    try {
        const {
            chapterTitle,
            moduleTitle,
            courseId,
            size = "1024x1024",
            allowFallback = true
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

        console.log(`Generating image for chapter: "${chapterTitle}"`);
        console.log(`Requested size: ${size}`);
        
        const result = await generateCompleteChapterImage(
            chapterTitle,
            moduleTitle,
            courseContext,
            size as "1024x1024" | "1024x1792" | "1792x1024",
            { allowFallback }
        );

        const persistedImageUrl = await persistGeneratedImage(result.imageUrl);

        if (result.isAIGenerated) {
            console.log("Hugging Face FLUX.1-schnell image generated successfully");
        } else if (allowFallback) {
            console.log("Using contextual placeholder image");
        }

        res.json({
            ...result,
            imageUrl: persistedImageUrl
        });
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
        const requestData = aiGenerateTextSchema.parse(req.body);

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

        const result = await generateText(requestData, courseContext);
        const generatedAudio = await generateElevenLabsAudio(result.text);
        res.json({
            script: generatedAudio.script,
            audioUrl: generatedAudio.audioUrl,
            duration: generatedAudio.duration,
            voiceId: generatedAudio.voiceId,
            provider: result.provider,
            model: result.model,
            audioModel: generatedAudio.modelId,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to generate audio content",
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// AI Content Generation endpoint
app.post("/api/ai/generate-text", async (req, res) => {
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
        const requestData = aiGenerateTextSchema.parse(req.body);

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
        const result = await generateText(requestData, courseContext);

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

// AI Video Generation endpoint
app.post("/api/ai/generate-video", async (req, res) => {
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
        const requestData = aiGenerateVideoSchema.parse(req.body);

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
                console.warn("Failed to get course context for video generation:", contextError);
            }
        }

        // Generate video
        const result = await generateVideoWithTavus(requestData, courseContext);

        res.json({
            videoUrl: result.videoUrl,
            videoId: result.videoId,
            prompt: result.prompt,
            duration: result.duration,
            status: result.status,
            isAIGenerated: result.isAIGenerated
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
            } else if (error.message.includes("Invalid") && error.message.includes("API key")) {
                res.status(401).json({
                    message: "Video generation service configuration error"
                });
            } else if (error.message.includes("Insufficient credits")) {
                res.status(402).json({
                    message: error.message
                });
            } else if (error.message.includes("service is temporarily unavailable") || error.message.includes("timed out")) {
                res.status(503).json({
                    message: error.message
                });
            } else {
                console.error("AI video generation error:", error);
                res.status(500).json({
                    message: "Failed to generate video",
                    error: error.message
                });
            }
        } else {
            console.error("AI video generation error:", error);
            res.status(500).json({
                message: "Failed to generate video"
            });
        }
    }
});

// Video generation status endpoint
app.get("/api/ai/video-status/:videoId", async (req, res) => {
    try {
        const { videoId } = req.params;
        const tavusApiKey = process.env.TAVUS_API_KEY;
        
        if (!tavusApiKey) {
            return res.status(503).json({
                message: "Video generation service not configured"
            });
        }

        const response = await tavusFetch(`https://tavusapi.com/v2/videos/${videoId}`, {
            headers: {
                'x-api-key': tavusApiKey,
            },
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get video status: ${response.status}`);
        }
        
        const statusData: any = asRecord(await response.json());
        const normalizedStatus =
            statusData.status === "ready"
                ? "completed"
                : statusData.status === "error"
                  ? "failed"
                  : statusData.status;
        const progressParts =
            typeof statusData.generation_progress === "string"
                ? statusData.generation_progress.split("/").map((value: string) => Number(value))
                : null;
        const progress =
            progressParts && progressParts.length === 2 && progressParts.every((value: number) => Number.isFinite(value)) && progressParts[1] > 0
                ? Math.round((progressParts[0] / progressParts[1]) * 100)
                : statusData.progress || 0;
        
        res.json({
            videoId,
            status: normalizedStatus,
            videoUrl: statusData.download_url || statusData.hosted_url,
            progress,
            error: statusData.error_message || statusData.status_details
        });
        
    } catch (error) {
        console.error("Failed to get video status:", error);
        res.status(500).json({
            message: "Failed to get video status",
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// Generate complete video with enhanced prompting
app.post("/api/modules/:moduleId/generate-complete-video", async (req, res) => {
    try {
        const { moduleId } = req.params;
        const {
            chapterTitle,
            moduleTitle,
            sourceText,
            duration = 'medium',
            style = 'educational',
            voiceType = 'neutral',
            aspectRatio = '16:9'
        } = req.body;

        if (!chapterTitle) {
            return res.status(400).json({
                message: "Chapter title is required"
            });
        }

        // Rate limiting check
        const clientId = req.ip || 'unknown';
        const rateLimit = checkRateLimit(clientId);

        if (!rateLimit.allowed) {
            return res.status(429).json({
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: rateLimit.retryAfter
            });
        }

        // Get course context
        let courseContext;
        try {
            const module = await storage.getModule(moduleId);
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
            console.warn("Failed to get course context for complete video generation:", contextError);
        }

        // Generate complete video
        const result = await generateCompleteVideo(
            chapterTitle,
            moduleTitle,
            courseContext,
            {
                sourceText,
                duration,
                style,
                voiceType,
                aspectRatio
            }
        );

        res.json(result);

    } catch (error) {
        console.error("Failed to generate complete video:", error);
        if (error instanceof Error) {
            if (error.message.includes("Rate limit exceeded")) {
                res.status(429).json({ message: error.message });
            } else if (error.message.includes("Invalid") && error.message.includes("API key")) {
                res.status(401).json({ message: "Video generation service configuration error" });
            } else if (error.message.includes("Insufficient credits")) {
                res.status(402).json({ message: error.message });
            } else if (error.message.includes("timed out")) {
                res.status(503).json({ message: error.message });
            } else {
                res.status(500).json({
                    message: "Failed to generate complete video",
                    error: error.message
                });
            }
        } else {
            res.status(500).json({ message: "Failed to generate complete video" });
        }
    }
  });

  // LTI 1.3 Endpoints
  app.post("/api/courses/:courseId/publish/lti-registration", async (req, res) => {
    try {
      const { name, issuer, clientId, deploymentId, authLoginUrl, authTokenUrl, keysetUrl } = req.body;
      
      // Generate key pair for this platform
      const { publicKey, privateKey } = await generateKeyPair();
      
      const platform = await storage.createLtiPlatform({
        name,
        issuer,
        clientId,
        deploymentId,
        authLoginUrl,
        authTokenUrl,
        keysetUrl,
        publicKey,
        privateKey
      });
      
      res.status(201).json(platform);
    } catch (error) {
      console.error("LTI Registration failed:", error);
      res.status(500).json({ message: "Failed to register LTI platform" });
    }
  });

  app.get("/api/lti/platforms", async (req, res) => {
    // This is a simplified version, ideally you'd have some auth here
    try {
      // In a real app, you'd filter by user or have an admin check
      // For this demo, we'll return all (but storage doesn't have listAll yet, so we'll just return empty or implement it)
      res.json([]); 
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch platforms" });
    }
  });

  // LTI 1.3 OIDC Login Initiation
  app.all(["/api/lti/login", "/api/lti/login/"], async (req, res) => {
    try {
      const { iss, login_hint, target_link_uri, lti_message_hint, client_id } = { ...req.query, ...req.body };
      
      if (!iss || !login_hint || !target_link_uri) {
        return res.status(400).send("Missing required parameters for LTI login");
      }

      const platform = await storage.getLtiPlatformByIssuer(iss as string, (client_id as string) || "");
      if (!platform) {
        console.error(`LTI Login error: Platform not registered for issuer=${iss} and clientId=${client_id}`);
        return res.status(404).send(`LTI Platform not registered for issuer=${iss}`);
      }

      // Create state for CSRF protection
      const state = nanoid();
      const nonce = nanoid();
      
      // Store state/nonce in DB for verification during launch
      await storage.createLtiState(state, nonce);
      
      const appUrl = getAppUrl(req);
      const authUrl = new URL(platform.authLoginUrl);
      authUrl.searchParams.append("scope", "openid");
      authUrl.searchParams.append("response_type", "id_token");
      authUrl.searchParams.append("client_id", platform.clientId);
      authUrl.searchParams.append("redirect_uri", `${appUrl}/api/lti/launch`);
      authUrl.searchParams.append("login_hint", login_hint as string);
      authUrl.searchParams.append("state", state);
      authUrl.searchParams.append("nonce", nonce);
      authUrl.searchParams.append("prompt", "none");
      authUrl.searchParams.append("response_mode", "form_post");
      authUrl.searchParams.append("target_link_uri", target_link_uri as string);
      
      if (lti_message_hint) {
        authUrl.searchParams.append("lti_message_hint", lti_message_hint as string);
      }

      res.redirect(303, authUrl.toString());
    } catch (error) {
      console.error("LTI OIDC Login failed:", error);
      res.status(500).send("Internal Server Error during LTI Login");
    }
  });

  // LTI 1.3 Launch endpoint
  app.all(["/api/lti/launch", "/api/lti/launch/"], async (req, res) => {
    try {
      const { id_token, state } = { ...req.query, ...req.body };
      
      if (!id_token || !state) {
        console.error("LTI Launch error: Missing parameters", { hasToken: !!id_token, hasState: !!state });
        return res.status(400).send("Missing id_token or state");
      }

      // Verify state and get nonce
      const stateData = await storage.verifyLtiState(state);
      if (!stateData) {
        console.error("LTI Launch error: Invalid or expired state");
        return res.status(400).send("Invalid or expired LTI state (session timeout)");
      }

      // Decode token to get issuer and kid
      const payload = jose.decodeJwt(id_token) as any;
      
      const iss = payload.iss;
      const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
      
      console.log(`LTI Launch initiated: iss=${iss}, aud=${aud}`);

      const platform = await storage.getLtiPlatformByIssuer(iss, aud);
      if (!platform) {
        console.error(`LTI Launch error: Platform not found for iss=${iss}, aud=${aud}`);
        return res.status(404).send("LTI Platform not found. Please ensure the tool is registered in both Moodle and this application.");
      }

      // Verify signature and nonce
      const JWKS = jose.createRemoteJWKSet(new URL(platform.keysetUrl));
      const { payload: verifiedPayload } = await jose.jwtVerify(id_token, JWKS, {
        issuer: platform.issuer,
        audience: platform.clientId,
      });

      // Verify nonce
      if (verifiedPayload.nonce !== stateData.nonce) {
        console.error("LTI Launch error: Nonce mismatch");
        return res.status(400).send("LTI Security verification failed: Nonce mismatch");
      }

      console.log("LTI Launch verified successfully");

      // Extract course ID
      const customParams = (verifiedPayload as any)["https://purl.imsglobal.org/spec/lti/claim/custom"] || {};
      const targetLinkUri = (verifiedPayload as any).target_link_uri;
      
      let courseId = customParams.course_id || customParams.courseid || customParams.id;
      
      if (!courseId && targetLinkUri) {
        const courseIdMatch = targetLinkUri.match(/\/courses\/([^\/]+)/);
        courseId = courseIdMatch ? courseIdMatch[1] : null;
      }

      if (!courseId) {
        console.error("LTI Launch error: Could not determine course ID", { customParams, targetLinkUri });
        return res.status(400).send("Could not determine course ID from launch. Please set 'course_id=...' in Custom Parameters in Moodle.");
      }

      // Find the first module to redirect to
      const modules = await storage.getModulesByCourseId(courseId);
      const appUrl = getAppUrl(req);

      if (modules && modules.length > 0) {
        // If it's a chapter-based course, we might want the first child module
        const firstModule = modules[0];
        // Try to find a child if it's a parent module
        const childModules = modules.filter(m => m.parentModuleId === firstModule.id);
        const targetModuleId = childModules.length > 0 ? childModules[0].id : firstModule.id;
        
        console.log(`Redirecting to module content: /module/${targetModuleId}/content`);
        res.redirect(303, `${appUrl}/module/${targetModuleId}/content`);
      } else {
        console.log(`No modules found, redirecting to course setup: /course-setup?id=${courseId}`);
        res.redirect(303, `${appUrl}/course-setup?id=${courseId}`);
      }
    } catch (error) {
      console.error("LTI Launch failed:", error);
      res.status(500).send("LTI Launch verification failed: " + (error instanceof Error ? error.message : String(error)));
    }
  });

  // JWKS endpoint for public keys
  app.get(["/api/lti/jwks", "/api/lti/jwks/"], async (req, res) => {
    try {
      const platforms = await db.select().from(ltiPlatforms);
      if (platforms.length === 0) {
        return res.json({ keys: [] });
      }
      
      const keys = platforms.map(p => JSON.parse(p.publicKey));
      res.json({ keys });
    } catch (error) {
      res.status(500).json({ message: "Failed to serve JWKS" });
    }
  });

  // Debug route for LTI
  app.all("/api/lti/*", (req, res) => {
    console.log(`Unmatched LTI request: ${req.method} ${req.path}`);
    res.status(404).send(`LTI Route not found: ${req.method} ${req.path}`);
  });

  const httpServer = createServer(app);
return httpServer;
}
