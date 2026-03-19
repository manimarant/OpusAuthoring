import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const courseThemes = pgTable("course_themes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  isDefault: text("is_default").default("false"), // true/false
  settings: jsonb("settings").$type<{
    layout?: 'sidebar' | 'topbar';
    colors?: {
      primary?: string;
      secondary?: string;
      background?: string;
      text?: string;
    };
    fonts?: {
      heading?: string;
      body?: string;
    };
    navigation?: {
      style?: 'modern' | 'classic';
      position?: 'left' | 'top';
    };
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  targetAudience: text("target_audience").notNull(),
  learningObjectives: text("learning_objectives").notNull(),
  duration: text("duration"),
  difficulty: text("difficulty"),
  referenceUrls: jsonb("reference_urls").$type<string[]>().default([]),
  status: text("status").notNull().default("draft"), // draft, published
  // Rise 360 features
  themeId: varchar("theme_id").references(() => courseThemes.id),
  coverImage: text("cover_image"),
  logo: text("logo"),
  navigationRestricted: text("navigation_restricted").default("false"), // true/false
  sidebarVisible: text("sidebar_visible").default("open"), // open, closed, hidden
  searchEnabled: text("search_enabled").default("true"), // true/false
  completionSettings: jsonb("completion_settings").$type<{
    trackingType?: 'lessons' | 'quiz' | 'time';
    passingScore?: number;
    allowReview?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id),
  parentModuleId: varchar("parent_module_id"), // For chapters under modules
  title: text("title").notNull(),
  description: text("description"),
  duration: text("duration"),
  order: text("order").notNull(),
  thumbnail: text("thumbnail"),
  // Rise 360 lesson features
  lessonType: text("lesson_type").notNull().default("block"), // block, quiz
  icon: text("icon").default("book"), // lesson icon identifier
  navigationSettings: jsonb("navigation_settings").$type<{
    allowSkip?: boolean;
    showProgress?: boolean;
    exitButtons?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contentBlocks = pgTable("content_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull().references(() => modules.id),
  type: text("type").notNull(), // text, statement, quote, list, image, gallery, video, audio, interactive, etc.
  blockStyle: text("block_style").default("default"), // style variant for the block type
  content: jsonb("content").notNull(), // block-specific content structure
  styling: jsonb("styling").$type<{
    backgroundColor?: string;
    padding?: 'S' | 'M' | 'L';
    borders?: boolean;
    shadows?: boolean;
    cornerRadius?: number;
    animation?: 'enabled' | 'disabled';
  }>().default({}),
  accessibility: jsonb("accessibility").$type<{
    altText?: string;
    ariaLabel?: string;
    screenReaderText?: string;
  }>().default({}),
  order: text("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const referenceFiles = pgTable("reference_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: text("size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").references(() => courses.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: text("size").notNull(),
  assetType: text("asset_type").notNull(), // image, video, audio, document
  metadata: jsonb("metadata").$type<{
    width?: number;
    height?: number;
    duration?: number;
    altText?: string;
    captions?: string;
  }>().default({}),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const questionBanks = pgTable("question_banks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quizQuestions = pgTable("quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionBankId: varchar("question_bank_id").references(() => questionBanks.id),
  moduleId: varchar("module_id").references(() => modules.id),
  type: text("type").notNull(), // multiple-choice, multiple-response, fill-blank, matching
  question: text("question").notNull(),
  options: jsonb("options").$type<{
    choices?: Array<{
      id: string;
      text: string;
      isCorrect: boolean;
      feedback?: string;
    }>;
    blanks?: Array<{
      id: string;
      correctAnswers: string[];
    }>;
    pairs?: Array<{
      id: string;
      left: string;
      right: string;
    }>;
  }>().default({}),
  explanation: text("explanation"),
  points: text("points").default("1"),
  order: text("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blockTemplates = pgTable("block_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  blockType: text("block_type").notNull(),
  templateData: jsonb("template_data").notNull(),
  isPublic: text("is_public").default("false"), // true/false
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCourseSchema = createInsertSchema(courses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  referenceUrls: z.array(z.string()).optional(),
});

export const insertModuleSchema = createInsertSchema(modules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentBlockSchema = createInsertSchema(contentBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReferenceFileSchema = createInsertSchema(referenceFiles).omit({
  id: true,
  uploadedAt: true,
});

// Rise 360 Insert Schemas
export const insertCourseThemeSchema = createInsertSchema(courseThemes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({
  id: true,
  uploadedAt: true,
});

export const insertQuestionBankSchema = createInsertSchema(questionBanks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).refine(
  (data) => {
    const hasBankId = !!data.questionBankId;
    const hasModuleId = !!data.moduleId;
    return hasBankId !== hasModuleId; // Exactly one should be true (XOR)
  },
  {
    message: "Quiz question must belong to either a question bank OR a module, not both or neither",
    path: ["questionBankId"], // Show error on questionBankId field
  }
);

export const insertBlockTemplateSchema = createInsertSchema(blockTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type Course = typeof courses.$inferSelect;
export type CourseWithProgress = Course & {
  firstModuleId?: string;
  firstContentBlockId?: string;
};
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertReferenceFile = z.infer<typeof insertReferenceFileSchema>;
export type ReferenceFile = typeof referenceFiles.$inferSelect;

// Rise 360 Types
export type InsertCourseTheme = z.infer<typeof insertCourseThemeSchema>;
export type CourseTheme = typeof courseThemes.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type MediaAssetType = "image" | "audio" | "video" | "document";
export type InsertQuestionBank = z.infer<typeof insertQuestionBankSchema>;
export type QuestionBank = typeof questionBanks.$inferSelect;
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertBlockTemplate = z.infer<typeof insertBlockTemplateSchema>;
export type BlockTemplate = typeof blockTemplates.$inferSelect;

// AI Generation schemas
export const aiGenerateTextSchema = z.object({
  moduleId: z.string(),
  blockId: z.string().optional(),
  provider: z.enum(['openai', 'anthropic', 'gemini']).default('gemini'),
  type: z.enum(['explanation', 'summary', 'example', 'steps', 'bullets', 'custom', 'improve', 'fix-grammar', 'shorten', 'simplify', 'continue']),
  prompt: z.string().min(1, 'Prompt is required'),
  currentText: z.string().optional(),
  style: z.object({
    tone: z.enum(['neutral', 'friendly', 'formal']).optional(),
    readingLevel: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  }).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeCourseContext: z.boolean().default(false),
});

export const aiGenerateQuizSchema = z.object({
  moduleId: z.string(),
  provider: z.enum(['openai', 'anthropic', 'gemini']).default('gemini'),
  prompt: z.string().min(1, 'Prompt is required'),
  questionCount: z.number().min(1).max(10).default(3),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  questionTypes: z.array(z.enum(['multiple-choice', 'true-false', 'short-answer'])).default(['multiple-choice']),
  includeCourseContext: z.boolean().default(true),
});

export const aiGenerateAssignmentSchema = z.object({
  moduleId: z.string(),
  provider: z.enum(['openai', 'anthropic', 'gemini']).default('gemini'),
  prompt: z.string().min(1, 'Assignment description is required'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  taskCount: z.number().min(1).max(10).default(3),
  assignmentType: z.enum(['project', 'research', 'practical', 'reflection', 'mixed']).default('project'),
  includeRubric: z.boolean().default(true),
  includeCourseContext: z.boolean().default(true),
});

export type AiGenerateTextRequest = z.infer<typeof aiGenerateTextSchema>;
export type AiGenerateQuizRequest = z.infer<typeof aiGenerateQuizSchema>;
export type AiGenerateAssignmentRequest = z.infer<typeof aiGenerateAssignmentSchema>;

export type ModuleWithContent = Module & {
  contentBlocks: ContentBlock[];
};

export type CourseWithContent = Course & {
  modules: ModuleWithContent[];
};
