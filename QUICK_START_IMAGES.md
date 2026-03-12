# Quick Start: AI-Generated Chapter Images

## What's New?

Your OpusAuthoring system now includes **AI-powered image generation** for course chapters! 🎨

The system automatically creates contextually relevant image prompts that can be used with popular AI image generation services.

## How to Use (3 Simple Steps)

### Step 1: Generate an Image Prompt

Make a POST request to generate an image prompt for your chapter:

```bash
curl -X POST http://localhost:5000/api/ai/generate-chapter-image-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "chapterTitle": "Introduction to Neural Networks",
    "moduleTitle": "Deep Learning Basics",
    "courseId": "your-course-id-here"
  }'
```

**Response:**
```json
{
  "imagePrompt": "Educational illustration depicting a neural network...",
  "suggestedStyle": "modern flat illustration"
}
```

### Step 2: Generate the Image

Use the prompt with your favorite AI image service:

**Option A: DALL-E (OpenAI)**
- Copy the `imagePrompt` value
- Go to https://labs.openai.com or use the API
- Paste the prompt and generate

**Option B: Other Services**
- Midjourney: Use `/imagine` command with the prompt
- Stable Diffusion: Use the prompt in your preferred interface
- Leonardo.ai, Playground AI, etc.

### Step 3: Save to Your Course

After generating the image:
1. Download the image
2. Upload it to your course via the media assets endpoint
3. Associate it with the chapter as a thumbnail

## Test It Now

We've included a test script:

```bash
# Start your server
npm run dev

# Run the test (in a new terminal)
node test-image-generation.js
```

This will generate sample image prompts for different chapter types.

## Integration Example

Here's how to integrate this into your workflow:

```javascript
// 1. Create a course and generate outline
const course = await createCourse({ /* ... */ });
await generateCourseOutline(course.id);

// 2. For each chapter, generate image prompt
const chapters = await getChapters(course.id);

for (const chapter of chapters) {
  // Generate prompt
  const { imagePrompt, suggestedStyle } = await fetch('/api/ai/generate-chapter-image-prompt', {
    method: 'POST',
    body: JSON.stringify({
      chapterTitle: chapter.title,
      moduleTitle: chapter.module.title,
      courseId: course.id
    })
  }).then(r => r.json());
  
  // Use with your image service
  console.log(`Prompt for ${chapter.title}: ${imagePrompt}`);
}
```

## Benefits

✅ **Contextually Relevant**: Images match the chapter content  
✅ **Professional Quality**: Educational-focused prompts  
✅ **Time-Saving**: No need to write image prompts manually  
✅ **Flexible**: Works with any AI image generation service  
✅ **Smart Styling**: Suggests appropriate visual styles  

## What Gets Generated?

The AI analyzes:
- Chapter title
- Module context
- Course topic and objectives

And creates:
- Detailed image description (2-3 sentences)
- Style recommendation (flat illustration, diagram, photorealistic, etc.)
- Educational-appropriate visual elements

## Example Output

**Input:**
```json
{
  "chapterTitle": "Wave-Particle Duality",
  "moduleTitle": "Quantum Mechanics Fundamentals"
}
```

**Output:**
```json
{
  "imagePrompt": "Educational illustration showing the wave-particle duality concept in quantum physics. Split composition with left side showing wave interference patterns and right side showing discrete particles. Clean scientific style with blue and purple colors, mathematical symbols, and clear labels for educational materials.",
  "suggestedStyle": "modern flat illustration"
}
```

## Need More Help?

📖 **Full Documentation**: See `AI_IMAGE_GENERATION_GUIDE.md`  
🧪 **Test Script**: Run `node test-image-generation.js`  
💡 **Examples**: Check the guide for complete workflows  

## API Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/generate-chapter-image-prompt` | POST | Generate image prompt for a chapter |

**Request Body:**
```typescript
{
  chapterTitle: string;      // Required
  moduleTitle?: string;      // Optional but recommended
  courseId?: string;         // Optional but provides better context
}
```

**Response:**
```typescript
{
  imagePrompt: string;       // Detailed image generation prompt
  suggestedStyle: string;    // Recommended visual style
}
```

## Tips for Best Results

1. **Use Descriptive Titles**: "Introduction to Neural Networks" > "Chapter 1"
2. **Include Course Context**: Pass the `courseId` for more relevant prompts
3. **Customize as Needed**: Feel free to modify the AI-generated prompts
4. **Choose the Right Service**: Different AI services excel at different styles

## What's Next?

Future enhancements planned:
- Direct image generation (one API call)
- Batch processing for entire courses
- Image library with pre-generated educational images
- Custom style templates

---

**Ready to try it?** Start your server and run the test script! 🚀

```bash
npm run dev
# In another terminal:
node test-image-generation.js
```
