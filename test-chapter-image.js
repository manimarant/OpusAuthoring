/**
 * Test Script: Real AI Chapter Image Generation with DALL-E
 * 
 * This script tests the complete image generation pipeline:
 * 1. AI generates a contextual image prompt
 * 2. DALL-E creates the actual image
 * 3. Returns a real, relevant image URL
 */

const API_BASE = 'http://localhost:5000';

async function testChapterImageGeneration() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Real AI Chapter Image Generation - Test Script          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const testCases = [
    {
      chapterTitle: "Introduction to Machine Learning",
      moduleTitle: "AI Fundamentals",
      size: "1024x1024"
    },
    {
      chapterTitle: "Quantum Entanglement",
      moduleTitle: "Advanced Quantum Mechanics",
      size: "1024x1024"
    },
    {
      chapterTitle: "React Hooks Deep Dive",
      moduleTitle: "Modern Web Development",
      size: "1024x1024"
    }
  ];
  
  console.log('🎨 This will generate REAL AI images for chapters!\n');
  console.log('⏱️  Each image takes 10-20 seconds to generate.\n');
  console.log('💰 Cost: ~$0.04 per image (if OpenAI API key is configured)\n');
  console.log('📝 If no API key: Falls back to placeholder images\n');
  console.log('═'.repeat(64));
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`\n\n📚 Test Case ${i + 1}/${testCases.length}`);
    console.log(`   Chapter: "${testCase.chapterTitle}"`);
    console.log(`   Module: "${testCase.moduleTitle}"`);
    console.log(`   Size: ${testCase.size}`);
    console.log('\n   ⏳ Generating... (this may take 10-20 seconds)');
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/api/ai/generate-chapter-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error(`\n   ❌ Error: ${error.message}`);
        continue;
      }
      
      const result = await response.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n   ✅ Success! (${duration}s)`);
      console.log('\n   🎨 Generated Image:');
      console.log(`   ${'-'.repeat(60)}`);
      
      // Check if it's a real DALL-E image or fallback
      if (result.imageUrl.includes('picsum.photos')) {
        console.log(`   ⚠️  FALLBACK: Using placeholder image`);
        console.log(`   💡 Add OPENAI_API_KEY to .env for real images`);
      } else {
        console.log(`   🎉 REAL DALL-E IMAGE generated!`);
      }
      
      console.log(`\n   📸 Image URL:`);
      console.log(`   ${result.imageUrl}`);
      
      console.log(`\n   📝 Prompt Used:`);
      console.log(`   ${result.imagePrompt.substring(0, 100)}...`);
      
      console.log(`\n   🎨 Style: ${result.suggestedStyle}`);
      
      console.log(`\n   💡 Next Steps:`);
      console.log(`   - Open the URL in your browser to see the image`);
      console.log(`   - Save the URL to your media assets`);
      console.log(`   - Associate with the chapter as a thumbnail`);
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n   ❌ Request failed (${duration}s): ${error.message}`);
    }
    
    console.log('\n' + '═'.repeat(64));
    
    // Small delay between requests
    if (i < testCases.length - 1) {
      console.log('\n⏸️  Waiting 2 seconds before next generation...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n\n✨ Testing Complete!\n');
  console.log('📊 Summary:');
  console.log('- If you saw "REAL DALL-E IMAGE": Your setup is working! 🎉');
  console.log('- If you saw "FALLBACK": Add OPENAI_API_KEY to .env file');
  console.log('\n📖 For setup instructions, see: REAL_IMAGE_GENERATION_SETUP.md\n');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${API_BASE}/api/courses`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Main execution
async function main() {
  console.log('\n🔍 Checking if server is running...\n');
  
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('❌ Error: Server is not running!');
    console.error('   Please start the server first: npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  
  await testChapterImageGeneration();
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
} else if (typeof import !== 'undefined' && import.meta && import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testChapterImageGeneration, checkServer };
} else {
  // ES modules
  export { testChapterImageGeneration, checkServer };
}
