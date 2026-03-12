# Real AI Image Generation Setup Guide

## 🎯 Problem Solved

Previously, the system used random placeholder images from `picsum.photos` that weren't relevant to chapter content. Now we have **real AI-generated images** that are contextually relevant!

## ✨ What Changed

### Before:
- ❌ Random images from `https://picsum.photos/800/400?random=897`
- ❌ No connection to chapter content
- ❌ Generic placeholder images

### After:
- ✅ Real AI-generated images using DALL-E 3
- ✅ Contextually relevant to chapter titles
- ✅ Professional educational quality
- ✅ Smart fallback to placeholders if API unavailable

## 🚀 Setup Instructions

### Step 1: Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in to your OpenAI account
3. Click "Create new secret key"
4. Copy your API key (starts with `sk-...`)

### Step 2: Add API Key to Environment

Edit your `.env` file:

```env
DATABASE_URL=postgresql://postgres:Starbucks%239@localhost:5432/opus_authoring
NODE_ENV=development
GEMINI_API_KEY=AIzaSyDp6nSHo044_2KHOtsp0ryYsLpVDwR6xs8
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Important:** Replace `your-openai-api-key-here` with your actual OpenAI API key!

### Step 3: Restart Your Server

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

### Step 4: Test the Feature

```bash
# Test the new endpoint
node test-chapter-image.js
```

## 🎨 New API Endpoints

### 1. Generate Chapter Image (Complete - One Call)

**Endpoint**: `POST /api/ai/generate-chapter-image`

This is the **recommended endpoint** - it does everything in one call!

**Request:**
```json
{
  "chapterTitle": "Introduction to Neural Networks",
  "moduleTitle": "Deep Learning Basics",
  "courseId": "course-123",
  "size": "1024x1024"
}
```

**Response:**
```json
{
  "imageUrl": "https://oaidalleapiprodscus.blob.core.windows.net/...",
  "imagePrompt": "Educational illustration depicting...",
  "suggestedStyle": "modern flat illustration",
  "chapterTitle": "Introduction to Neural Networks"
}
```

**What it does:**
1. Analyzes chapter title and course context
2. Generates a detailed image prompt with AI
3. Creates the actual image with DALL-E
4. Returns the image URL ready to use!

### 2. Generate Image from Custom Prompt

**Endpoint**: `POST /api/ai/generate-image`

**Request:**
```json
{
  "prompt": "Educational illustration showing quantum mechanics concepts",
  "size": "1024x1024"
}
```

**Response:**
```json
{
  "url": "https://oaidalleapiprodscus.blob.core.windows.net/..."
}
```

## 📝 Usage Examples

### Example 1: Generate Image for a Chapter

```javascript
// One-call solution - recommended!
const response = await fetch('/api/ai/generate-chapter-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chapterTitle: "Quantum Entanglement",
    moduleTitle: "Advanced Quantum Mechanics",
    courseId: "physics-101",
    size: "1024x1024"
  })
});

const { imageUrl, imagePrompt, suggestedStyle } = await response.json();

// imageUrl is ready to use!
console.log('Generated image:', imageUrl);
```

### Example 2: Batch Generate Images for All Chapters

```javascript
const course = await getCourse(courseId);
const modules = await getModules(courseId);

for (const module of modules) {
  const chapters = await getChapters(module.id);
  
  for (const chapter of chapters) {
    // Generate image for each chapter
    const response = await fetch('/api/ai/generate-chapter-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterTitle: chapter.title,
        moduleTitle: module.title,
        courseId: course.id
      })
    });
    
    const { imageUrl } = await response.json();
    
    // Save to media assets
    await saveChapterImage(chapter.id, imageUrl);
    
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

### Example 3: With Custom Size

```javascript
// Generate a portrait image
const response = await fetch('/api/ai/generate-chapter-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chapterTitle: "Python Basics",
    size: "1024x1792" // Portrait orientation
  })
});
```

## 🎨 Available Image Sizes

DALL-E 3 supports three sizes:

| Size | Aspect Ratio | Best For |
|------|--------------|----------|
| `1024x1024` | Square | General use, thumbnails |
| `1024x1792` | Portrait | Mobile screens, tall layouts |
| `1792x1024` | Landscape | Wide screens, headers |

## 💰 Pricing Information

**DALL-E 3 Pricing (as of 2024):**
- Standard quality (1024x1024): ~$0.04 per image
- Standard quality (1024x1792 or 1792x1024): ~$0.08 per image

**Cost Example:**
- Course with 20 chapters = 20 images × $0.04 = **$0.80 total**
- Very affordable for high-quality, relevant images!

## ⚡ Smart Fallback System

The system includes intelligent fallback:

