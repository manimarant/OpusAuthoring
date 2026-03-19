import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiGenerateTextRequest, AiGenerateQuizRequest, AiGenerateVideoRequest } from "@shared/schema";

// Using Gemini Flash model  
const apiKey = process.env.GEMINI_API_KEY || "";

const ai = new GoogleGenerativeAI(apiKey);

// Rate limiting storage (in-memory for now)
const rateLimits = new Map<string, { requests: number; resetTime: number }>();

export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);
  
  if (!limit || now > limit.resetTime) {
    // Reset or first request
    rateLimits.set(identifier, { requests: 1, resetTime: now + 60000 }); // 1 minute window
    return { allowed: true };
  }
  
  if (limit.requests >= 30) { // 30 requests per minute
    return { allowed: false, retryAfter: Math.ceil((limit.resetTime - now) / 1000) };
  }
  
  limit.requests++;
  return { allowed: true };
}

function buildSystemPrompt(request: AiGenerateTextRequest, courseContext?: { title: string; topic: string; objectives: string }): string {
  const { type, style, length, currentText } = request;
  
  let systemPrompt = "You are an expert educational content creator. ";
  
  // Quick action types (text editing)
  if (currentText && ['improve', 'fix-grammar', 'shorten', 'simplify', 'continue'].includes(type)) {
    switch (type) {
      case 'improve':
        systemPrompt = "You are an expert content editor. Improve the writing quality, clarity, and flow while maintaining the original meaning and intent. Return only the improved text.";
        break;
      case 'fix-grammar':
        systemPrompt = "You are an expert proofreader. Fix all spelling and grammar errors while keeping the content otherwise unchanged. Return only the corrected text.";
        break;
      case 'shorten':
        systemPrompt = "You are an expert editor. Make this text more concise while preserving the key information and meaning. Return only the shortened text.";
        break;
      case 'simplify':
        systemPrompt = "You are an expert educator. Simplify the language to make it easier to understand without losing the core meaning. Return only the simplified text.";
        break;
      case 'continue':
        systemPrompt = "You are an expert educational content writer. Continue writing from where this text ends, maintaining the same style, tone, and level of detail. Return only the continuation (do not repeat the existing text).";
        break;
    }
  } else {
    // Content generation types
    switch (type) {
      case 'custom':
        if (currentText) {
          systemPrompt += "Follow the user's instructions to modify, enhance, or add to the existing educational content. If the user asks to add something, incorporate it naturally into the existing text while maintaining coherence and flow.";
        } else {
          systemPrompt += "Follow the user's instructions to create educational content.";
        }
        break;
      case 'explanation':
        systemPrompt += "Create clear, educational explanations that help learners understand concepts thoroughly.";
        break;
      case 'summary':
        systemPrompt += "Create concise summaries that capture the most important points.";
        break;
      case 'example':
        systemPrompt += "Provide practical, relevant examples that illustrate concepts clearly.";
        break;
      case 'steps':
        systemPrompt += "Break down processes into clear, actionable steps that are easy to follow.";
        break;
      case 'bullets':
        systemPrompt += "Create well-organized bullet points that highlight key information.";
        break;
    }
  }
  
  // Style modifications (only apply to content generation, not quick actions)
  if (!currentText || !['improve', 'fix-grammar', 'shorten', 'simplify', 'continue'].includes(type)) {
    if (style?.tone) {
      switch (style.tone) {
        case 'friendly':
          systemPrompt += " Use a warm, conversational tone that makes learning enjoyable.";
          break;
        case 'formal':
          systemPrompt += " Use a professional, academic tone appropriate for formal education.";
          break;
        case 'neutral':
          systemPrompt += " Use a clear, straightforward tone that focuses on information delivery.";
          break;
      }
    }
    
    if (style?.readingLevel) {
      switch (style.readingLevel) {
        case 'basic':
          systemPrompt += " Use simple language and avoid technical jargon.";
          break;
        case 'intermediate':
          systemPrompt += " Use moderately complex language with some technical terms when necessary.";
          break;
        case 'advanced':
          systemPrompt += " Use sophisticated language and technical terminology as appropriate.";
          break;
      }
    }
    
    // Length guidance
    if (length) {
      switch (length) {
        case 'short':
          systemPrompt += " Keep the content concise and to the point (1-2 paragraphs).";
          break;
        case 'medium':
          systemPrompt += " Provide moderate detail (3-4 paragraphs).";
          break;
        case 'long':
          systemPrompt += " Provide comprehensive detail (5+ paragraphs).";
          break;
      }
    }
  }
  
  if (courseContext) {
    systemPrompt += `\n\nCourse Context:
- Course Title: ${courseContext.title}
- Topic: ${courseContext.topic}
- Learning Objectives: ${courseContext.objectives}

Please ensure your content aligns with this course context.`;
  }
  
  return systemPrompt;
}

export async function generateText(
  request: AiGenerateTextRequest,
  courseContext?: { title: string; topic: string; objectives: string }
): Promise<{ text: string; tokensUsed?: number; provider: string; model: string }> {
  const systemPrompt = buildSystemPrompt(request, courseContext);
  
  // For quick actions and custom prompts with existing text, include the current text in the user message
  let userMessage = request.prompt;
  if (request.currentText) {
    if (['improve', 'fix-grammar', 'shorten', 'simplify', 'continue'].includes(request.type)) {
      userMessage = `${request.prompt}\n\nText to ${request.type}:\n${request.currentText}`;
    } else if (request.type === 'custom') {
      userMessage = `${request.prompt}\n\nCurrent text:\n${request.currentText}`;
    }
  }
  
  // Retry logic for API failures
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      
      const model = ai.getGenerativeModel({ 
        model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
      });
      
      const result = await model.generateContent(userMessage);
      const response = await result.response;
      const text = response.text() || "";
      return {
        text,
        tokensUsed: undefined, // Gemini doesn't expose token usage in the same way
        provider: "gemini",
        model: "gemini-flash-latest"
      };
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Text generation attempt ${attempt} failed:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      });
      
      // Check for quota exceeded error
      if (error.message?.includes('Quota exceeded') || error.message?.includes('quota_exceeded')) {
        throw new Error('AI quota exceeded. Please try again later or upgrade your plan.');
      }
      
      // If this is a retryable error and not the last attempt, wait and retry
      if (attempt < 3 && (error.status >= 500 || error.message?.includes("temporarily unavailable") || error.message?.includes("overloaded") || error.status === 429)) {
        let delayMs = attempt * 5000; // 5s, 10s
        if (error.status === 429 && error.errorDetails && Array.isArray(error.errorDetails)) {
          const retryInfo = error.errorDetails.find((detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          if (retryInfo && retryInfo.retryDelay) {
            const delaySeconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
            if (!isNaN(delaySeconds)) {
              delayMs = delaySeconds * 1000;
            }
          }
        }
        await sleep(delayMs);
        continue;
      }
      
      // For non-retryable errors or last attempt, break
      break;
    }
  }
  
  // Handle final error after all retries
  if (lastError) {
    if (lastError.message && lastError.message.includes("API key")) {
      throw new Error("Invalid API key. Please check your Gemini configuration.");
    } else if (lastError.message && lastError.message.includes("quota")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (lastError.status && lastError.status >= 500) {
      throw new Error("Gemini service is temporarily unavailable. Please try again later.");
    }
    
    throw new Error(`Failed to generate content: ${lastError.message || String(lastError)}`);
  }
  
  throw new Error("Failed to generate content after all retries");
}

