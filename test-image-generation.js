/**
 * Test Script: AI Chapter Image Generation
 * 
 * This script demonstrates how to use the AI image generation feature
 * to create contextually relevant image prompts for course chapters.
 */

const API_BASE = 'http://localhost:5000';

// Test data
const testCases = [
  {
    chapterTitle: "Introduction to Quantum Mechanics",
    moduleTitle: "MODULE 1: Foundations of Physics",
    courseId: null // Will work without courseId but better with it
  },
  {
    chapterTitle: "Neural Networks Basics",
    moduleTitle: "Deep Learning Fundamentals",
    courseId: null
  },
  {
    chapterTitle: "Understanding React Hooks",
    moduleTitle: "Modern React Development",
    courseId: null
  }
];

async function testImagePromptGeneration() {
  console.log('🎨 Testing AI Chapter Image Generation\n');
  console.log('='.repeat(80));
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📚 Test Case ${i + 1}:`);
    console.log(`   Chapter: "${testCase.chapterTitle}"`);
    console.log(`   Module: "${testCase.moduleTitle}"`);
    
    try {
      const response = await fetch(`${API_BASE}/api/ai/generate-chapter-image-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testCase)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`   ❌ Error: ${error.message}`);
        continue;
      }
      
      const result = await response.json();
      
      console.log(`\n   ✅ Generated Image Prompt:`);
      console.log(`   ${'-'.repeat(76)}`);
      console.log(`   ${result.imagePrompt}`);
      console.log(`   ${'-'.repeat(76)}`);
      console.log(`   🎨 Suggested Style: ${result.suggestedStyle}`);
      
      // Simulate what you would do next with the prompt
      console.log(`\n   💡 Next Steps:`);
      console.log(`   - Use this prompt with DALL-E, Midjourney, or Stable Diffusion`);
      console.log(`   - Save the generated image to your media assets`);
      console.log(`   - Associate the image with the chapter as a thumbnail\n`);
      
    } catch (error) {
      console.error(`   ❌ Request failed: ${error.message}`);
    }
    
    console.log('='.repeat(80));
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ Testing Complete!\n');
  console.log('📖 For more information, see AI_IMAGE_GENERATION_GUIDE.md\n');
}

// Usage instructions
function printUsage() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   AI Chapter Image Generation - Test Script                ║
╚════════════════════════════════════════════════════════════════════════════╝

PREREQUISITES:
1. Make sure your server is running: npm run dev
2. The server should be accessible at ${API_BASE}
3. Ensure GEMINI_API_KEY is configured in your .env file

USAGE:
  node test-image-generation.js

WHAT THIS SCRIPT DOES:
- Tests the AI image prompt generation endpoint
- Generates contextually relevant image prompts for sample chapters
- Demonstrates how to integrate with image generation services

NEXT STEPS:
After getting image prompts, you can:
1. Use them with DALL-E, Midjourney, or Stable Diffusion
2. Store generated images in your media assets
3. Associate images with chapters as thumbnails

For detailed documentation, see: AI_IMAGE_GENERATION_GUIDE.md
`);
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/api/courses`);
    if (response.ok) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
}

// Main execution
async function main() {
  printUsage();
  
  console.log('🔍 Checking if server is running...\n');
  
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('❌ Error: Server is not running!');
    console.error('   Please start the server first: npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  
  await testImagePromptGeneration();
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testImagePromptGeneration, checkServer };
