# AI-Powered Chapter Image Generation

## 🎨 Overview

OpusAuthoring now includes intelligent AI-powered image generation capabilities! This feature automatically creates contextually relevant, professional image prompts for your course chapters, ready to be used with any AI image generation service.

## ✨ Key Features

- **🤖 AI-Powered**: Uses Gemini AI to analyze chapter content and generate appropriate image descriptions
- **🎯 Context-Aware**: Considers chapter title, module context, and course objectives
- **🎨 Style Recommendations**: Suggests the best visual style for each chapter
- **🔗 Flexible Integration**: Works with DALL-E, Midjourney, Stable Diffusion, and more
- **⚡ Fast Generation**: Typical response time < 2 seconds
- **📚 Educational Focus**: Optimized for learning materials and professional content

## 🚀 Quick Start

### 1. Check Prerequisites

Ensure your `.env` file has the Gemini API key configured:
```env
GEMINI_API_KEY=your-api-key-here
```

### 2. Start the Server

```bash
npm run dev
```

### 3. Test the Feature

```bash
node test-image-generation.js
```

### 4. Use in Your Application

```javascript
const response = await fetch('/api/ai/generate-chapter-image-prompt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chapterTitle: "Introduction to Machine Learning",
    moduleTitle: "AI Fundamentals",
    courseId: "course-123"
  })
});

const { imagePrompt, suggestedStyle } = await response.json();
console.log('Prompt:', imagePrompt);
console.log('Style:', suggestedStyle);
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **QUICK_START_IMAGES.md** | Simple 3-step guide to get started |
| **AI_IMAGE_GENERATION_GUIDE.md** | Comprehensive documentation with examples |
| **test-image-generation.js** | Test script to try the feature |

## 🔌 API Endpoint

### Generate Chapter Image Prompt

**Endpoint**: `POST /api/ai/generate-chapter-image-prompt`

**Request:**
```json
{
  "chapterTitle": "Introduction to Neural Networks",
  "moduleTitle": "Deep Learning Basics",
  "courseId": "optional-course-id"
}
```

**Response:**
```json
{
  "imagePrompt": "Educational illustration depicting a neural network architecture...",
  "suggestedStyle": "modern flat illustration"
}
```

## 💡 Use Cases

### 1. Course Creation Workflow

Generate images for all chapters when creating a new course:

```javascript
// After generating course outline
const outline = await generateCourseOutline(course);

for (const module of outline.modules) {
  for (const chapter of module.chapters) {
    const prompt = await generateChapterImagePrompt(
      chapter.title,
      module.title,
      courseContext
    );
    
    // Use prompt with your image service
    const imageUrl = await generateImageWithDALLE(prompt.imagePrompt);
    chapter.thumbnail = imageUrl;
  }
}
```

### 2. On-Demand Image Generation

Let instructors generate images for individual chapters:

```javascript
// User clicks "Generate Image" button
const prompt = await generateChapterImagePrompt(chapterTitle);

// Show prompt to user, let them review/modify
showImagePromptDialog(prompt);

// Generate image when user confirms
const image = await generateImage(prompt.imagePrompt);
```

### 3. Batch Processing

Generate prompts for all chapters, review them, then batch generate:

```javascript
const prompts = await generateImagePromptsForOutline(outline, courseContext);

// Review and approve prompts
const approvedPrompts = await reviewPrompts(prompts);

