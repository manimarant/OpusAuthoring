# Testing the Course Outline Feature

## ✅ Changes Made

I've updated the course outline generation to be more robust:

### 1. **Retry Logic**
- Automatically retries up to 3 times if the AI service is overloaded
- Uses exponential backoff: 1s, 2s, 4s between retries
- Handles 503, 429, and "UNAVAILABLE" errors

### 2. **Fallback Mode**
- If all retries fail, generates a basic outline with generic titles
- Ensures course creation always succeeds
- You can edit the generic titles later

## How to Test

### Via Web UI (Recommended)

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open your browser** and navigate to: `http://localhost:5000`

3. **Create a new course:**
   - Click "Create New Course" or navigate to the course setup page
   - Fill in the form:
     - **Topic**: "Introduction to Quantum Computing"
     - **Target Audience**: "Students with basic understanding of linear algebra"
     - **Learning Objectives**: 
       ```
       By the end of this course, students will be able to:
       - Understand the fundamental principles of quantum mechanics
       - Explain the concept of qubits and their properties
       - Apply quantum gates to manipulate qubit states
       ```
     - **Duration**: "6-10 hours"
     - **Difficulty**: "Intermediate"

4. **Click "Generate Course Outline"**

5. **What will happen:**
   - System tries to generate an AI-powered outline
   - If Gemini API is overloaded:
     - Retries automatically 3 times (you'll see logs in the terminal)
     - If still fails, generates a fallback outline
   - You'll see modules and chapters created

### Expected Behavior

#### If AI Works:
```
Course: Introduction to Quantum Computing

MODULE 1: Foundations of Quantum Mechanics
  ├── Classical vs. Quantum Computing
  ├── A Brief History of Quantum Mechanics
  └── ...

MODULE 2: Quantum Bits (Qubits)
  ├── What is a Qubit?
  └── ...
```

#### If AI Fails (Fallback):
```
Course: Introduction to Quantum Computing

MODULE 1: Introduction to Quantum Computing
  Learning Objective: Learn about Introduction to Quantum Computing - Part 1
  ├── Lesson 1: Introduction to Module 1
  ├── Lesson 2: Introduction to Module 1
  └── Lesson 3: Introduction to Module 1

MODULE 2: Introduction to Quantum Computing
  Learning Objective: Learn about Introduction to Quantum Computing - Part 2
  ├── Lesson 1: Introduction to Module 2
  └── ...
```

### Via API (Alternative)

If you prefer testing via API:

```bash
# 1. Start server in one terminal
npm run dev

# 2. In another terminal, create a course
curl -X POST http://localhost:5000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Introduction to Quantum Computing",
    "targetAudience": "Students with basic understanding",
    "learningObjectives": "Understand quantum principles",
    "difficulty": "Intermediate"
  }'

# 3. Copy the course ID from the response, then generate outline
curl -X POST http://localhost:5000/api/courses/{COURSE_ID}/generate-outline

# 4. View the modules
curl http://localhost:5000/api/courses/{COURSE_ID}/modules
```

## What to Look For

### In the Server Logs:

**If retrying:**
```
Attempt 1 failed: ... overloaded ... Retrying in 1000ms...
Attempt 2 failed: ... overloaded ... Retrying in 2000ms...
```

**If using fallback:**
```
AI outline generation failed after 3 attempts. Using fallback outline.
```

### In the Response:

- You should get a 200 OK response with module data
- Modules array should have items (both parent modules and chapters)
- Parent modules have `description` field populated
- Chapters have empty or no `description`

## Troubleshooting

**"Failed to create course"**
- Make sure server is running: `npm run dev`
- Check if database is connected (look for connection errors in logs)

**"Failed to generate outline"**
- This should NOT happen anymore with the fallback
- If it does, check the server logs for specific errors

**Generic module titles**
- This means AI was unavailable and fallback was used
- You can manually edit the titles through the UI
- Try again later when AI service is back online

## Next Steps

After successful outline generation:
1. Navigate to each chapter in the UI
2. Add content blocks (text, images, videos)
3. Customize the generic titles if fallback was used
4. Publish your course

## Summary

The system is now resilient to AI service outages:
- ✅ Automatic retries with exponential backoff
- ✅ Fallback to generic outline if AI fails
- ✅ Course creation always succeeds
- ✅ You can edit titles later
