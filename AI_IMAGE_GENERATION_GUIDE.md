# AI Image Generation for Chapters

## Overview

This feature automatically generates contextually relevant image prompts for course chapters using AI. These prompts can be used with image generation services like DALL-E, Midjourney, or Stable Diffusion to create professional educational images.

## How It Works

1. **AI Analysis**: The system analyzes the chapter title, module context, and course information
2. **Prompt Generation**: Creates a detailed, professional image generation prompt tailored to the educational content
3. **Style Suggestion**: Recommends an appropriate visual style (e.g., "modern flat illustration", "photorealistic", "minimalist diagram")
4. **Integration Ready**: The generated prompts can be used with any AI image generation service

## API Endpoints

### Generate Image Prompt for a Single Chapter

**Endpoint**: `POST /api/ai/generate-chapter-image-prompt`

**Request Body**:
```json
{
  "chapterTitle": "Introduction to Quantum Mechanics",
  "moduleTitle": "Foundations of Physics",
  "courseId": "abc123-course-id"
}
```

**Response**:
```json
{
  "imagePrompt": "Educational illustration showing quantum mechanics concepts with wave-particle duality visualization, featuring abstract particles, wave patterns, and scientific diagrams in a clear, professional style suitable for learning materials",
  "suggestedStyle": "modern flat illustration"
}
```

### Example Usage with cURL

```bash
# Generate image prompt for a chapter
curl -X POST http://localhost:5000/api/ai/generate-chapter-image-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "chapterTitle": "Classical vs. Quantum Computing",
    "moduleTitle": "MODULE 1: Foundations of Quantum Mechanics",
    "courseId": "your-course-id"
  }'
```

## Integration with Image Generation Services

### Option 1: DALL-E (OpenAI)

Once you have the image prompt, you can use it with DALL-E:

```javascript
// Example using OpenAI API
const response = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "dall-e-3",
    prompt: imagePrompt,
    size: "1024x1024",
    quality: "standard",
    n: 1
  })
});

const data = await response.json();
const imageUrl = data.data[0].url;
```

### Option 2: Stable Diffusion

```python
# Example using Stability AI API
import stability_sdk

stability_api = stability_sdk.client.StabilityInference(
    key=os.environ.get("STABILITY_KEY")
)

answers = stability_api.generate(
    prompt=image_prompt,
    width=1024,
    height=576
)

for resp in answers:
    for artifact in resp.artifacts:
        if artifact.type == generation.ARTIFACT_IMAGE:
            img = Image.open(io.BytesIO(artifact.binary))
            img.save("chapter_image.png")
```

### Option 3: Midjourney (via API wrapper)

```javascript
// Using unofficial Midjourney API
const { Midjourney } = require('midjourney');

const client = new Midjourney({
  ServerId: YOUR_SERVER_ID,
  ChannelId: YOUR_CHANNEL_ID,
  SalaiToken: YOUR_SALAI_TOKEN,
});

await client.Connect();
const msg = await client.Imagine(imagePrompt);
```

## Automatic Image Generation During Course Outline Creation

You can extend the course outline generation to automatically create image prompts:

```javascript
// In your course creation workflow
const outline = await generateCourseOutline(course);

// Generate image prompts for all chapters
const imagePrompts = await generateImagePromptsForOutline(outline, {
  title: course.title,
  topic: course.topic,
  objectives: course.learningObjectives
});

// Use the prompts to generate actual images
for (const [chapterTitle, prompt] of imagePrompts.entries()) {
  console.log(`Chapter: ${chapterTitle}`);
  console.log(`Prompt: ${prompt.imagePrompt}`);
  console.log(`Style: ${prompt.suggestedStyle}`);
  
  // Generate actual image using your preferred service
  // const imageUrl = await generateImageWithDALLE(prompt.imagePrompt);
  // await saveChapterImage(chapterTitle, imageUrl);
}
```

## Visual Style Options

The AI suggests appropriate styles based on content. Common styles include:

- **Modern Flat Illustration**: Clean, vector-style graphics ideal for concepts
- **Photorealistic**: Realistic imagery for tangible subjects
- **Minimalist Diagram**: Simple, focused diagrams for technical content
- **3D Render**: Three-dimensional visualizations for spatial concepts
- **Infographic Style**: Data-driven, chart-based visuals
- **Hand-drawn**: Friendly, approachable sketched style
- **Abstract Art**: Conceptual, artistic representations

## Best Practices

