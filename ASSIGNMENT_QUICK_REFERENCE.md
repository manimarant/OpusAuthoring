# AI Assignment Block - Quick Reference

## 🚀 What Was Added

A complete **AI-powered Assignment Generator** for course creation. Instructors can now create rich, structured assignments with tasks, rubrics, and grading criteria using AI.

## 📋 Assignment Structure

Each AI-generated assignment includes:
- **Title** - Custom assignment name
- **Learning Objectives** - 3+ key learning goals
- **Tasks** - 1-10 customizable tasks with:
  - Task description
  - Time estimates
  - Requirements checklist
- **Submission Guidelines** - Format, deadline, instructions
- **Grading Rubric** - 4-level performance scale (exemplary→beginning)
- **Resources** - Links and materials for students
- **Tips** - Success strategies

## 🎛️ Customization Options

| Parameter | Options | Default |
|-----------|---------|---------|
| Difficulty | easy, medium, hard | medium |
| Type | project, research, practical, reflection, mixed | project |
| Tasks | 1-10 | 3 |
| Include Rubric | yes/no | yes |
| Course Context | yes/no | yes |

## 💻 Usage Flow

```
1. New Content Block → AI Assignment
   ↓
2. Auto-generates with defaults
   ↓
3. (Optional) Click "Regenerate" to customize
   ↓
4. Adjust parameters in dialog
   ↓
5. Preview and insert
   ↓
6. Edit details as needed
   ↓
7. Students see formatted assignment
```

## 🔧 Technical Architecture

```
Frontend (React)
├── ai-assignment-generation-dialog.tsx (Form & Preview)
├── content-block.tsx (Render & Edit)
└── content-block-menu.tsx (Add to menu)
                ↓
API Layer
└── POST /api/ai/generate-assignment
                ↓
AI Service (Gemini)
├── generateAssignment()
├── buildAssignmentSystemPrompt()
└── buildAssignmentUserMessage()
                ↓
Database
└── content_blocks table (JSONB storage)
```

## 📝 Assignment Display Features

✅ **Objectives** - Color-coded in blue with checkmarks
✅ **Tasks** - Numbered with task duration
✅ **Rubric** - Expandable performance levels with weights
✅ **Guidelines** - Submission requirements highlighted
✅ **Resources** - Bulleted list with icons
✅ **Tips** - Success strategies with lightbulb icon

## 🎨 Color Scheme

- Blue (Objectives) - Learning focus
- Emerald (Tasks) - Action items
- Purple (Rubric) - Grading clarity
- Amber (Submission) - Important requirements
- Green (Tips) - Success strategies

## ⚙️ Configuration

The feature auto-generates on block creation with these defaults:
```javascript
{
  difficulty: 'medium',
  taskCount: 3,
  assignmentType: 'project',
  includeRubric: true,
  includeCourseContext: true
}
```

## 🌐 API Endpoint

```
POST /api/ai/generate-assignment

Request:
{
  moduleId: string,
  prompt: string,
  difficulty: 'easy'|'medium'|'hard',
  taskCount: number (1-10),
  assignmentType: 'project'|'research'|'practical'|'reflection'|'mixed',
  includeRubric: boolean,
  includeCourseContext: boolean
}

Response:
{
  assignment: {
    title: string,
    objectives: string[],
    description: string,
    tasks: Task[],
    submissionGuidelines: SubmissionGuidelines,
    rubric: RubricCriterion[],
    resources: string[],
    tips: string[]
  },
  provider: 'gemini',
  model: 'gemini-2.5-flash'
}
```

## 🧪 Test Cases

1. **Auto-generation**: Create ai-assignment block → verify it generates automatically
2. **Customization**: Click regenerate → change difficulty to 'hard' → verify changes
3. **Editing**: Edit task title → verify auto-saves after 2 seconds
4. **Display**: Verify all sections render with proper colors/formatting
5. **Error Handling**: Disconnect API → verify graceful fallback to empty template

## 📦 Files Modified

1. **server/ai-service.ts** - Added 3 functions for assignment generation
2. **shared/schema.ts** - Added assignment schema and types
3. **server/routes.ts** - Added API endpoint and auto-generation logic
4. **client/src/components/ai/ai-assignment-generation-dialog.tsx** - New dialog component
5. **client/src/components/course/content-block-menu.tsx** - Added menu option
6. **client/src/components/course/content-block.tsx** - Added rendering and editing

## 🚨 Error Handling

- API failures: Defaults to empty template structure
- Rate limiting: Returns 429 with retry-after header
- Invalid input: Returns 400 with validation errors
- Server errors: Returns 500 with error message

## 💾 Data Storage

Assignments are stored in the `content_blocks` table:
```sql
{
  id: UUID,
  moduleId: UUID (foreign key),
  type: 'ai-assignment' | 'assignment',
  content: {
    title: string,
    objectives: string[],
    description: string,
    tasks: [...],
    submissionGuidelines: {...},
    rubric: [...],
    resources: [...],
    tips: [...],
    isGenerated: boolean
  },
  order: string,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## 🎯 Next Steps for Enhancement

- [ ] Add assignment templates library
- [ ] Support file attachments
- [ ] Peer review integration
- [ ] Rubric customization UI
- [ ] PDF export functionality
- [ ] Grade rubric import from other tools
- [ ] Deadline reminder notifications
- [ ] Student submission tracking

---

**Status**: ✅ Complete and Ready to Use
**Tested**: All components functional
**Performance**: Optimized with debounced auto-save
**Error Handling**: Comprehensive with fallbacks