export async function generateQuiz(
  request: AiGenerateQuizRequest,
  courseContext?: { title: string; topic: string; objectives: string }
): Promise<{ questions: any[]; description?: string; tokensUsed?: number; provider: string; model: string }> {
  const systemPrompt = buildQuizSystemPrompt(request, courseContext);
  const userMessage = buildQuizUserMessage(request);
  
  // Retry logic for API failures
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      
      const model = ai.getGenerativeModel({ 
        model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      const result = await model.generateContent(userMessage);
      const response = await result.response;
      const text = response.text() || "";
      
      // Parse the JSON response
      let quizData;
      try {
        quizData = JSON.parse(text);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          quizData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("Failed to parse quiz from AI response");
        }
      }
      
      // Handle both old format (array) and new format (object with description)
      let questions, description;
      if (Array.isArray(quizData)) {
        // Old format - just questions array
        questions = quizData;
        description = "Test your understanding of the content";
      } else if (quizData.questions && Array.isArray(quizData.questions)) {
        // New format - object with description and questions
        questions = quizData.questions;
        description = quizData.description || "Test your understanding of the content";
      } else {
        throw new Error("AI response does not contain valid questions");
      }
      return {
        questions,
        description,
        tokensUsed: undefined,
        provider: "gemini",
        model: "gemini-flash-latest"
      };
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Quiz generation attempt ${attempt} failed:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        fullError: JSON.stringify(error, null, 2)
      });
      
      // If this is a retryable error and not the last attempt, wait and retry
      if (attempt < 3 && (error.status >= 500 || error.message?.includes("temporarily unavailable") || error.message?.includes("overloaded") || error.status === 429)) {
        let delayMs = attempt * 5000; // 5s, 10s
        if (error.status === 429 && error.errorDetails && Array.isArray(error.errorDetails)) {
          const retryInfo = error.errorDetails.find((detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          if (retryInfo && retryInfo.retryDelay) {
            const delaySeconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
            if (!isNaN(delaySeconds)) {
              delayMs = delaySeconds * 1000;
            }
          }
        }
        await sleep(delayMs);
        continue;
      }
      
      // For non-retryable errors or last attempt, throw immediately
      break;
    }
  }
  
  // Handle final error after all retries
  if (lastError) {
    if (lastError.message && lastError.message.includes("API key")) {
      throw new Error("Invalid API key. Please check your Gemini configuration.");
    } else if (lastError.message && lastError.message.includes("quota")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (lastError.status && lastError.status >= 500) {
      throw new Error("Gemini service is temporarily unavailable. Please try again later.");
    }
    throw new Error(`Failed to generate quiz: ${lastError.message || String(lastError)}`);
  }
  
  throw new Error("Failed to generate quiz after all retries");
}

function buildQuizSystemPrompt(request: AiGenerateQuizRequest, courseContext?: { title: string; topic: string; objectives: string }): string {
  let systemPrompt = "You are an expert educational content creator. Create quiz questions that test learner understanding. ";
  
  if (courseContext) {
    systemPrompt += `\nCourse: ${courseContext.title} - Topic: ${courseContext.topic}`;
  }
  
  systemPrompt += `\n\nReturn ONLY a JSON object with this exact structure:
{
  "description": "A brief, engaging description of what this quiz tests (1 sentence)",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "What is the correct answer?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "A",
      "explanation": "This is correct because..."
    }
  ]
}

IMPORTANT: 
- The correctAnswer field must be a single letter (A, B, C, D) that corresponds to the option index, NOT the full option text.
- The description should be specific to the content being tested, not generic.`;
  
  return systemPrompt;
}

function buildQuizUserMessage(request: AiGenerateQuizRequest): string {
  let userMessage = `Create ${request.questionCount} quiz questions based on: ${request.prompt}\n\n`;
  
  userMessage += `Requirements:
- Difficulty: ${request.difficulty}
- Question types: ${request.questionTypes.join(', ')}
- Number of questions: ${request.questionCount}
- For multiple choice questions, provide exactly 4 options
- Set correctAnswer to the letter (A, B, C, or D) of the correct option, NOT the full text
- Include a brief, specific description (1 sentence) explaining what knowledge this quiz tests

IMPORTANT: Return as a JSON object with "description" and "questions" fields, NOT just an array.

Example:
{
  "description": "Assess your understanding of quantum computing fundamentals and qubit mechanics",
  "questions": [...]
}`;
  
  return userMessage;
}

// Helper function to sleep for retry logic
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeObjectiveText(value: string): string {
  return value.replace(/^[-*\u2022â€¢\s]+/, "").trim();
}

function parseSeedObjectives(learningObjectives: string): string[] {
  return learningObjectives
    .split(/\r?\n/)
    .map(normalizeObjectiveText)
    .filter(Boolean);
}

function buildCourseObjectives(topic: string, seedObjectives: string[]): string[] {
  if (seedObjectives.length >= 3) {
    return seedObjectives.slice(0, 6);
  }

  return [
    `Explain the essential principles and terminology of ${topic}`,
    `Apply ${topic} methods to realistic tasks and decisions`,
    `Analyze outcomes and improve performance using ${topic} best practices`,
    ...seedObjectives,
  ]
    .map(normalizeObjectiveText)
    .filter(Boolean)
    .slice(0, 6);
}

function buildModuleTitle(topic: string, objective: string, index: number): string {
  const cleanedObjective = normalizeObjectiveText(objective);
  const phrase = cleanedObjective
    .replace(/^(understand|explain|apply|analyze|evaluate|create|develop|design|build|identify)\s+/i, "")
    .replace(/\.$/, "")
    .trim();

  if (!phrase) {
    return `Module ${index + 1}: ${topic}`;
  }

  const shortened = phrase.length > 56 ? `${phrase.slice(0, 53).trim()}...` : phrase;
  return `Module ${index + 1}: ${toTitleCase(shortened)}`;
}