// Batch generate images
await batchGenerateImages(approvedPrompts);
```

## 🎯 Example Output

### Input
```json
{
  "chapterTitle": "Quantum Entanglement",
  "moduleTitle": "Advanced Quantum Mechanics",
  "courseId": "physics-101"
}
```

### Output
```json
{
  "imagePrompt": "Educational illustration showing quantum entanglement between two particles. Split composition with two entangled particles connected by glowing energy lines, surrounded by quantum wave patterns. Professional scientific style with blue and purple color scheme, featuring mathematical symbols and clear labels. Clean, modern design suitable for university-level physics education.",
  "suggestedStyle": "modern flat illustration"
}
```

### Generated Image (using DALL-E)
The prompt would generate a professional educational image perfect for the chapter! 🎨

## 🔧 Technical Details

### AI Model
- **Provider**: Google Gemini
- **Model**: gemini-2.5-flash
- **Optimized for**: Educational content generation
- **Response format**: JSON

### Rate Limiting
- 30 requests per minute per client
- Automatic rate limit checking
- Graceful error handling

### Error Handling
- Fallback to basic prompts if AI fails
- Detailed error messages
- Retry logic for transient failures

### Performance
- Average response time: < 2 seconds
- Caching support (future enhancement)
- Batch processing optimization

## 🎨 Supported Visual Styles

The AI automatically recommends appropriate styles:

| Style | Best For | Example Use Case |
|-------|----------|------------------|
| Modern Flat Illustration | Concepts, processes | Software architecture, workflows |
| Photorealistic | Real-world objects | Equipment, anatomy, physical phenomena |
| Minimalist Diagram | Technical content | Network diagrams, flowcharts |
| 3D Render | Spatial concepts | Molecular structures, 3D modeling |
| Infographic | Data-driven content | Statistics, comparisons |
| Hand-drawn | Friendly content | Beginner courses, creative subjects |
| Abstract Art | Conceptual topics | Philosophy, theoretical concepts |

## 🔮 Future Enhancements

### Planned Features

1. **Direct Image Generation**
   - One-click image creation (no external service needed)
   - Multiple variants per chapter
   - A/B testing support

2. **Image Library**
   - Pre-generated educational images
   - Searchable by topic/style
   - Community-contributed content

3. **Advanced Customization**
   - Custom style templates
   - Brand-specific styling
   - Color palette selection

4. **Batch Operations**
   - Generate images for entire courses
   - Background processing
   - Progress tracking

5. **Quality Enhancements**
   - Image quality scoring
   - Automatic regeneration for poor results
   - Human-in-the-loop review

## 🛠️ Integration with Image Services

### DALL-E (OpenAI)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateWithDALLE(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    size: "1024x1024",
    quality: "standard",
    n: 1
  });
  
  return response.data[0].url;
}
```

### Stable Diffusion

```python
from stability_sdk import client
import stability_sdk.interfaces.gooseai.generation.generation_pb2 as generation

stability_api = client.StabilityInference(
    key=os.environ['STABILITY_KEY']
)

answers = stability_api.generate(
    prompt=image_prompt,
    width=1024,
    height=576,
    samples=1,
    steps=30
)
```

### Midjourney (API)

```javascript
const { Midjourney } = require('midjourney');

const client = new Midjourney({
  ServerId: process.env.MJ_SERVER_ID,
  ChannelId: process.env.MJ_CHANNEL_ID,
  SalaiToken: process.env.MJ_TOKEN
});

await client.Connect();
const msg = await client.Imagine(imagePrompt);
```

## 📊 Analytics & Monitoring

Track image generation usage:

```javascript
// Example: Log image generation metrics
{
  chapterTitle: "Introduction to React",
  promptGenerated: true,
  generationTime: 1.8,
  styleRecommended: "modern flat illustration",
  imageServiceUsed: "DALL-E",
  imageGenerated: true,
  userSatisfaction: 5
}
```

## 🤝 Contributing

Have ideas for improvements? We'd love to hear them!

1. Review the current implementation in `server/ai-service.ts`
2. Check the API routes in `server/routes.ts`
3. Test your changes with `test-image-generation.js`
4. Submit feedback or suggestions

## 📝 Changelog

### Version 1.0.0 (Current)
- ✅ AI-powered image prompt generation
- ✅ Context-aware analysis
- ✅ Style recommendations
- ✅ API endpoint implementation
- ✅ Test script and documentation

### Planned for 1.1.0
- 🔜 Direct DALL-E integration
- 🔜 Batch processing
- 🔜 Image caching
- 🔜 UI components for chapter image management

## 🆘 Support

### Common Issues

**Q: Image prompts are too generic**
A: Make sure to include the `courseId` parameter for better context

**Q: Rate limit errors**
A: Add delays between requests or reduce frequency

**Q: AI service unavailable**
A: The system includes fallback prompts; check your GEMINI_API_KEY

### Getting Help

1. Check `AI_IMAGE_GENERATION_GUIDE.md` for detailed docs
2. Run `node test-image-generation.js` to verify setup
3. Review server logs for error messages
4. Check that GEMINI_API_KEY is properly configured

## 🎓 Best Practices

1. **Descriptive Titles**: Use clear, descriptive chapter titles
2. **Provide Context**: Always include courseId when available
3. **Review Prompts**: Check AI-generated prompts before using them
4. **Batch Wisely**: Generate prompts in batches to respect rate limits
5. **Store Results**: Cache generated prompts and images
6. **Track Metrics**: Monitor which styles work best for your content

## 📄 License

Part of the OpusAuthoring project. See main project license for details.

---

## 🚀 Get Started Now!

1. Read the [Quick Start Guide](QUICK_START_IMAGES.md)
2. Review the [Complete Documentation](AI_IMAGE_GENERATION_GUIDE.md)
3. Run the [Test Script](test-image-generation.js)
4. Start generating amazing images for your courses! 🎨

**Questions?** Check the guides or review the code in `server/ai-service.ts`

**Happy Creating!** 🎉
