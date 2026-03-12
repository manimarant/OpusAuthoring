/**
 * Utility functions for contextual image generation
 * Provides both AI image generation and contextual placeholder fallbacks
 */

const API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

export interface GeneratedImageResult {
  imageUrl: string;
  imagePrompt: string;
  suggestedStyle: string;
  chapterTitle: string;
  isAIGenerated: boolean;
}

/**
 * Generate a contextual image for a chapter using AI or fallback to contextual placeholder
 */
export async function generateChapterImage(
  chapterTitle: string,
  moduleTitle?: string,
  courseId?: string,
  size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024"
): Promise<GeneratedImageResult> {
  try {
    const response = await fetch(`${API_BASE}/ai/generate-chapter-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chapterTitle,
        moduleTitle,
        courseId,
        size
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to generate image');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.warn('AI image generation failed, using local contextual placeholder:', error);
    
    // Fallback: generate local contextual placeholder
    const placeholderUrl = generateContextualPlaceholderUrl(chapterTitle, size);
    
    return {
      imageUrl: placeholderUrl,
      imagePrompt: `Educational illustration for ${chapterTitle}`,
      suggestedStyle: 'modern flat illustration',
      chapterTitle,
      isAIGenerated: false
    };
  }
}

/**
 * Generate a deterministic placeholder URL based on content title
 */
export function generateContextualPlaceholderUrl(
  title: string, 
  size: "1024x1024" | "1024x1792" | "1792x1024" | string = "800x400"
): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  const seed = Math.abs(hash) % 10000;
  let dimensions = size;
  if (size === "1024x1024" || size === "1024x1792" || size === "1792x1024") {
    dimensions = size === "1024x1792" ? "800x1200" : 
                 size === "1792x1024" ? "1200x800" : 
                 "800x800";
  }

  const [widthRaw, heightRaw] = String(dimensions).split("x");
  const width = Math.max(Number(widthRaw) || 800, 320);
  const height = Math.max(Number(heightRaw) || 400, 180);
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/**
 * Batch generate images for multiple chapters
 */
export async function batchGenerateChapterImages(
  chapters: { title: string; moduleTitle?: string }[],
  courseId?: string,
  size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024",
  onProgress?: (completed: number, total: number) => void
): Promise<GeneratedImageResult[]> {
  const results: GeneratedImageResult[] = [];
  
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    
    try {
      const result = await generateChapterImage(
        chapter.title,
        chapter.moduleTitle,
        courseId,
        size
      );
      
      results.push(result);
      
      // Call progress callback
      if (onProgress) {
        onProgress(i + 1, chapters.length);
      }
      
      // Small delay to avoid rate limits
      if (i < chapters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Failed to generate image for chapter "${chapter.title}":`, error);
      
      // Add fallback result
      results.push({
        imageUrl: generateContextualPlaceholderUrl(chapter.title, size),
        imagePrompt: `Educational illustration for ${chapter.title}`,
        suggestedStyle: 'modern flat illustration',
        chapterTitle: chapter.title,
        isAIGenerated: false
      });
    }
  }
  
  return results;
}

/**
 * Check if an image URL is a placeholder
 */
export function isPlaceholderImage(url: string): boolean {
  return url.startsWith('data:image/svg+xml') || url.includes('picsum.photos') || url.includes('placeholder');
}

/**
 * Get image display properties for UI components
 */
export function getImageDisplayProps(
  content: any,
  fallbackTitle: string = 'Content'
): {
  url: string;
  alt: string;
  isPlaceholder: boolean;
  caption?: string;
} {
  const url = content.url || generateContextualPlaceholderUrl(fallbackTitle);
  const isPlaceholder = content.isPlaceholder || isPlaceholderImage(url);
  
  return {
    url,
    alt: content.alt || fallbackTitle,
    isPlaceholder,
    caption: content.caption
  };
}