1. **If OpenAI API key is configured:** Uses DALL-E to generate real images
2. **If API key is missing:** Falls back to placeholder images (no errors!)
3. **If DALL-E fails:** Automatically falls back to placeholders

This means your app **always works**, even without an API key!

## 🧪 Test Script

Create `test-chapter-image.js`:

```javascript
const API_BASE = 'http://localhost:5000';

async function testChapterImageGeneration() {
  console.log('🎨 Testing Real Chapter Image Generation\n');
  
  const testChapter = {
    chapterTitle: "Introduction to Machine Learning",
    moduleTitle: "AI Fundamentals",
    size: "1024x1024"
  };
  
  console.log('Generating image for:', testChapter.chapterTitle);
  console.log('This may take 10-20 seconds...\n');
  
  try {
    const response = await fetch(`${API_BASE}/api/ai/generate-chapter-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testChapter)
    });
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log('Image URL:', result.imageUrl);
    console.log('Prompt used:', result.imagePrompt);
    console.log('Style:', result.suggestedStyle);
    console.log('\n📸 Open this URL in your browser to see the image:');
    console.log(result.imageUrl);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testChapterImageGeneration();
```

Run it:
```bash
node test-chapter-image.js
```

## 🔧 Troubleshooting

### Issue: Getting placeholder images instead of real ones

**Solution:** Check your OpenAI API key

1. Verify the key is in `.env`:
   ```bash
   cat .env | grep OPENAI
   ```

2. Make sure it starts with `sk-`

3. Restart the server after adding the key

### Issue: "Rate limit exceeded" error

**Solution:** Add delays between requests

```javascript
// Add 2-second delay between image generations
await new Promise(r => setTimeout(r, 2000));
```

### Issue: "Invalid API key" error

**Solution:** 
1. Go to https://platform.openai.com/api-keys
2. Generate a new API key
3. Update `.env` with the new key
4. Restart the server

### Issue: Images taking too long

**Solution:** DALL-E 3 typically takes 10-20 seconds per image. This is normal!

For faster development:
- Use placeholder images during testing
- Generate images in background jobs
- Cache generated images

## 📊 Comparison: Before vs After

| Feature | Before (Placeholder) | After (DALL-E) |
|---------|---------------------|----------------|
| Relevance | ❌ Random | ✅ Contextual |
| Quality | ❌ Generic photos | ✅ Professional AI art |
| Consistency | ❌ Varies wildly | ✅ Consistent style |
| Educational | ❌ No | ✅ Yes |
| Cost | ✅ Free | ⚠️ ~$0.04/image |
| Speed | ✅ Instant | ⚠️ 10-20 seconds |

## 🎓 Best Practices

### 1. Generate in Batches
Generate all images at once during course creation, not on-demand.

### 2. Cache Generated Images
Save DALL-E URLs to your media assets table to avoid regenerating.

### 3. Use Descriptive Titles
Better chapter titles = better images:
- ✅ "Neural Network Architecture Fundamentals"
- ❌ "Chapter 3"

### 4. Review Before Publishing
Always review AI-generated images before publishing your course.

### 5. Consider Image Rights
DALL-E images can be used commercially, but review OpenAI's terms.

## 🔮 Future Enhancements

Planned improvements:

1. **Image Storage**: Automatically save to media assets
2. **Regenerate Option**: Don't like the image? Regenerate with one click
3. **Style Selection**: Choose from preset visual styles
4. **Batch UI**: Generate images for all chapters from the UI
5. **Cost Tracking**: Monitor your DALL-E usage and costs

## 📞 Support

### Need Help?

1. **No API Key?** System falls back to placeholders automatically
2. **Want to Test?** Use the test script: `node test-chapter-image.js`
3. **Check Logs**: Look for "🎨 Generating image with DALL-E..." in console

### Common Questions

**Q: Can I use this without an OpenAI account?**
A: Yes! It will fallback to placeholder images.

**Q: How much does this cost?**
A: About $0.04 per image, so very affordable.

**Q: Can I use other AI image services?**
A: Yes! You can modify `generateImageWithDALLE` to use Stable Diffusion, Midjourney, etc.

**Q: Are the images saved permanently?**
A: DALL-E URLs expire after a few hours. Save them to your media assets!

## 🎉 You're Ready!

1. Add your OpenAI API key to `.env`
2. Restart the server
3. Generate real, relevant images for your chapters!

```bash
# Quick test
curl -X POST http://localhost:5000/api/ai/generate-chapter-image \
  -H "Content-Type: application/json" \
  -d '{
    "chapterTitle": "Getting Started with React",
    "moduleTitle": "Web Development Basics"
  }'
```

Enjoy your **contextually relevant, AI-generated chapter images**! 🚀🎨
