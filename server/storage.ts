import { 
  users, 
  courses, 
  modules, 
  contentBlocks, 
  referenceFiles,
  courseThemes,
  mediaAssets,
  questionBanks,
  quizQuestions,
  blockTemplates,
  ltiPlatforms,
  ltiStates,
  type User, 
  type InsertUser, 
  type LtiPlatform,
  type InsertLtiPlatform,
  type Course, 
  type InsertCourse, 
  type Module, 
  type InsertModule, 
  type ContentBlock, 
  type InsertContentBlock, 
  type ReferenceFile, 
  type InsertReferenceFile,
  type CourseTheme,
  type InsertCourseTheme,
  type MediaAsset,
  type InsertMediaAsset,
  type QuestionBank,
  type InsertQuestionBank,
  type QuizQuestion,
  type InsertQuizQuestion,
  type BlockTemplate,
  type InsertBlockTemplate,
  type CourseWithContent,
  type ModuleWithContent
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, lt } from "drizzle-orm";
import type { CourseWithProgress } from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Courses
  getCourse(id: string): Promise<Course | undefined>;
  getCourses(): Promise<CourseWithProgress[]>;
  createCourse(course: InsertCourse): Promise<Course>;
  updateCourse(id: string, course: Partial<InsertCourse>): Promise<Course | undefined>;
  deleteCourse(id: string): Promise<boolean>;
  getCourseWithContent(courseId: string): Promise<CourseWithContent | undefined>;

  // Modules
  getModule(id: string): Promise<Module | undefined>;
  getModulesByCourseId(courseId: string): Promise<Module[]>;
  createModule(module: InsertModule): Promise<Module>;
  updateModule(id: string, module: Partial<InsertModule>): Promise<Module | undefined>;
  deleteModule(id: string): Promise<boolean>;
  reorderModules(courseId: string, moduleIds: string[]): Promise<void>;

  // Content Blocks
  getContentBlock(id: string): Promise<ContentBlock | undefined>;
  getContentBlocksByModuleId(moduleId: string): Promise<ContentBlock[]>;
  createContentBlock(contentBlock: InsertContentBlock): Promise<ContentBlock>;
  updateContentBlock(id: string, contentBlock: Partial<InsertContentBlock>): Promise<ContentBlock | undefined>;
  deleteContentBlock(id: string): Promise<boolean>;

  // Reference Files
  getReferenceFile(id: string): Promise<ReferenceFile | undefined>;
  getReferenceFilesByCourseId(courseId: string): Promise<ReferenceFile[]>;
  createReferenceFile(referenceFile: InsertReferenceFile): Promise<ReferenceFile>;
  deleteReferenceFile(id: string): Promise<boolean>;
  
  // Course Themes
  getCourseTheme(id: string): Promise<CourseTheme | undefined>;
  getCourseThemes(): Promise<CourseTheme[]>;
  createCourseTheme(theme: InsertCourseTheme): Promise<CourseTheme>;
  updateCourseTheme(id: string, theme: Partial<InsertCourseTheme>): Promise<CourseTheme | undefined>;
  deleteCourseTheme(id: string): Promise<boolean>;

  // Media Assets
  getMediaAsset(id: string): Promise<MediaAsset | undefined>;
  getMediaAssetsByCourseId(courseId: string): Promise<MediaAsset[]>;
  createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset>;
  updateMediaAsset(id: string, asset: Partial<InsertMediaAsset>): Promise<MediaAsset | undefined>;
  deleteMediaAsset(id: string): Promise<boolean>;

  // Question Banks
  getQuestionBank(id: string): Promise<QuestionBank | undefined>;
  getQuestionBanksByCourseId(courseId: string): Promise<QuestionBank[]>;
  createQuestionBank(bank: InsertQuestionBank): Promise<QuestionBank>;
  updateQuestionBank(id: string, bank: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined>;
  deleteQuestionBank(id: string): Promise<boolean>;

  // Quiz Questions
  getQuizQuestion(id: string): Promise<QuizQuestion | undefined>;
  getQuizQuestionsByBankId(bankId: string): Promise<QuizQuestion[]>;
  getQuizQuestionsByModuleId(moduleId: string): Promise<QuizQuestion[]>;
  createQuizQuestion(question: InsertQuizQuestion): Promise<QuizQuestion>;
  updateQuizQuestion(id: string, question: Partial<InsertQuizQuestion>): Promise<QuizQuestion | undefined>;
  deleteQuizQuestion(id: string): Promise<boolean>;

  // Block Templates
  getBlockTemplate(id: string): Promise<BlockTemplate | undefined>;
  getBlockTemplates(): Promise<BlockTemplate[]>;
  getPublicBlockTemplates(): Promise<BlockTemplate[]>;
  createBlockTemplate(template: InsertBlockTemplate): Promise<BlockTemplate>;
  updateBlockTemplate(id: string, template: Partial<InsertBlockTemplate>): Promise<BlockTemplate | undefined>;
  deleteBlockTemplate(id: string): Promise<boolean>;

  // LTI Platforms
  getLtiPlatform(id: string): Promise<LtiPlatform | undefined>;
  getLtiPlatformByIssuer(issuer: string, clientId: string): Promise<LtiPlatform | undefined>;
  createLtiPlatform(platform: InsertLtiPlatform): Promise<LtiPlatform>;
  updateLtiPlatform(id: string, platform: Partial<InsertLtiPlatform>): Promise<LtiPlatform | undefined>;

  // LTI States
  createLtiState(state: string, nonce: string): Promise<void>;
  verifyLtiState(state: string): Promise<{ nonce: string } | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Courses
  async getCourse(id: string): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course || undefined;
  }

  async getCourses(): Promise<CourseWithProgress[]> {
    const result = await db.execute(sql`
        WITH ranked_modules AS (
            SELECT
                m.id,
                m.course_id,
                m.parent_module_id,
                ROW_NUMBER() OVER(PARTITION BY m.course_id ORDER BY m.order::integer) as rn
            FROM modules m
        ),
        first_parent_modules AS (
            -- Get first parent module (no parent_module_id)
            SELECT id, course_id FROM ranked_modules WHERE rn = 1 AND parent_module_id IS NULL
        ),
        first_child_modules AS (
            -- Get first child module (chapter) for each parent
            SELECT 
                m.id,
                m.parent_module_id,
                ROW_NUMBER() OVER(PARTITION BY m.parent_module_id ORDER BY m.order::integer) as child_rn
            FROM modules m
            WHERE m.parent_module_id IS NOT NULL
        ),
        first_chapters AS (
            SELECT id, parent_module_id FROM first_child_modules WHERE child_rn = 1
        ),
        ranked_content_blocks AS (
            SELECT
                cb.id,
                cb.module_id,
                ROW_NUMBER() OVER(PARTITION BY cb.module_id ORDER BY cb.order::integer) as rn
            FROM content_blocks cb
        ),
        first_content_blocks AS (
            SELECT id, module_id FROM ranked_content_blocks WHERE rn = 1
        )
        SELECT
            c.*,
            COALESCE(fc.id, fpm.id) as "firstModuleId",
            fcb.id as "firstContentBlockId"
        FROM courses c
        LEFT JOIN first_parent_modules fpm ON c.id = fpm.course_id
        LEFT JOIN first_chapters fc ON fpm.id = fc.parent_module_id
        LEFT JOIN first_content_blocks fcb ON COALESCE(fc.id, fpm.id) = fcb.module_id
        ORDER BY c.updated_at DESC
    `);

    return result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      topic: row.topic,
      targetAudience: row.target_audience,
      learningObjectives: row.learning_objectives,
      duration: row.duration,
      difficulty: row.difficulty,
      referenceUrls: row.reference_urls ?? [],
      status: row.status,
      themeId: row.theme_id,
      coverImage: row.cover_image,
      logo: row.logo,
      navigationRestricted: row.navigation_restricted,
      sidebarVisible: row.sidebar_visible,
      searchEnabled: row.search_enabled,
      completionSettings: row.completion_settings ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      firstModuleId: row.firstModuleId,
      firstContentBlockId: row.firstContentBlockId,
    })) as CourseWithProgress[];
  }

  async createCourse(insertCourse: InsertCourse): Promise<Course> {
    const [course] = await db
      .insert(courses)
      .values({
        ...insertCourse,
        referenceUrls: insertCourse.referenceUrls || [],
        status: insertCourse.status || "draft",
        completionSettings: (insertCourse.completionSettings || {}) as any
      })
      .returning();
    return course;
  }

  async updateCourse(id: string, updates: Partial<InsertCourse>): Promise<Course | undefined> {
    const setValues: any = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Handle JSONB fields with type assertion
    if (updates.completionSettings !== undefined) {
      setValues.completionSettings = updates.completionSettings as any;
    }
    
    const [course] = await db
      .update(courses)
      .set(setValues)
      .where(eq(courses.id, id))
      .returning();
    return course || undefined;
  }

  async deleteCourse(id: string): Promise<boolean> {
    // Use raw SQL for cascading delete to avoid schema issues
    try {
      // Delete in correct order to respect foreign key constraints
      
      // 1. Get all modules for this course
      const courseModules = await this.getModulesByCourseId(id);
      
      if (courseModules.length > 0) {
        // Delete related data for each module individually
        for (const module of courseModules) {
          // 2. Delete all content blocks for this module
          await db.execute(sql`DELETE FROM content_blocks WHERE module_id = ${module.id}`);
          
          // 3. Delete quiz questions attached directly to this module
          await db.execute(sql`DELETE FROM quiz_questions WHERE module_id = ${module.id}`);
        }
        
        // 4. Delete all modules
        await db.execute(sql`DELETE FROM modules WHERE course_id = ${id}`);
      }
      
      // 5. Delete all reference files
      await db.execute(sql`DELETE FROM reference_files WHERE course_id = ${id}`);
      
      // 6. Delete all media assets
      await db.execute(sql`DELETE FROM media_assets WHERE course_id = ${id}`);
      
      // 7. Delete all question banks and their questions
      await db.execute(sql`DELETE FROM quiz_questions WHERE question_bank_id IN (SELECT id FROM question_banks WHERE course_id = ${id})`);
      await db.execute(sql`DELETE FROM question_banks WHERE course_id = ${id}`);
      
      // 8. Finally, delete the course itself
      const result = await db.delete(courses).where(eq(courses.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error("Error in deleteCourse:", error);
      throw error;
    }
  }

  async getCourseWithContent(courseId: string): Promise<CourseWithContent | undefined> {
    const course = await this.getCourse(courseId);
    if (!course) {
      return undefined;
    }

    const modules = await this.getModulesByCourseId(courseId);
    const modulesWithContent: ModuleWithContent[] = [];

    for (const module of modules) {
      const contentBlocks = await this.getContentBlocksByModuleId(module.id);
      modulesWithContent.push({
        ...module,
        contentBlocks,
      });
    }

    return {
      ...course,
      modules: modulesWithContent,
    };
  }

  // Modules
  async getModule(id: string): Promise<Module | undefined> {
    const [module] = await db.select().from(modules).where(eq(modules.id, id));
    return module || undefined;
  }

  async getModulesByCourseId(courseId: string): Promise<Module[]> {
    const results = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, courseId));
    
    // Sort numerically by converting order to number for proper ordering
    return results.sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async createModule(insertModule: InsertModule): Promise<Module> {
    const insertedModules = await db
      .insert(modules)
      .values({
        ...insertModule,
        navigationSettings: (insertModule.navigationSettings || {}) as any
      })
      .returning();
    return insertedModules[0] as Module;
  }

  async updateModule(id: string, updates: Partial<InsertModule>): Promise<Module | undefined> {
    const setValues: any = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Handle JSONB fields with type assertion
    if (updates.navigationSettings !== undefined) {
      setValues.navigationSettings = updates.navigationSettings as any;
    }
    
    const [module] = await db
      .update(modules)
      .set(setValues)
      .where(eq(modules.id, id))
      .returning();
    return module || undefined;
  }

  async deleteModule(id: string): Promise<boolean> {
    // Delete dependent records first to satisfy FK constraints
    await db.execute(sql`DELETE FROM content_blocks WHERE module_id = ${id}`);
    await db.execute(sql`DELETE FROM quiz_questions WHERE module_id = ${id}`);
    const result = await db.delete(modules).where(eq(modules.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async reorderModules(courseId: string, moduleIds: string[]): Promise<void> {
    // Validate that all modules belong to the specified course
    const existingModules = await this.getModulesByCourseId(courseId);
    const existingModuleIds = new Set(existingModules.map(m => m.id));
    
    for (const moduleId of moduleIds) {
      if (!existingModuleIds.has(moduleId)) {
        throw new Error(`Module ${moduleId} does not belong to course ${courseId}`);
      }
    }
    
    // Update orders with courseId validation for security
    for (let index = 0; index < moduleIds.length; index++) {
      const moduleId = moduleIds[index];
      await db
        .update(modules)
        .set({ order: index.toString() })
        .where(eq(modules.id, moduleId));
    }
  }

  // Content Blocks
  async getContentBlock(id: string): Promise<ContentBlock | undefined> {
    const [block] = await db.select().from(contentBlocks).where(eq(contentBlocks.id, id));
    return block || undefined;
  }

  async getContentBlocksByModuleId(moduleId: string): Promise<ContentBlock[]> {
    const results = await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.moduleId, moduleId));
    
    // Sort numerically by converting order to number for proper ordering
    return results.sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async createContentBlock(insertContentBlock: InsertContentBlock): Promise<ContentBlock> {
    const [block] = await db
      .insert(contentBlocks)
      .values({
        ...insertContentBlock,
        styling: (insertContentBlock.styling || {}) as any,
        accessibility: (insertContentBlock.accessibility || {}) as any
      })
      .returning();
    return block;
  }

  async updateContentBlock(id: string, updates: Partial<InsertContentBlock>): Promise<ContentBlock | undefined> {
    const setValues: any = {
      ...updates,
      updatedAt: new Date()
    };
    
    // Handle JSONB fields with type assertion
    if (updates.styling !== undefined) {
      setValues.styling = updates.styling as any;
    }
    if (updates.accessibility !== undefined) {
      setValues.accessibility = updates.accessibility as any;
    }
    
    const [block] = await db
      .update(contentBlocks)
      .set(setValues)
      .where(eq(contentBlocks.id, id))
      .returning();
    return block || undefined;
  }

  async deleteContentBlock(id: string): Promise<boolean> {
    const result = await db.delete(contentBlocks).where(eq(contentBlocks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Reference Files
  async getReferenceFile(id: string): Promise<ReferenceFile | undefined> {
    const [file] = await db.select().from(referenceFiles).where(eq(referenceFiles.id, id));
    return file || undefined;
  }

  async getReferenceFilesByCourseId(courseId: string): Promise<ReferenceFile[]> {
    return await db
      .select()
      .from(referenceFiles)
      .where(eq(referenceFiles.courseId, courseId));
  }

  async createReferenceFile(insertReferenceFile: InsertReferenceFile): Promise<ReferenceFile> {
    const [file] = await db
      .insert(referenceFiles)
      .values(insertReferenceFile)
      .returning();
    return file;
  }

  async deleteReferenceFile(id: string): Promise<boolean> {
    const result = await db.delete(referenceFiles).where(eq(referenceFiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Course Themes
  async getCourseTheme(id: string): Promise<CourseTheme | undefined> {
    const [theme] = await db.select().from(courseThemes).where(eq(courseThemes.id, id));
    return theme || undefined;
  }

  async getCourseThemes(): Promise<CourseTheme[]> {
    return await db.select().from(courseThemes).orderBy(desc(courseThemes.updatedAt));
  }

  async createCourseTheme(insertTheme: InsertCourseTheme): Promise<CourseTheme> {
    const [theme] = await db
      .insert(courseThemes)
      .values({
        name: insertTheme.name,
        isDefault: insertTheme.isDefault,
        settings: insertTheme.settings as any
      })
      .returning();
    return theme;
  }

  async updateCourseTheme(id: string, updates: Partial<InsertCourseTheme>): Promise<CourseTheme | undefined> {
    const [theme] = await db
      .update(courseThemes)
      .set({
        ...updates,
        settings: updates.settings as any,
        updatedAt: new Date()
      })
      .where(eq(courseThemes.id, id))
      .returning();
    return theme || undefined;
  }

  async deleteCourseTheme(id: string): Promise<boolean> {
    const result = await db.delete(courseThemes).where(eq(courseThemes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Media Assets
  async getMediaAsset(id: string): Promise<MediaAsset | undefined> {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return asset || undefined;
  }

  async getMediaAssetsByCourseId(courseId: string): Promise<MediaAsset[]> {
    return await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.courseId, courseId))
      .orderBy(desc(mediaAssets.uploadedAt));
  }

  async createMediaAsset(insertAsset: InsertMediaAsset): Promise<MediaAsset> {
    const [asset] = await db
      .insert(mediaAssets)
      .values({
        courseId: insertAsset.courseId,
        filename: insertAsset.filename,
        originalName: insertAsset.originalName,
        mimetype: insertAsset.mimetype,
        size: insertAsset.size,
        assetType: insertAsset.assetType,
        metadata: insertAsset.metadata as any
      })
      .returning();
    return asset;
  }

  async updateMediaAsset(id: string, updates: Partial<InsertMediaAsset>): Promise<MediaAsset | undefined> {
    const [asset] = await db
      .update(mediaAssets)
      .set({
        ...updates,
        metadata: updates.metadata as any
      })
      .where(eq(mediaAssets.id, id))
      .returning();
    return asset || undefined;
  }

  async deleteMediaAsset(id: string): Promise<boolean> {
    const result = await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Question Banks
  async getQuestionBank(id: string): Promise<QuestionBank | undefined> {
    const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, id));
    return bank || undefined;
  }

  async getQuestionBanksByCourseId(courseId: string): Promise<QuestionBank[]> {
    return await db
      .select()
      .from(questionBanks)
      .where(eq(questionBanks.courseId, courseId))
      .orderBy(desc(questionBanks.updatedAt));
  }

  async createQuestionBank(insertBank: InsertQuestionBank): Promise<QuestionBank> {
    const [bank] = await db
      .insert(questionBanks)
      .values(insertBank)
      .returning();
    return bank;
  }

  async updateQuestionBank(id: string, updates: Partial<InsertQuestionBank>): Promise<QuestionBank | undefined> {
    const [bank] = await db
      .update(questionBanks)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(questionBanks.id, id))
      .returning();
    return bank || undefined;
  }

  async deleteQuestionBank(id: string): Promise<boolean> {
    const result = await db.delete(questionBanks).where(eq(questionBanks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Quiz Questions
  async getQuizQuestion(id: string): Promise<QuizQuestion | undefined> {
    const [question] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id));
    return question || undefined;
  }

  async getQuizQuestionsByBankId(bankId: string): Promise<QuizQuestion[]> {
    const results = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.questionBankId, bankId));
    
    return results.sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async getQuizQuestionsByModuleId(moduleId: string): Promise<QuizQuestion[]> {
    const results = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.moduleId, moduleId));
    
    return results.sort((a, b) => parseInt(a.order) - parseInt(b.order));
  }

  async createQuizQuestion(insertQuestion: InsertQuizQuestion): Promise<QuizQuestion> {
    const [question] = await db
      .insert(quizQuestions)
      .values({
        questionBankId: insertQuestion.questionBankId,
        moduleId: insertQuestion.moduleId,
        type: insertQuestion.type,
        question: insertQuestion.question,
        options: insertQuestion.options as any,
        explanation: insertQuestion.explanation,
        points: insertQuestion.points,
        order: insertQuestion.order
      })
      .returning();
    return question;
  }

  async updateQuizQuestion(id: string, updates: Partial<InsertQuizQuestion>): Promise<QuizQuestion | undefined> {
    const [question] = await db
      .update(quizQuestions)
      .set({
        ...updates,
        options: updates.options as any,
        updatedAt: new Date()
      })
      .where(eq(quizQuestions.id, id))
      .returning();
    return question || undefined;
  }

  async deleteQuizQuestion(id: string): Promise<boolean> {
    const result = await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Block Templates
  async getBlockTemplate(id: string): Promise<BlockTemplate | undefined> {
    const [template] = await db.select().from(blockTemplates).where(eq(blockTemplates.id, id));
    return template || undefined;
  }

  async getBlockTemplates(): Promise<BlockTemplate[]> {
    return await db.select().from(blockTemplates).orderBy(desc(blockTemplates.updatedAt));
  }

  async getPublicBlockTemplates(): Promise<BlockTemplate[]> {
    return await db
      .select()
      .from(blockTemplates)
      .where(eq(blockTemplates.isPublic, "true"))
      .orderBy(desc(blockTemplates.updatedAt));
  }

  async createBlockTemplate(insertTemplate: InsertBlockTemplate): Promise<BlockTemplate> {
    const [template] = await db
      .insert(blockTemplates)
      .values({
        name: insertTemplate.name,
        description: insertTemplate.description,
        blockType: insertTemplate.blockType,
        templateData: insertTemplate.templateData as any,
        isPublic: insertTemplate.isPublic,
        createdBy: insertTemplate.createdBy
      })
      .returning();
    return template;
  }

  async updateBlockTemplate(id: string, updates: Partial<InsertBlockTemplate>): Promise<BlockTemplate | undefined> {
    const [template] = await db
      .update(blockTemplates)
      .set({
        ...updates,
        templateData: updates.templateData as any,
        updatedAt: new Date()
      })
      .where(eq(blockTemplates.id, id))
      .returning();
    return template || undefined;
  }

  async deleteBlockTemplate(id: string): Promise<boolean> {
    const result = await db.delete(blockTemplates).where(eq(blockTemplates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // LTI Platforms
  async getLtiPlatform(id: string): Promise<LtiPlatform | undefined> {
    const [platform] = await db.select().from(ltiPlatforms).where(eq(ltiPlatforms.id, id));
    return platform || undefined;
  }

  async getLtiPlatformByIssuer(issuer: string, clientId: string): Promise<LtiPlatform | undefined> {
    const [platform] = await db
      .select()
      .from(ltiPlatforms)
      .where(and(eq(ltiPlatforms.issuer, issuer), eq(ltiPlatforms.clientId, clientId)));
    return platform || undefined;
  }

  async createLtiPlatform(insertPlatform: InsertLtiPlatform): Promise<LtiPlatform> {
    const [platform] = await db
      .insert(ltiPlatforms)
      .values(insertPlatform)
      .returning();
    return platform;
  }

  async updateLtiPlatform(id: string, updates: Partial<InsertLtiPlatform>): Promise<LtiPlatform | undefined> {
    const [platform] = await db
      .update(ltiPlatforms)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(ltiPlatforms.id, id))
      .returning();
    return platform || undefined;
  }

  // LTI States
  async createLtiState(state: string, nonce: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // State expires in 15 minutes

    await db
      .insert(ltiStates)
      .values({
        state,
        nonce,
        expiresAt
      });
  }

  async verifyLtiState(state: string): Promise<{ nonce: string } | undefined> {
    const [ltiState] = await db
      .select()
      .from(ltiStates)
      .where(and(eq(ltiStates.state, state), sql`${ltiStates.expiresAt} > NOW()`));

    if (!ltiState) {
      return undefined;
    }

    // Delete used state to prevent replay attacks
    await db.delete(ltiStates).where(eq(ltiStates.id, ltiState.id));
    
    return { nonce: ltiState.nonce };
  }
}

export const storage = new DatabaseStorage();
