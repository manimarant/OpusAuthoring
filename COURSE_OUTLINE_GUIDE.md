# Course Outline Generation Guide

This guide explains how the course outline generation feature works and how to create structured courses with modules and chapters.

## Structure Overview

The course outline follows a hierarchical structure:

```
Course (e.g., "Introduction to Quantum Computing")
│
├── MODULE 1: [Module Title]
│   ├── [Chapter 1 Title]
│   ├── [Chapter 2 Title]
│   └── [Chapter 3 Title]
│
├── MODULE 2: [Module Title]
│   ├── [Chapter 1 Title]
│   ├── [Chapter 2 Title]
│   └── [Chapter 3 Title]
│
└── ... more modules
```

## Database Implementation

- **Modules** and **Chapters** are both stored in the `modules` table
- **Parent modules** (e.g., "MODULE 1") have:
  - A `description` field with the learning objective
  - A default content block (empty text block)
- **Chapters** (e.g., "Classical vs. Quantum Computing") have:
  - NO content blocks (as per design requirement)
  - Empty description field (optional)
  
## API Usage

### 1. Create a Course

```bash
POST /api/courses
Content-Type: application/json

{
  "topic": "Introduction to Quantum Computing",
  "targetAudience": "Students with basic understanding of linear algebra",
  "learningObjectives": "By the end of this course, students will...",
  "duration": "6-10 hours",
  "difficulty": "Intermediate",
  "status": "draft"
}
```

### 2. Generate Course Outline

```bash
POST /api/courses/{courseId}/generate-outline
```

This endpoint will:
1. Use AI to generate a course structure with modules and chapters
2. Create parent module records with learning objectives
3. Create chapter records (as module entries) without content blocks
4. Return all created modules/chapters

### 3. Retrieve Course Modules

```bash
GET /api/courses/{courseId}/modules
```

Returns all modules and chapters in order.

## Example: Creating a Quantum Computing Course

See `create-quantum-course.js` for a complete example script.

To run it:

```bash
# Make sure your server is running
npm run dev

# In another terminal, run the script
node create-quantum-course.js
```

## Expected Output Structure

```
Course: Introduction to Quantum Computing

MODULE 1: Foundations of Quantum Mechanics
  ├── Classical vs. Quantum Computing
  ├── A Brief History of Quantum Mechanics
  ├── Complex Numbers and Linear Algebra Review
  ├── Dirac Notation
  └── Postulates of Quantum Mechanics

MODULE 2: Quantum Bits (Qubits)
  ├── What is a Qubit?
  ├── Superposition
  ├── Measurement and Collapse
  ├── Entanglement
  └── The Bloch Sphere

... (additional modules)
```

## Key Features

1. **AI-Generated**: The outline is automatically generated based on the course topic and learning objectives
2. **Structured**: Maintains a clear hierarchy of modules and chapters
3. **Empty Chapters**: Chapters are created without content blocks, allowing instructors to add content later
4. **Consistent**: Always generates 6 modules with 3 chapters each (configurable in `ai-service.ts`)

## Customization

To customize the number of modules or chapters per module:

1. Edit `server/ai-service.ts`
2. Modify the `targetModules` and `targetChapters` constants in the `generateCourseOutline` function

```javascript
const targetModules = 6;     // Number of parent modules
const targetChapters = 3;    // Number of chapters per module
```

## Technical Notes

- Modules use the `order` field to maintain display sequence
- Parent modules can be distinguished by their non-empty `description` field
- The `lessonType` field is set to "block" for both modules and chapters
- All operations are transactional - if outline generation fails, no partial data is created
