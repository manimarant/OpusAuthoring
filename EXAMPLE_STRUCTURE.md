# Example: Quantum Computing Course Structure

This document shows the exact structure that will be created when you generate a course outline.

## Visual Structure (as shown in UI)

```
📚 Introduction to Quantum Computing
│
├── 📖 MODULE 1: Foundations of Quantum Mechanics
│   │   Learning Objective: "Understand the basic principles..."
│   │   [Has 1 empty text content block]
│   │
│   ├── 📄 Classical vs. Quantum Computing
│   │   [NO content blocks - empty placeholder]
│   │
│   ├── 📄 A Brief History of Quantum Mechanics
│   │   [NO content blocks - empty placeholder]
│   │
│   ├── 📄 Complex Numbers and Linear Algebra Review
│   │   [NO content blocks - empty placeholder]
│   │
│   ├── 📄 Dirac Notation
│   │   [NO content blocks - empty placeholder]
│   │
│   └── 📄 Postulates of Quantum Mechanics
│       [NO content blocks - empty placeholder]
│
├── 📖 MODULE 2: Quantum Bits (Qubits)
│   │   Learning Objective: "Learn about qubits..."
│   │   [Has 1 empty text content block]
│   │
│   ├── 📄 What is a Qubit?
│   │   [NO content blocks - empty placeholder]
│   │
│   ├── 📄 Superposition
│   │   [NO content blocks - empty placeholder]
│   │
│   ├── 📄 Measurement and Collapse
│   │   [NO content blocks - empty placeholder]
│   │
│   ├── 📄 Entanglement
│   │   [NO content blocks - empty placeholder]
│   │
│   └── 📄 The Bloch Sphere
│       [NO content blocks - empty placeholder]
│
└── ... (4 more modules following the same pattern)
```

## Database Records

### In the `modules` table:

| ID | courseId | title | description | order | lessonType | has_blocks? |
|----|----------|-------|-------------|-------|------------|-------------|
| mod_1 | course_1 | Foundations of Quantum Mechanics | Understand the basic principles... | 0 | block | ✅ Yes (1 empty text block) |
| mod_2 | course_1 | Classical vs. Quantum Computing | | 1 | block | ❌ No |
| mod_3 | course_1 | A Brief History of Quantum Mechanics | | 2 | block | ❌ No |
| mod_4 | course_1 | Complex Numbers and Linear Algebra Review | | 3 | block | ❌ No |
| mod_5 | course_1 | Dirac Notation | | 4 | block | ❌ No |
| mod_6 | course_1 | Postulates of Quantum Mechanics | | 5 | block | ❌ No |
| mod_7 | course_1 | Quantum Bits (Qubits) | Learn about qubits... | 6 | block | ✅ Yes (1 empty text block) |
| mod_8 | course_1 | What is a Qubit? | | 7 | block | ❌ No |
| ... | ... | ... | ... | ... | ... | ... |

## Key Distinguishing Features

### Parent Modules (e.g., "MODULE 1")
- ✅ Have a `description` field (learning objective)
- ✅ Have 1 content block (empty text block)
- 🎯 Purpose: Section headers for organizing chapters

### Chapters (e.g., "Classical vs. Quantum Computing")
- ❌ Have empty or no `description` field
- ❌ Have NO content blocks
- 🎯 Purpose: Empty placeholders for instructors to add content

## How to Identify in Code

```javascript
// To identify if a module is a parent module or chapter:
const isParentModule = (module) => {
  return module.description && module.description.trim().length > 0;
};

// Usage:
const modules = await getModulesByCourseId(courseId);
modules.forEach(module => {
  if (isParentModule(module)) {
    console.log(`📖 MODULE: ${module.title}`);
  } else {
    console.log(`   📄 Chapter: ${module.title}`);
  }
});
```

## Content Addition Workflow

1. **After outline generation**: All chapter modules are empty (no content blocks)
2. **Instructor adds content**: Instructor navigates to a chapter and adds content blocks
3. **Content blocks are created**: Text, images, videos, quizzes, etc. are added to chapter modules
4. **Course is complete**: All chapters have content, ready to publish

## Why This Design?

✅ **Flexibility**: Instructors can add content to chapters incrementally
✅ **Structure**: Clear hierarchy with modules grouping related chapters
✅ **Performance**: Empty chapters don't create unnecessary content block records
✅ **Clarity**: Distinction between structural elements (modules) and content containers (chapters)