function buildModuleObjectives(topic: string, moduleTitle: string, objective: string, index: number): string[] {
  const cleanedObjective = normalizeObjectiveText(objective) || `Understand the key concepts in ${moduleTitle}`;

  return [
    cleanedObjective,
    `Practice the main skills and decisions introduced in ${moduleTitle.toLowerCase()}`,
    `Connect ${topic} concepts from module ${index + 1} to practical use cases`,
  ]
    .map(normalizeObjectiveText)
    .filter(Boolean);
}

function buildChapterTitle(moduleTitle: string, moduleObjective: string, chapterIndex: number): string {
  const base = moduleTitle.includes(":") ? moduleTitle.split(":").slice(1).join(":").trim() : moduleTitle.trim();
  const objective = normalizeObjectiveText(moduleObjective)
    .replace(/^(understand|explain|apply|analyze|evaluate|create|develop|design|build|identify)\s+/i, "")
    .trim();

  const chapterThemes = [
    `Foundations of ${base}`,
    objective ? `Applying ${objective}` : `Core skills for ${base}`,
    `Practice and review for ${base}`,
  ];

  return `Lesson ${chapterIndex + 1}: ${chapterThemes[chapterIndex] || base}`;
}

function isGenericModuleTitle(value: string): boolean {
  return /^module\s+\d+\s*:?$/i.test(value.trim());
}

function isGenericLessonTitle(value: string): boolean {
  return /^lesson\s+\d+(\s*:\s*(module\s+\d+.*|introduction.*|overview.*))?$/i.test(value.trim());
}

function createRelevantFallbackOutline(course: { title: string; topic: string; learningObjectives: string }): any {
  const targetModules = 6;
  const targetChapters = 3;
  const courseObjectives = buildCourseObjectives(course.topic, parseSeedObjectives(course.learningObjectives));

  return {
    title: course.title || `Course: ${course.topic}`,
    introduction: `This course covers ${course.topic}`,
    course_objectives: courseObjectives,
    modules: Array.from({ length: targetModules }, (_v, i) => {
      const seededObjective = courseObjectives[i % courseObjectives.length] || `Explain the key ideas in ${course.topic}`;
      const title = buildModuleTitle(course.topic, seededObjective, i);
      const learningObjectives = buildModuleObjectives(course.topic, title, seededObjective, i);

      return {
        title,
        learning_objective: learningObjectives[0],
        learning_objectives: learningObjectives,
        chapters: Array.from({ length: targetChapters }, (_c, j) => ({
          title: buildChapterTitle(title, learningObjectives[0], j),
          description: "",
        })),
      };
    }),
    _meta: {
      source: "fallback",
      reason: "AI outline generation unavailable",
    },
  };
}

function normalizeGeneratedOutline(course: { title: string; topic: string; learningObjectives: string }, outline: any) {
  const targetModules = 6;
  const targetChapters = 3;
  const normalizedCourseObjectives = Array.isArray(outline.course_objectives)
    ? outline.course_objectives.map((objective: unknown) => normalizeObjectiveText(String(objective || ""))).filter(Boolean)
    : [];
  const courseObjectives = normalizedCourseObjectives.length > 0
    ? normalizedCourseObjectives
    : buildCourseObjectives(course.topic, parseSeedObjectives(course.learningObjectives));

  outline.modules = Array.from({ length: targetModules }, (_v, i) => {
    const source = (outline.modules && outline.modules[i]) || {};
    const sourceModuleObjectives = Array.isArray(source.learning_objectives)
      ? source.learning_objectives.map((objective: unknown) => normalizeObjectiveText(String(objective || ""))).filter(Boolean)
      : [];
    const learningObjective = normalizeObjectiveText(source.learning_objective || sourceModuleObjectives[0] || courseObjectives[i % courseObjectives.length] || "");
    const title = normalizeObjectiveText(source.title || "") || buildModuleTitle(course.topic, learningObjective, i);
    const learningObjectives = sourceModuleObjectives.length > 0
      ? sourceModuleObjectives
      : buildModuleObjectives(course.topic, title, learningObjective, i);
    const chapters = Array.from({ length: targetChapters }, (_c, j) => {
      const srcChapter = (source.chapters && source.chapters[j]) || {};
      return {
        title: normalizeObjectiveText(srcChapter.title || "") || buildChapterTitle(title, learningObjectives[0] || learningObjective, j),
        description: srcChapter.description || "",
      };
    });

    return {
      title,
      learning_objective: learningObjectives[0] || learningObjective,
      learning_objectives: learningObjectives,
      chapters,
    };
  });

  outline.title = outline.title || course.title || "New Course";
  outline.introduction = outline.introduction || "";
  outline.course_objectives = courseObjectives;

  return outline;
}

// Fallback function to create a basic outline when AI is unavailable
function createFallbackOutline(course: { title: string; topic: string; learningObjectives: string }): any {
  const targetModules = 6;
  const targetChapters = 3;
  const parsedCourseObjectives = course.learningObjectives
    .split(/\r?\n/)
    .map((objective) => objective.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean);
  const courseObjectives = parsedCourseObjectives.length > 0
    ? parsedCourseObjectives
    : [
        `Explain the core concepts of ${course.topic}`,
        `Apply foundational ${course.topic} techniques in practical situations`,
        `Evaluate outcomes and improve performance in ${course.topic}`,
      ];
  
  const modules = Array.from({ length: targetModules }, (_v, i) => ({
    title: `Module ${i + 1}: ${course.topic}`,
    learning_objective: `Learn about ${course.topic} - Part ${i + 1}`,
    learning_objectives: [
      `Understand the key ideas covered in ${course.topic} part ${i + 1}`,
      `Practice the main skills introduced in module ${i + 1}`,
      `Connect module ${i + 1} concepts to real-world use cases`,
    ],
    chapters: Array.from({ length: targetChapters }, (_c, j) => ({
      title: `Lesson ${j + 1}: Introduction to Module ${i + 1}`,
      description: ""
    }))
  }));
  
  return {
    title: course.title || `Course: ${course.topic}`,
    introduction: `This course covers ${course.topic}`,
    course_objectives: courseObjectives,
    modules,
    _meta: {
      source: "fallback",
      reason: "AI outline generation unavailable",
    },
  };
}

