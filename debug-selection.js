// Debug tool to understand image selection for "Introduction to Cyber Security"
const courseTitle = "Introduction to Cyber Security";
const courseTopic = ""; // Usually empty in your courses

// Simulate the selection algorithm
const searchText = `${courseTitle} ${courseTopic || ''}`.toLowerCase();
console.log(`🔍 Search Text: "${searchText}"`);
console.log(`Contains 'cyber': ${searchText.includes('cyber')}`);
console.log(`Contains 'security': ${searchText.includes('security')}`);

// Expected scores for your images:
const expectedScores = {
  "Cyber Security.jpg": {
    keywords: ['cyber', 'security', 'cybersecurity', 'information security', 'network security'],
    expectedScore: 8, // cyber(2) + security(3) + cybersecurity(3) = 8+
    reason: "Perfect match for 'cyber' and 'security'"
  },
  "AI.webp": {
    keywords: ['ai', 'artificial intelligence', 'machine learning'],
    expectedScore: 0,
    reason: "No matching keywords"
  },
  "Python.jpg": {
    keywords: ['python', 'programming', 'coding'],
    expectedScore: 0,
    reason: "No matching keywords"
  },
  "Default technology images": {
    keywords: ['technology', 'education', 'learning'],
    expectedScore: 0,
    reason: "No matching keywords (title doesn't contain 'technology')"
  }
};

console.log("\n🎯 Expected Selection Results:");
Object.entries(expectedScores).forEach(([image, data]) => {
  console.log(`${image}: ${data.expectedScore} points - ${data.reason}`);
});

console.log("\n✅ Expected Winner: Cyber Security.jpg with ~8 points");
console.log("⚠️  If wrong image selected, check:");
console.log("1. Filename matches exactly: 'Cyber Security.jpg'");
console.log("2. Metadata key matches exactly: 'Cyber Security' (without .jpg)");
console.log("3. Server restarted after adding metadata");
console.log("4. No caching issues in browser");

// Test different course titles that should select different images:
console.log("\n🧪 Test Cases:");
const testCases = [
  { title: "Python Programming Basics", expected: "Python.jpg or Python2.webp" },
  { title: "Java Enterprise Development", expected: "Java1.jpg or Java2.jpg" },
  { title: "Machine Learning with AI", expected: "Machine Learning.jpg, AI.webp, or LLM variants" },
  { title: "AWS Cloud Computing", expected: "AWS Cloud.jpg or AWS Cloud2.jpg" },
  { title: "Introduction to Cyber Security", expected: "Cyber Security.jpg" }
];

testCases.forEach(test => {
  console.log(`"${test.title}" → should select: ${test.expected}`);
});

console.log("\n💡 If selection is still random:");
console.log("- All images might have same score (0 points)");
console.log("- Check server logs for actual selection process");
console.log("- Verify metadata was loaded correctly");