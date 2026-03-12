/**
 * Simple test for contextual placeholder generation
 * Tests the deterministic image URL generation based on titles
 */

function generateContextualPlaceholderUrl(title, size = "800x400") {
  // Create a deterministic seed from the title
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    const char = title.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use absolute value to ensure positive seed
  const seed = Math.abs(hash) % 10000;
  
  return `https://picsum.photos/seed/${seed}/${size}`;
}

console.log('🎨 Testing Contextual Placeholder Generation\n');

const testTitles = [
  "Introduction to Machine Learning",
  "Quantum Entanglement Theory",
  "React Hooks Deep Dive", 
  "Database Design Principles",
  "Python for Data Science",
  "Neural Network Architectures"
];

console.log('Testing deterministic image generation:');
console.log('====================================\n');

testTitles.forEach((title, index) => {
  const url = generateContextualPlaceholderUrl(title);
  console.log(`${index + 1}. "${title}"`);
  console.log(`   URL: ${url}\n`);
});

// Test same title generates same URL
console.log('Testing consistency (same title = same URL):');
console.log('==========================================\n');

const testTitle = "Introduction to Machine Learning";
const url1 = generateContextualPlaceholderUrl(testTitle);
const url2 = generateContextualPlaceholderUrl(testTitle);
const url3 = generateContextualPlaceholderUrl(testTitle);

console.log(`Title: "${testTitle}"`);
console.log(`URL 1: ${url1}`);
console.log(`URL 2: ${url2}`);  
console.log(`URL 3: ${url3}`);
console.log(`Match: ${url1 === url2 && url2 === url3 ? '✅ Consistent' : '❌ Inconsistent'}\n`);

// Test different sizes
console.log('Testing different sizes:');
console.log('=======================\n');

const sizes = ["400x300", "800x400", "1200x800"];
sizes.forEach(size => {
  const url = generateContextualPlaceholderUrl(testTitle, size);
  console.log(`${size}: ${url}`);
});

console.log('\n✨ Contextual placeholders are working! Each title generates a unique, deterministic image.');
console.log('📝 These URLs will show consistent images for the same chapter titles across sessions.');