// Gemini native image generation service
async function generateImageWithGemini(
  prompt: string,
  size: "1024x1024" | "1024x1792" | "1792x1024" = "1792x1024"
): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  if (!geminiApiKey) {
    console.warn("⚠️  GEMINI_API_KEY not found. Falling back to placeholder image.");
    throw new Error("Gemini API key not configured");
  }
  
  const aspectRatioInstruction = size === "1024x1792"
    ? "Portrait 9:16 composition."
    : size === "1792x1024"
      ? "Landscape 16:9 composition."
      : "Square 1:1 composition.";
  
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${prompt}\n\n${aspectRatioInstruction}\nOutput a polished educational image only.`,
              },
            ],
          },
        ],
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Gemini image API error:", errorData);
      
      if (response.status === 401) {
        throw new Error("Invalid Gemini API key");
      } else if (response.status === 402) {
        throw new Error("Insufficient credits for Gemini image generation");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded for Gemini image generation");
      } else {
        throw new Error(`Gemini image API error: ${errorData?.error?.message || 'Unknown error'}`);
      }
    }
    
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
      throw new Error("No content returned from Gemini image model");
    }
    const imagePart = parts.find((part: any) => part?.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new Error("No inline image data returned from Gemini image model");
    }
    
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
    const requestId = "";
    let attempts = 0;
    const maxAttempts = 0;
    const pollingUrl = "";
    const bflApiKey = "";
    console.log(`🔄 Polling Flux API for image generation (ID: ${requestId})...`);

    
    while (attempts < maxAttempts) {
      await sleep(2000); // Wait 2 seconds between polls
      attempts++;
      
      try {
        const pollResponse = await fetch(pollingUrl, {
          headers: {
            'accept': 'application/json',
            'x-key': bflApiKey,
          },
        });
        
        if (!pollResponse.ok) {
          console.error(`Polling failed: ${pollResponse.status} ${pollResponse.statusText}`);
          continue;
        }
        
        const pollData = await pollResponse.json();
        
        if (pollData.status === 'Ready') {
          const imageUrl = pollData.result?.sample;
          if (!imageUrl) {
            throw new Error("No image URL in ready response from Flux API");
          }
          console.log(`✅ Flux image generated successfully in ${attempts * 2} seconds`);
          return imageUrl;
        } else if (pollData.status === 'Error' || pollData.status === 'Failed') {
          throw new Error(`Flux generation failed: ${pollData.error?.message || 'Unknown error'}`);
        }
        
        // Status is still 'Pending' or 'Processing', continue polling
        if (attempts % 5 === 0) {
          console.log(`⏳ Still generating... (${attempts * 2}s elapsed, status: ${pollData.status})`);
        }
        
      } catch (pollError: any) {
        console.error(`Polling attempt ${attempts} failed:`, pollError.message);
        if (attempts >= maxAttempts - 1) {
          throw pollError;
        }
      }
    }
    
    throw new Error("Unexpected fallback polling path reached during Gemini image generation");
    
  } catch (error: any) {
    console.error("Gemini image generation failed:", error.message);
    throw error;
    console.error("❌ Flux generation failed:", error.message);
    console.error("Gemini image generation failed:", error.message);
    throw error;
  }
}

function createInlinePlaceholderSvg(title: string, size: string = "800x400"): string {
  const [widthRaw, heightRaw] = size.split("x");
  const width = Math.max(Number(widthRaw) || 800, 320);
  const height = Math.max(Number(heightRaw) || 400, 180);
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#e2e8f0" />
          <stop offset="100%" stop-color="#cbd5e1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="24" fill="url(#bg)" />
      <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="18" fill="#ffffff" fill-opacity="0.72" />
      <circle cx="${Math.round(width * 0.24)}" cy="${Math.round(height * 0.32)}" r="${Math.round(Math.min(width, height) * 0.08)}" fill="#93c5fd" fill-opacity="0.95" />
      <circle cx="${Math.round(width * 0.72)}" cy="${Math.round(height * 0.38)}" r="${Math.round(Math.min(width, height) * 0.11)}" fill="#86efac" fill-opacity="0.9" />
      <circle cx="${Math.round(width * 0.48)}" cy="${Math.round(height * 0.66)}" r="${Math.round(Math.min(width, height) * 0.14)}" fill="#f9a8d4" fill-opacity="0.88" />
      <rect x="${Math.round(width * 0.18)}" y="${Math.round(height * 0.7)}" width="${Math.round(width * 0.28)}" height="${Math.round(height * 0.05)}" rx="999" fill="#0f172a" fill-opacity="0.16" />
      <rect x="${Math.round(width * 0.52)}" y="${Math.round(height * 0.7)}" width="${Math.round(width * 0.18)}" height="${Math.round(height * 0.05)}" rx="999" fill="#0f172a" fill-opacity="0.12" />
      <text x="50%" y="87%" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(Math.min(width / 34, 20), 12)}" fill="#475569">
        ${safeTitle.slice(0, 72)}
      </text>
    </svg>
  `.replace(/\s{2,}/g, " ").trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

