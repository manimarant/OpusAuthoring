# AI Block Generation Analysis & Enhancement Plan

## Current AI-Capable Block Types

### 1. ✅ **AI Text** (Already Implemented)
- **Use Case**: General content creation, explanations, summaries
- **Current Capabilities**: 
  - Generate explanations
  - Improve existing text
  - Simplify language
  - Shorten content
  - Continue text
- **Parameters**: tone (friendly/formal/neutral), reading level, length

### 2. ✅ **AI Quiz** (Already Implemented)
- **Use Case**: Knowledge assessment
- **Current Capabilities**:
  - Generate multiple-choice questions
  - Generate true/false questions
  - Generate short-answer questions
- **Parameters**: difficulty, question count, question types
- **Output**: Structured questions with answers and explanations

### 3. ✅ **AI Assignment** (Recently Implemented)
- **Use Case**: Assessment & skill development
- **Current Capabilities**:
  - Generate complete assignments
  - Create structured tasks
  - Generate grading rubrics
- **Parameters**: difficulty, assignment type, task count
- **Output**: Tasks, rubric, submission guidelines

---

## Additional Block Types Suitable for AI Generation

### 4. 🎯 **AI Summary** (Recommended - High Priority)
- **Use Case**: Key takeaways, condensed learning
- **AI Capabilities**:
  - Extract key points from module content
  - Create bullet-point summaries
  - Generate learning outcomes
- **Proposed Parameters**:
  - Summary style: bullets, narrative, key-points
  - Length: short (3-5 items), medium (8-10), comprehensive (15+)
  - Focus: objectives, definitions, procedures
- **Output Structure**:
  ```json
  {
    "title": "Module Summary",
    "summary": "Narrative summary",
    "keyPoints": ["point1", "point2", ...],
    "learningOutcomes": ["outcome1", ...],
    "quickReview": ["Q&A item1", ...]
  }
  ```

### 5. 🎯 **AI Checklist/List** (High Priority)
- **Use Case**: Procedural steps, learning activities, to-do items
- **AI Capabilities**:
  - Generate step-by-step procedures
  - Create learning activity lists
  - Break down complex processes
- **Proposed Parameters**:
  - List type: checklist, numbered steps, bullets
  - Detail level: brief, detailed, comprehensive
  - Focus area: steps, requirements, best practices
- **Output Structure**:
  ```json
  {
    "title": "Process Steps",
    "items": [
      {
        "id": "item-1",
        "text": "Step description",
        "details": "Additional details",
        "completed": false
      }
    ]
  }
  ```

### 6. 🎯 **AI Scenario** (Medium Priority)
- **Use Case**: Case studies, decision-making exercises
- **AI Capabilities**:
  - Generate realistic learning scenarios
  - Create decision branches
  - Generate outcome descriptions
- **Proposed Parameters**:
  - Scenario type: case-study, decision-tree, role-play
  - Complexity: introductory, intermediate, advanced
  - Focus: problem-solving, analysis, application
- **Output Structure**:
  ```json
  {
    "title": "Scenario Title",
    "description": "Scenario setup",
    "context": "Background information",
    "choices": [
      {
        "id": "choice-1",
        "text": "Choice text",
        "outcome": "What happens if chosen",
        "feedback": "Learning feedback"
      }
    ]
  }
  ```

### 7. 🎯 **AI Flashcards** (Medium Priority)
- **Use Case**: Spaced repetition, vocabulary, definitions
- **AI Capabilities**:
  - Generate Q&A pairs from content
  - Create definition cards
  - Build concept-mapping cards
- **Proposed Parameters**:
  - Card type: definition, Q&A, concept-mapping
  - Number of cards: 5, 10, 15, 20
  - Difficulty: beginner, intermediate, advanced
- **Output Structure**:
  ```json
  {
    "title": "Flashcard Set",
    "cards": [
      {
        "id": "card-1",
        "front": "Question/Term",
        "back": "Answer/Definition",
        "difficulty": "intermediate"
      }
    ]
  }
  ```

### 8. 🎯 **AI Timeline** (Medium Priority)
- **Use Case**: Historical events, process progression, chronological content
- **AI Capabilities**:
  - Generate chronological sequences
  - Create cause-effect timelines
  - Organize milestones
- **Proposed Parameters**:
  - Timeline type: events, phases, development stages
  - Number of items: 5, 10, 15
  - Detail level: brief, moderate, detailed
- **Output Structure**:
  ```json
  {
    "title": "Timeline Title",
    "events": [
      {
        "id": "event-1",
        "date": "2023-01-15",
        "title": "Event title",
        "description": "Event description",
        "significance": "Why this matters"
      }
    ]
  }
  ```

