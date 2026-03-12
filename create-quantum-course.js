// Script to create a sample "Introduction to Quantum Computing" course
// Run this with: node create-quantum-course.js

const API_BASE = "http://localhost:5000";

async function createQuantumCourse() {
  try {
    // Step 1: Create the course
    console.log("Creating course...");
    const courseResponse = await fetch(`${API_BASE}/api/courses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: "Introduction to Quantum Computing",
        targetAudience: "Students with basic understanding of linear algebra and classical computing concepts",
        learningObjectives: `By the end of this course, students will be able to:
- Understand the fundamental principles of quantum mechanics as they apply to computing
- Explain the concept of qubits and their properties (superposition, entanglement)
- Apply quantum gates to manipulate qubit states
- Design and analyze simple quantum algorithms
- Understand the potential and limitations of quantum computing`,
        duration: "6-10 hours",
        difficulty: "Intermediate",
        status: "draft"
      })
    });

    if (!courseResponse.ok) {
      throw new Error(`Failed to create course: ${courseResponse.statusText}`);
    }

    const course = await courseResponse.json();
    console.log(`✓ Course created with ID: ${course.id}`);
    console.log(`  Title: ${course.title}`);

    // Step 2: Generate the course outline
    console.log("\nGenerating course outline...");
    const outlineResponse = await fetch(
      `${API_BASE}/api/courses/${course.id}/generate-outline`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      }
    );

    if (!outlineResponse.ok) {
      throw new Error(`Failed to generate outline: ${outlineResponse.statusText}`);
    }

    const modules = await outlineResponse.json();
    console.log(`✓ Generated ${modules.length} modules and chapters`);

    // Step 3: Display the structure
    console.log("\n=== Course Structure ===");
    console.log(`\nCourse: ${course.title}\n`);

    let currentModule = null;
    let moduleCount = 0;
    
    for (const item of modules) {
      // Check if this is a parent module (by checking if it has a learning objective)
      // or by tracking the order pattern
      const isParentModule = item.description && item.description.length > 0;
      
      if (isParentModule) {
        moduleCount++;
        currentModule = item.title;
        console.log(`MODULE ${moduleCount}: ${item.title}`);
        if (item.description) {
          console.log(`  Learning Objective: ${item.description}`);
        }
      } else {
        // This is a chapter
        console.log(`  ├── ${item.title}`);
      }
    }

    console.log("\n✓ Course outline created successfully!");
    console.log(`\nView your course at: http://localhost:5000/course-details/${course.id}`);
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the script
createQuantumCourse();