### 1. **Chapter Naming**
Use descriptive chapter titles for better image prompts:
- ✅ Good: "Wave-Particle Duality in Quantum Physics"
- ❌ Poor: "Chapter 3"

### 2. **Provide Context**
Always include courseId to get better contextually relevant prompts

### 3. **Review Before Generation**
Check the generated prompt before sending it to image generation services to ensure it matches your vision

### 4. **Customize Prompts**
Feel free to enhance the AI-generated prompt with additional details:
```javascript
const result = await generateChapterImagePrompt("Introduction to AI");
const customPrompt = `${result.imagePrompt}, vibrant colors, educational textbook style`;
```

### 5. **Store Generated Images**
Save generated images to your media assets:
```javascript
const imageUrl = await generateImage(prompt);

await storage.createMediaAsset({
  courseId: courseId,
  filename: `chapter-${chapterId}.png`,
  originalName: `${chapterTitle}.png`,
  mimetype: 'image/png',
  size: imageSize.toString(),
  assetType: 'image',
  metadata: {
    altText: chapterTitle,
    width: 1024,
    height: 576
  }
});
```

## Example Workflow

Here's a complete workflow for generating and using chapter images:

```javascript
// 1. Create a course
const course = await createCourse({
  title: "Introduction to Quantum Computing",
  topic: "Quantum Computing Fundamentals",
  targetAudience: "Computer Science Students",
  learningObjectives: "Understand quantum computing principles",
  difficulty: "Intermediate"
});

// 2. Generate course outline
const outline = await generateCourseOutline(course);

// 3. For each chapter, generate image prompt
for (const module of outline.modules) {
  for (const chapter of module.chapters) {
    // Generate image prompt
    const imagePrompt = await fetch('/api/ai/generate-chapter-image-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterTitle: chapter.title,
        moduleTitle: module.title,
        courseId: course.id
      })
    }).then(r => r.json());
    
    console.log(`📸 Image prompt for "${chapter.title}":`, imagePrompt.imagePrompt);
    
    // 4. Generate actual image (using your preferred service)
    // const imageUrl = await generateImageWithService(imagePrompt.imagePrompt);
    
    // 5. Store image reference
    // chapter.thumbnail = imageUrl;
  }
}
```

## Error Handling

The system includes fallback mechanisms:

```javascript
try {
  const prompt = await generateChapterImagePrompt(title, module, context);
  // Use the AI-generated prompt
} catch (error) {
  // Fallback to basic prompt
  const fallbackPrompt = `Professional educational illustration for ${title}`;
}
```

## Configuration

### Rate Limiting
- The system includes built-in rate limiting (30 requests per minute)
- Prompts are generated with small delays to avoid overwhelming the AI service

### AI Model
- Currently uses **Gemini 2.5 Flash** for prompt generation
- Optimized for educational content
- Fast response times (typically < 2 seconds)

## Future Enhancements

Planned improvements:

1. **Direct Image Generation**: Integration with DALL-E API for one-click image creation
2. **Batch Processing**: Generate images for all chapters at once
3. **Image Library**: Pre-generated educational images database
4. **Custom Styles**: User-defined visual style templates
5. **A/B Testing**: Generate multiple image variants for each chapter

## Troubleshooting

### Issue: Prompts are too generic
**Solution**: Provide more detailed chapter titles and ensure courseId is included

### Issue: Style doesn't match expectations
**Solution**: Manually specify a style preference in the generated prompt

### Issue: Rate limit errors
**Solution**: Add delays between requests or batch process during off-peak hours

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/generate-chapter-image-prompt` | POST | Generate image prompt for single chapter |
| `/api/courses/:id/generate-outline` | POST | Generate course outline (can be extended for images) |
| `/api/courses/:courseId/media-assets` | POST | Store generated images |

## Support

For questions or issues with the AI image generation feature, check:
- The main `COURSE_OUTLINE_README.md` for course structure
- `server/ai-service.ts` for implementation details
- `server/routes.ts` for API endpoint definitions

## Example Output

Here's what a typical image prompt looks like:

**Chapter**: "Introduction to Neural Networks"  
**Module**: "Deep Learning Fundamentals"  
**Generated Prompt**:
```
"Educational illustration depicting a neural network architecture with 
interconnected nodes and layers, showing input layer, hidden layers, and 
output layer. Clean, professional diagram style with labeled components, 
arrows showing data flow, and mathematical symbols. Modern tech aesthetic 
suitable for computer science education, vibrant blue and purple color 
scheme, high contrast for clarity."
```
**Style**: "modern flat illustration"

This prompt would generate a clear, professional image perfect for your course content!