### 9. ❌ **AI Image/Gallery/Video/Audio** (Not Recommended for User Prompt)
- **Why**: Requires specialized services (DALL-E, Stable Diffusion, TTS)
- **Current Approach**: Image prompts via AI, not generation from user text
- **Better Solution**: Provide templates, image libraries, or specialized tools

---

## Enhanced Inline AI Assistant Strategy

### Current Limitation
The inline AI assistant only:
- Generates/edits text within the current text block
- Offers quick actions (improve, shorten, simplify)
- Doesn't suggest creating new block types

### Proposed Enhancement
Allow users to input free-form prompts that:
1. **Detect Intent**: "Create 5 flashcards about photosynthesis"
2. **Recognize Block Type**: Flashcard generation
3. **Extract Parameters**: 5 cards, about photosynthesis
4. **Suggest Action**: "Would you like me to add these as a new Flashcard block?"
5. **Generate Content**: Create and insert the block

### Intent Recognition Rules

```
Prompt Pattern Recognition:
- "Create a summary" → AI Summary block
- "Make a checklist" → List/Checklist block
- "Generate a scenario" → Scenario block
- "Make flashcards" → Flashcard block
- "Create timeline" → Timeline block
- "Generate assignment" → Assignment block (existing)
- "Create quiz" → Quiz block (existing)
- Keywords: summary, outline, checklist, steps, scenario, flashcard, timeline, assignment, quiz
```

---

## Implementation Priority

### Phase 1: High Priority (User Prompts → Blocks)
1. AI Summary Generator
2. AI Checklist/List Generator
3. Enhanced inline assistant with intent recognition

### Phase 2: Medium Priority
1. AI Scenario Generator
2. AI Flashcard Generator
3. AI Timeline Generator

### Phase 3: Future
1. AI Labeled Graphic (interactive labels)
2. AI Process Flow (workflows)
3. Integration with quiz variations

---

## API Endpoint Design

### Generate Summary
```
POST /api/ai/generate-summary
{
  moduleId: string,
  prompt: string,
  style: 'bullets' | 'narrative' | 'key-points',
  length: 'short' | 'medium' | 'comprehensive',
  includeCourseContext: boolean
}
```

### Generate List/Checklist
```
POST /api/ai/generate-list
{
  moduleId: string,
  prompt: string,
  type: 'checklist' | 'steps' | 'bullets',
  detailLevel: 'brief' | 'detailed' | 'comprehensive',
  itemCount: number,
  includeCourseContext: boolean
}
```

### Generate Scenario
```
POST /api/ai/generate-scenario
{
  moduleId: string,
  prompt: string,
  type: 'case-study' | 'decision-tree' | 'role-play',
  complexity: 'introductory' | 'intermediate' | 'advanced',
  choiceCount: number,
  includeCourseContext: boolean
}
```

### Generate Flashcards
```
POST /api/ai/generate-flashcards
{
  moduleId: string,
  prompt: string,
  cardType: 'definition' | 'qa' | 'concept-mapping',
  cardCount: number,
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  includeCourseContext: boolean
}
```

### Generate Timeline
```
POST /api/ai/generate-timeline
{
  moduleId: string,
  prompt: string,
  type: 'events' | 'phases' | 'stages',
  itemCount: number,
  detailLevel: 'brief' | 'moderate' | 'detailed',
  includeCourseContext: boolean
}
```

---

## Enhanced Inline Assistant UX

### Current Flow
```
User types in text block → Uses AI to edit existing text
```

### Proposed Flow
```
User types custom prompt (any text block)
    ↓
AI detects intent + suggests action
    ↓
User confirms or modifies block type
    ↓
New block created with generated content
    ↓
User can further edit/refine
```

### UI Implementation
1. Add "Create Block" button to inline assistant
2. When prompt entered:
   - If matches known pattern, suggest: "Create Flashcard block?"
   - If ambiguous, ask: "Do you want to create a new block? What type?"
   - Show confirmed suggestions as pills/chips

---

## Block Type Compatibility Matrix

| Block Type | Text Gen | Quiz Gen | Assignment Gen | Summary Gen | List Gen | Scenario Gen | Flashcard Gen | Timeline Gen |
|-----------|----------|----------|---|---|---|---|---|---|
| AI Text | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AI Quiz | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AI Assignment | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AI Summary | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI List | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| AI Scenario | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| AI Flashcards | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| AI Timeline | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Summary of Opportunities

### Immediate Implementation (Phase 1)
- ✅ Allow inline assistant to detect "create" intents
- ✅ Add AI Summary generation
- ✅ Add AI List/Checklist generation
- ✅ Update menu to show new block types

### Quick Wins
- Use existing Gemini API
- Leverage existing schemas
- Minimal UI changes needed

### User Benefits
- Single prompt creates multiple block types
- Intelligent content generation
- Reduced clicks to create structured content
- Supports diverse learning activities