// Generate contextual placeholder images based on title
function generateContextualPlaceholder(title: string, size: string = "800x400"): string {
  // Create a deterministic seed from the title so the same chapter gets the same fallback.
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const seed = Math.abs(hash) % 10000;
  const [widthRaw, heightRaw] = size.split("x");
  const width = Math.max(Number(widthRaw) || 800, 320);
  const height = Math.max(Number(heightRaw) || 400, 180);
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

// Generate images for chapters using Gemini's image understanding capabilities
// Note: Gemini doesn't directly generate images, but we can create image prompts
// that can be used to steer Gemini's native image generation toward chapter-specific visuals.
export async function generateChapterImagePrompt(
  chapterTitle: string,
  moduleTitle?: string,
  courseContext?: { title: string; topic: string; objectives: string },
  options?: { sourceText?: string; preferredStyle?: string }
): Promise<{ imagePrompt: string; suggestedStyle: string; visualBrief: string }> {
  const systemPrompt = `You are an expert instructional designer and visual director for e-learning.
Create a chapter-specific visual brief and then a production-ready image prompt.
The image must reflect the chapter content, not a generic stock photo.
Prefer concrete educational scenes, relevant objects, process visuals, workplace context, or diagram-like compositions when appropriate.
Avoid unrelated decorative imagery.
Return JSON only with keys:
- visualBrief: 2-4 concise sentences describing the best visual concept
- imagePrompt: a detailed prompt for an image model
- suggestedStyle: a short style label`;

  let userMessage = `Create an image generation prompt for a course chapter with the following details:\n\n`;
  userMessage += `Chapter Title: ${chapterTitle}\n`;
  
  if (moduleTitle) {
    userMessage += `Module: ${moduleTitle}\n`;
  }
  
  if (courseContext) {
    userMessage += `Course: ${courseContext.title}\n`;
    userMessage += `Topic: ${courseContext.topic}\n`;
    userMessage += `Objectives: ${courseContext.objectives}\n`;
  }

  if (options?.sourceText) {
    userMessage += `Chapter content excerpt: ${options.sourceText.slice(0, 4000)}\n`;
  }

  if (options?.preferredStyle) {
    userMessage += `Preferred style: ${options.preferredStyle}\n`;
  }
  
  userMessage += `\nRequirements:
1. Make the visual concept specific to the chapter title and content excerpt.
2. If the chapter sounds procedural or conceptual, prefer diagram/infographic style.
3. If the chapter sounds scenario-based, prefer a realistic workplace or learning scene.
4. Avoid text-heavy visuals, unrelated nature shots, and generic background art.
5. Keep the composition suitable for a wide 16:9 lesson banner.

Return JSON with keys: "visualBrief", "imagePrompt", and "suggestedStyle"`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = ai.getGenerativeModel({ 
      model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      const result = await model.generateContent(userMessage);
      const response = await result.response;
      let text = (response.text() || "").trim();
      
      // Parse JSON response
      const jsonMatch = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[2]) {
        text = jsonMatch[2];
      }
      
      const parsed = JSON.parse(text);
      return {
        imagePrompt: parsed.imagePrompt || `Educational illustration for ${chapterTitle}`,
        suggestedStyle: parsed.suggestedStyle || options?.preferredStyle || "modern flat illustration",
        visualBrief: parsed.visualBrief || `A chapter-specific educational visual for ${chapterTitle}.`,
      };
    } catch (error: any) {
      console.error(`❌ Image prompt generation attempt ${attempt} failed:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      });
      
      if (attempt < 3 && (error.status >= 500 || error.message?.includes("temporarily unavailable") || error.message?.includes("overloaded"))) {
        const delayMs = attempt * 2000; // 2s, 4s
        await sleep(delayMs);
        continue;
      }
      
      break;
    }
  }

  console.warn('AI image prompt generation failed after all retries. Using fallback prompt.');
  // Fallback: create a basic prompt
  return {
    imagePrompt: `Professional educational illustration representing ${chapterTitle}${moduleTitle ? ` from ${moduleTitle}` : ''}, clean and modern style, suitable for e-learning`,
    suggestedStyle: options?.preferredStyle || "modern flat illustration",
    visualBrief: `A focused educational visual representing ${chapterTitle}${moduleTitle ? ` within ${moduleTitle}` : ""}.`,
  };
}

// Complete chapter image generation with Gemini 2.5 Flash Image
export async function generateCompleteChapterImage(
  chapterTitle: string,
  moduleTitle?: string,
  courseContext?: { title: string; topic: string; objectives: string },
  size: "1024x1024" | "1024x1792" | "1792x1024" = "1792x1024",
  options?: { sourceText?: string; preferredStyle?: string }
): Promise<{
  imageUrl: string;
  imagePrompt: string;
  suggestedStyle: string;
  visualBrief: string;
  chapterTitle: string;
  isAIGenerated: boolean;
}> {
  
  try {
    // Step 1: Generate the image prompt using Gemini (FREE)
    const { imagePrompt, suggestedStyle, visualBrief } = await generateChapterImagePrompt(
      chapterTitle,
      moduleTitle,
      courseContext,
      options,
    );
    
    try {
      // Step 2: Generate actual image with Gemini
      const imageUrl = await generateImageWithGemini(imagePrompt, size);
      
      return {
        imageUrl,
        imagePrompt,
        suggestedStyle,
        visualBrief,
        chapterTitle,
        isAIGenerated: true
      };
    } catch (fluxError: any) {
      console.warn(`Gemini image generation failed (${fluxError.message}), falling back to contextual placeholder`);
      if (false) {
      console.warn(`⚠️  Flux failed (${fluxError.message}), falling back to contextual placeholder`);
      
      }

      // Fallback: Use contextual placeholder based on chapter title
      const [width, height] = size.split('x');
      const placeholderUrl = generateContextualPlaceholder(chapterTitle, `${width}x${height}`);
      
      return {
        imageUrl: placeholderUrl,
        imagePrompt,
        suggestedStyle,
        visualBrief,
        chapterTitle,
        isAIGenerated: false
      };
    }
  } catch (promptError: any) {
    console.warn(`⚠️  Prompt generation failed (${promptError.message}), using basic fallback`);
    
    // Complete fallback: basic prompt and contextual placeholder
    const [width, height] = size.split('x');
    const placeholderUrl = generateContextualPlaceholder(chapterTitle, `${width}x${height}`);
    
    return {
      imageUrl: placeholderUrl,
      imagePrompt: `Educational illustration for ${chapterTitle}`,
      suggestedStyle: options?.preferredStyle || "modern flat illustration",
      visualBrief: `A focused educational visual representing ${chapterTitle}.`,
      chapterTitle,
      isAIGenerated: false
    };
  }
}

// Generate image prompts for all chapters in a course outline
export async function generateImagePromptsForOutline(
  outline: any,
  courseContext: { title: string; topic: string; objectives: string }
): Promise<Map<string, { imagePrompt: string; suggestedStyle: string }>> {
  const imagePrompts = new Map<string, { imagePrompt: string; suggestedStyle: string }>();
  
  if (!outline.modules || !Array.isArray(outline.modules)) {
    return imagePrompts;
  }
  
  // Generate prompts for each chapter
  for (const module of outline.modules) {
    if (module.chapters && Array.isArray(module.chapters)) {
      for (const chapter of module.chapters) {
        try {
          const prompt = await generateChapterImagePrompt(
            chapter.title,
            module.title,
            courseContext
          );
          // Use chapter title as key (will be matched later)
          imagePrompts.set(chapter.title, prompt);
          // Small delay to avoid rate limiting
          await sleep(100);
        } catch (error) {
          console.error(`Failed to generate image prompt for chapter: ${chapter.title}`, error);
        }
      }
    }
  }
  
  return imagePrompts;
}

export async function generateAssignment(
  request: {
    prompt: string;
    difficulty: 'easy' | 'medium' | 'hard';
    taskCount: number;
    assignmentType: 'project' | 'research' | 'practical' | 'reflection' | 'mixed';
    includeRubric: boolean;
  },
  courseContext?: { title: string; topic: string; objectives: string }
): Promise<{ assignment: any; tokensUsed?: number; provider: string; model: string }> {
  const systemPrompt = buildAssignmentSystemPrompt(request, courseContext);
  const userMessage = buildAssignmentUserMessage(request);
  
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = ai.getGenerativeModel({ 
        model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      const result = await model.generateContent(userMessage);
      const response = await result.response;
      let text = (response.text() || "").trim();
      
      // Parse the JSON response
      let assignment;
      try {
        assignment = JSON.parse(text);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          assignment = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("Failed to parse assignment from AI response");
        }
      }
      
      // Validate the structure
      if (!assignment || typeof assignment !== 'object') {
        throw new Error("AI response is not a valid assignment object");
      }
      return {
        assignment,
        tokensUsed: undefined,
        provider: "gemini",
        model: "gemini-flash-latest"
      };
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Assignment generation attempt ${attempt} failed:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      });
      
      if (attempt < 3 && (error.status >= 500 || error.message?.includes("temporarily unavailable") || error.message?.includes("overloaded"))) {
        const delayMs = attempt * 2000; // 2s, 4s
        await sleep(delayMs);
        continue;
      }
      
      break;
    }
  }

  if (lastError) {
    // Handle Gemini-specific errors
    if (lastError.message && lastError.message.includes("API key")) {
      throw new Error("Invalid API key. Please check your Gemini configuration.");
    } else if (lastError.message && lastError.message.includes("quota")) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (lastError.status && lastError.status >= 500) {
      throw new Error("Gemini service is temporarily unavailable. Please try again later.");
    }
    
    throw new Error(`Failed to generate assignment: ${lastError.message || String(lastError)}`);
  }

  throw new Error("Failed to generate assignment after all retries");
}

function buildAssignmentSystemPrompt(
  request: {
    difficulty: 'easy' | 'medium' | 'hard';
    taskCount: number;
    assignmentType: 'project' | 'research' | 'practical' | 'reflection' | 'mixed';
    includeRubric: boolean;
  },
  courseContext?: { title: string; topic: string; objectives: string }
): string {
  let systemPrompt = `You are an expert instructional designer creating educational assignments. 
Your assignments should be clear, engaging, and aligned with course objectives.
Return ONLY a valid JSON object with the following structure:

{
  "title": "Assignment Title",
  "objectives": ["Learning objective 1", "Learning objective 2", "Learning objective 3"],
  "description": "Comprehensive description of the assignment",
  "tasks": [
    {
      "id": "task-1",
      "title": "Task Title",
      "description": "Task description",
      "estimatedTime": "2 hours",
      "requirements": ["Requirement 1", "Requirement 2"]
    }
  ],
  "submissionGuidelines": {
    "format": "File formats and submission method",
    "deadline": "Submission deadline information",
    "instructions": "Detailed submission instructions"
  },
  "rubric": [
    {
      "criterion": "Criterion name",
      "exemplary": "What exemplary performance looks like",
      "proficient": "What proficient performance looks like",
      "developing": "What developing performance looks like",
      "beginning": "What beginning performance looks like",
      "weight": 25
    }
  ],
  "resources": ["Resource 1", "Resource 2"],
  "tips": ["Helpful tip 1", "Helpful tip 2"]
}`;

  if (courseContext) {
    systemPrompt += `\n\nCourse Context:
- Course: ${courseContext.title}
- Topic: ${courseContext.topic}
- Objectives: ${courseContext.objectives}

Ensure the assignment aligns with these course objectives.`;
  }

  return systemPrompt;
}

function buildAssignmentUserMessage(request: {
  prompt: string;
  difficulty: 'easy' | 'medium' | 'hard';
  taskCount: number;
  assignmentType: 'project' | 'research' | 'practical' | 'reflection' | 'mixed';
  includeRubric: boolean;
}): string {
  let userMessage = `Create a ${request.difficulty} difficulty assignment based on: ${request.prompt}\n\n`;
  
  userMessage += `Requirements:
- Assignment Type: ${request.assignmentType}
- Number of Tasks: ${request.taskCount}
- Difficulty Level: ${request.difficulty}
- Include Grading Rubric: ${request.includeRubric ? 'Yes' : 'No'}

Instructions:
1. Create clear, actionable tasks that progressively build on each other
2. Ensure each task has realistic time estimates
3. Include practical requirements for each task
4. Provide comprehensive submission guidelines
5. ${request.includeRubric ? 'Include a detailed rubric with 4 performance levels (exemplary, proficient, developing, beginning) and weights that sum to 100.' : 'Omit rubric section or provide empty array.'}
6. Include helpful resources and tips for students

Return ONLY valid JSON without markdown code blocks.`;

  return userMessage;
}

export async function generateCourseOutline(course: { title: string; topic:string, learningObjectives: string; sourceMaterial?: string }): Promise<any> {
  // Strict response schema to ensure modules -> chapters shape
  const courseOutlineSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      introduction: { type: "string" },
      course_objectives: {
        type: "array",
        items: { type: "string" }
      },
      modules: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            learning_objective: { type: "string" },
            learning_objectives: {
              type: "array",
              items: { type: "string" }
            },
            chapters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" }
                },
                required: ["title"]
              }
            }
          },
          required: ["title", "chapters"]
        }
      }
    },
    required: ["title", "course_objectives", "modules"]
  } as any;

  const systemPrompt = `You are an expert instructional designer. Create a course outline based on the provided topic, learning objectives, and any supplied source material. Return only JSON matching the provided schema. Include clear course_objectives for the full course and learning_objectives for every module. Keep module and chapter titles concise and instructional. Derive the structure from the source material when it is provided, and avoid generic placeholder labels.`;

  const maxRetries = 3;
  const retryDelays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = ai.getGenerativeModel({ 
        model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: courseOutlineSchema
        }
      });
      
      const sourceMaterial = String(course.sourceMaterial || "").trim();
      const sourceExcerpt = sourceMaterial ? sourceMaterial.slice(0, 60000) : "";
      const result = await model.generateContent(`Course Topic: ${course.topic}\nLearning Objectives: ${course.learningObjectives}\nCourse Title: ${course.title}${sourceExcerpt ? `\nSource Material:\n${sourceExcerpt}` : ""}`);
      const response = await result.response;

      let text = (response.text() || "").trim();
      // Some providers wrap JSON in code fences
      const jsonMatch = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[2]) {
        text = jsonMatch[2];
      }

      let outline = JSON.parse(text);

      const normalizedCourseObjectives = Array.isArray(outline.course_objectives)
        ? outline.course_objectives.map((objective: unknown) => normalizeObjectiveText(String(objective || ""))).filter(Boolean)
        : [];
      const fallbackCourseObjectives = buildCourseObjectives(course.topic, parseSeedObjectives(course.learningObjectives));
      const seededCourseObjectives = normalizedCourseObjectives.length > 0
        ? normalizedCourseObjectives
        : fallbackCourseObjectives;

      // Post-process to guarantee exactly 6 modules and 3 chapters each with relevant titles/objectives
      const targetModules = 6;
      const targetChapters = 3;
      outline.modules = Array.from({ length: targetModules }, (_v, i) => {
        const source = (outline.modules && outline.modules[i]) || {};
        const seededObjective = seededCourseObjectives[i % seededCourseObjectives.length] || `Explain the key ideas in ${course.topic}`;
        const moduleObjectives = Array.isArray(source.learning_objectives)
          ? source.learning_objectives.map((objective: unknown) => normalizeObjectiveText(String(objective || ""))).filter(Boolean)
          : [];
        const learning_objective = normalizeObjectiveText(source.learning_objective || moduleObjectives[0] || seededObjective);
        const rawTitle = normalizeObjectiveText(source.title || "");
        const title = rawTitle && !isGenericModuleTitle(rawTitle)
          ? rawTitle
          : buildModuleTitle(course.topic, learning_objective, i);
        const chapters = Array.from({ length: targetChapters }, (_c, j) => {
          const srcChapter = (source.chapters && source.chapters[j]) || {};
          const rawChapterTitle = normalizeObjectiveText(srcChapter.title || "");
          return {
            title: rawChapterTitle && !isGenericLessonTitle(rawChapterTitle)
              ? rawChapterTitle
              : buildChapterTitle(title, learning_objective, j),
            description: srcChapter.description || ""
          };
        });
        return {
          title,
          learning_objective,
          learning_objectives: moduleObjectives.length > 0 ? moduleObjectives : buildModuleObjectives(course.topic, title, learning_objective, i),
          chapters
        };
      });

      outline.title = outline.title || course.title || "New Course";
      outline.introduction = outline.introduction || "";
      outline.course_objectives = Array.isArray(outline.course_objectives)
        ? outline.course_objectives.map((objective: unknown) => String(objective || "").trim()).filter(Boolean)
        : course.learningObjectives
            .split(/\r?\n/)
            .map((objective) => objective.replace(/^[-*•\s]+/, "").trim())
            .filter(Boolean);
      outline.course_objectives = seededCourseObjectives;
      outline._meta = {
        source: "ai",
        model: "gemini-flash-latest",
        attempts: attempt + 1,
      };
      return outline;
      
    } catch (error: any) {
      console.error(`AI outline generation failed on attempt ${attempt + 1}:`, {
        message: error?.message || String(error),
        status: error?.status,
        statusText: error?.statusText,
        errorDetails: error?.errorDetails,
        stack: error?.stack,
      });
      const isLastAttempt = attempt === maxRetries - 1;
      const errorMessage = error.message || String(error);
      
      // Check if it's a retryable error (503, 429, or overloaded)
      const isRetryable = 
        errorMessage.includes('503') || 
        errorMessage.includes('overloaded') ||
        errorMessage.includes('429') ||
        errorMessage.includes('UNAVAILABLE') ||
        (error.status && (error.status === 503 || error.status === 429));
      
      if (isRetryable && !isLastAttempt) {
        let delayMs = retryDelays[attempt];
        // Check for specific retry-after header or error detail
        if (error.errorDetails && Array.isArray(error.errorDetails)) {
          const retryInfo = error.errorDetails.find((detail: any) => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          if (retryInfo && retryInfo.retryDelay) {
            const delaySeconds = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
            if (!isNaN(delaySeconds)) {
              delayMs = delaySeconds * 1000;
            }
          }
        }
        await sleep(delayMs);
        continue;
      }
      
      // If all retries failed or non-retryable error, use fallback
      console.warn(`AI outline generation failed after ${attempt + 1} attempts. Using fallback outline. Reason: ${errorMessage}`);
      const fallback = createRelevantFallbackOutline(course);
      fallback._meta = {
        source: "fallback",
        reason: errorMessage,
        attempts: attempt + 1,
        model: "gemini-flash-latest",
      };
      return fallback;
    }
  }
  
  // Fallback in case loop completes without returning
  const fallback = createRelevantFallbackOutline(course);
  fallback._meta = {
    source: "fallback",
    reason: "Outline generation loop completed without AI result",
    attempts: maxRetries,
    model: "gemini-flash-latest",
  };
  return fallback;
}

// Tavus.io Video Generation Service
export async function generateVideoWithTavus(
  request: AiGenerateVideoRequest,
  courseContext?: { title: string; topic: string; objectives: string }
): Promise<{
  videoUrl: string;
  videoId: string;
  prompt: string;
  duration: number;
  status: string;
  isAIGenerated: boolean;
}> {
  const tavusApiKey = process.env.TAVUS_API_KEY;
  const tavusReplicaId = process.env.TAVUS_REPLICA_ID;
  
  if (!tavusApiKey) {
    console.warn("⚠️  TAVUS_API_KEY not found. Video generation unavailable.");
    throw new Error("Tavus API key not configured");
  }

  if (!tavusReplicaId) {
    console.warn("⚠️  TAVUS_REPLICA_ID not found. Video generation unavailable.");
    throw new Error("Tavus replica ID not configured");
  }
  
  // Build enhanced prompt with course context
  let enhancedPrompt = request.prompt;
  if (request.includeCourseContext && courseContext) {
    enhancedPrompt = `Course: ${courseContext.title}
Topic: ${courseContext.topic}

Video Content: ${request.prompt}`;
  }
  
  // Convert duration enum to seconds
  const durationMap = {
    'short': 5,
    'medium': 10,
    'long': 15
  };
  const durationSeconds = durationMap[request.duration];
  const maxWordCount = Math.max(8, Math.floor(durationSeconds * 2.2));
  const condensedScript = enhancedPrompt
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, maxWordCount)
    .join(" ");
  
  try {
    console.log(`🎥 Starting Tavus video generation...`);
    
    // Create video generation request
    const response = await fetch('https://tavusapi.com/v2/videos', {
      method: 'POST',
      headers: {
        'x-api-key': tavusApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        script: condensedScript,
        replica_id: tavusReplicaId,
        video_name: `Course Video - ${Date.now()}`,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Tavus API Error:", errorData);
      
      if (response.status === 401) {
        throw new Error("Invalid Tavus API key");
      } else if (response.status === 402) {
        throw new Error("Insufficient credits for Tavus API");
      } else if (response.status === 429) {
        throw new Error("Rate limit exceeded for Tavus API");
      } else {
        throw new Error(`Tavus API error: ${response.status} - ${errorData?.message || 'Unknown error'}`);
      }
    }
    
    const data = await response.json();
    const videoId = data.video_id;
    
    if (!videoId) {
      throw new Error("No video ID returned from Tavus API");
    }
    
    console.log(`🔄 Polling Tavus API for video generation (ID: ${videoId})...`);
    
    // Poll for video completion
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max wait time (5s intervals)
    
    while (attempts < maxAttempts) {
      await sleep(5000); // Wait 5 seconds between polls
      attempts++;
      
      try {
        const statusResponse = await fetch(`https://tavusapi.com/v2/videos/${videoId}`, {
          headers: {
            'x-api-key': tavusApiKey,
          },
        });
        
        if (!statusResponse.ok) {
          console.error(`Video status polling failed: ${statusResponse.status}`);
          continue;
        }
        
        const statusData = await statusResponse.json();
        
        if (statusData.status === 'ready') {
          const videoUrl = statusData.download_url || statusData.hosted_url;
          if (!videoUrl) {
            throw new Error("No video URL in completed response from Tavus API");
          }
          
          console.log(`✅ Tavus video generated successfully in ${attempts * 5} seconds`);
          return {
            videoUrl,
            videoId,
            prompt: condensedScript,
            duration: durationSeconds,
            status: 'completed',
            isAIGenerated: true
          };
        } else if (statusData.status === 'error') {
          throw new Error(`Tavus video generation failed: ${statusData.status_details || statusData.error_message || 'Unknown error'}`);
        }
        
        // Status is still pending, continue polling.
        if (attempts % 12 === 0) { // Every minute
          console.log(`⏳ Video still generating... (${Math.floor(attempts * 5 / 60)}m ${(attempts * 5) % 60}s elapsed, status: ${statusData.status})`);
        }
        
      } catch (pollError: any) {
        console.error(`Video polling attempt ${attempts} failed:`, pollError.message);
        if (attempts >= maxAttempts - 1) {
          throw pollError;
        }
      }
    }
    
    throw new Error(`Tavus video generation timed out after ${maxAttempts * 5 / 60} minutes`);
    
  } catch (error: any) {
    console.error("❌ Tavus video generation failed:", error.message);
    throw error;
  }
}

