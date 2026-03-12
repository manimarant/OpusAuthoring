// Test script to debug image selection for "Introduction to Cyber Security"
// This simulates what happens when selectStockImage() is called

// Course details from your screenshot:
const courseTitle = "Introduction to Cyber Security";
const courseTopic = ""; // Appears empty from screenshot

console.log("=== DEBUGGING IMAGE SELECTION ===");
console.log(`Course Title: "${courseTitle}"`);
console.log(`Course Topic: "${courseTopic}"`);

// This is what the selectStockImage function does:
const searchText = `${courseTitle} ${courseTopic || ''}`.toLowerCase();
console.log(`Search Text: "${searchText}"`);
console.log(`Contains 'cyber': ${searchText.includes('cyber')}`);
console.log(`Contains 'security': ${searchText.includes('security')}`);
console.log(`Contains 'technology': ${searchText.includes('technology')}`);

// Expected scoring for "Cyber Security.jpg":
// - 'cyber' match: 2 points
// - 'security' match: 3 points (>6 characters)
// - 'cybersecurity' match: 3 points
// - 'information security' partial match: 3 points
// - category 'technology' bonus: 0 points (not in search text)
// Total expected: ~8-11 points (should be highest)

console.log("\n=== EXPECTED RESULTS ===");
console.log("Cyber Security.jpg should score: ~8-11 points");
console.log("Other images should score: 0-2 points");
console.log("Selected image should be: /assets/stock-images/technology/Cyber Security.jpg");

// Potential issues:
console.log("\n=== POTENTIAL ISSUES ===");
console.log("1. Filename spaces: 'Cyber Security.jpg' (should work)");
console.log("2. Metadata key: 'Cyber Security' (should match filename without extension)");
console.log("3. Keywords case sensitivity: (should be case-insensitive)");
console.log("4. Cache: Catalog might need refresh");