// Generate video prompt using Gemini for better video descriptions
export async function generateVideoPrompt(
  chapterTitle: string,
  moduleTitle?: string,
  courseContext?: { title: string; topic: string; objectives: string },
  options?: { sourceText?: string; duration?: string; style?: string }
): Promise<{ videoPrompt: string; suggestedNarration: string; keyPoints: string[] }> {
  const systemPrompt = `You are an expert educational video script writer and instructional designer.
Create a detailed video script and narration for educational content.
The video should be engaging, informative, and appropriate for the specified duration.
Return JSON only with keys:
- videoPrompt: A detailed description of visual elements and scenes for the video
- suggestedNarration: The actual script/narration text for the video
- keyPoints: An array of 3-5 key learning points the video should cover`;

  let userMessage = `Create a video script and visual description for an educational video with the following details:\n\n`;
  userMessage += `Chapter Title: ${chapterTitle}\n`;
  
  if (moduleTitle) {
    userMessage += `Module: ${moduleTitle}\n`;
  }
  
  if (courseContext) {
    userMessage += `Course: ${courseContext.title}\n`;
    userMessage += `Topic: ${courseContext.topic}\n`;
    userMessage += `Objectives: ${courseContext.objectives}\n`;
  }

  if (options?.sourceText) {
    userMessage += `Chapter content excerpt: ${options.sourceText.slice(0, 3000)}\n`;
  }

  if (options?.duration) {
    const durationText = options.duration === 'short' ? '5 seconds' : 
                        options.duration === 'medium' ? '10 seconds' : '15 seconds';
    userMessage += `Target Duration: ${durationText}\n`;
  }

  if (options?.style) {
    userMessage += `Video Style: ${options.style}\n`;
  }
  
  userMessage += `\nRequirements:
1. Create engaging narration appropriate for the target duration
2. Describe visual elements that support the educational content
3. Include clear learning objectives and key takeaways
4. Make the content accessible and easy to understand
5. Structure the script with clear introduction, main content, and conclusion
6. Keep the narration concise enough to fit fully within the requested duration and never exceed 15 seconds

Return JSON with keys: "videoPrompt", "suggestedNarration", and "keyPoints"`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = ai.getGenerativeModel({ 
        model: "gemini-flash-latest",
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });
      
      const result = await model.generateContent(userMessage);
      const response = await result.response;
      let text = (response.text() || "").trim();
      
      // Parse JSON response
      const jsonMatch = text.match(/```(json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[2]) {
        text = jsonMatch[2];
      }
      
      const parsed = JSON.parse(text);
      return {
        videoPrompt: parsed.videoPrompt || `Educational video about ${chapterTitle}`,
        suggestedNarration: parsed.suggestedNarration || `Learn about ${chapterTitle} in this educational video.`,
        keyPoints: parsed.keyPoints || [`Understanding ${chapterTitle}`, "Key concepts and principles", "Practical applications"]
      };
    } catch (error: any) {
      console.error(`❌ Video prompt generation attempt ${attempt} failed:`, {
        message: error.message,
        status: error.status,
        statusText: error.statusText
      });
      
      if (attempt < 3 && (error.status >= 500 || error.message?.includes("temporarily unavailable") || error.message?.includes("overloaded"))) {
        const delayMs = attempt * 2000; // 2s, 4s
        await sleep(delayMs);
        continue;
      }
      
      break;
    }
  }

  console.warn('AI video prompt generation failed after all retries. Using fallback prompt.');
  // Fallback: create a basic prompt
  return {
    videoPrompt: `Educational video explaining ${chapterTitle}${moduleTitle ? ` from ${moduleTitle}` : ''}, featuring clear narration and supporting visuals`,
    suggestedNarration: `Welcome to this educational video about ${chapterTitle}. In this video, we'll explore the key concepts and help you understand the important principles.`,
    keyPoints: [`Understanding ${chapterTitle}`, "Key concepts and principles", "Practical applications"]
  };
}

// Complete video generation with enhanced prompting
export async function generateCompleteVideo(
  chapterTitle: string,
  moduleTitle?: string,
  courseContext?: { title: string; topic: string; objectives: string },
  options?: { 
    sourceText?: string; 
    duration?: 'short' | 'medium' | 'long';
    style?: 'professional' | 'casual' | 'educational' | 'animated';
    voiceType?: 'male' | 'female' | 'neutral';
    aspectRatio?: '16:9' | '9:16' | '1:1';
  }
): Promise<{
  videoUrl: string;
  videoId: string;
  videoPrompt: string;
  suggestedNarration: string;
  keyPoints: string[];
  chapterTitle: string;
  isAIGenerated: boolean;
}> {
  
  try {
    // Step 1: Generate enhanced video prompt and narration using Gemini
    const { videoPrompt, suggestedNarration, keyPoints } = await generateVideoPrompt(
      chapterTitle,
      moduleTitle,
      courseContext,
      options
    );
    
    // Step 2: Generate actual video with Tavus
    const videoRequest: AiGenerateVideoRequest = {
      moduleId: 'temp', // This will be provided by the API call
      prompt: suggestedNarration, // Use the generated narration as the script
      duration: options?.duration || 'medium',
      style: options?.style || 'educational',
      voiceType: options?.voiceType || 'neutral',
      language: 'en',
      aspectRatio: options?.aspectRatio || '16:9',
      includeCourseContext: true,
      backgroundMusic: false
    };
    
    const videoResult = await generateVideoWithTavus(videoRequest, courseContext);
    
    return {
      ...videoResult,
      videoPrompt,
      suggestedNarration,
      keyPoints,
      chapterTitle
    };
    
  } catch (error: any) {
    console.error("❌ Complete video generation failed:", error.message);
    throw error;
  }
}

