# Course Outline - Quick Reference

## Structure at a Glance

```
📚 COURSE
│
├── 📖 MODULE (has learning objective + 1 empty content block)
│   ├── 📄 Chapter (NO content blocks)
│   ├── 📄 Chapter (NO content blocks)
│   └── 📄 Chapter (NO content blocks)
│
├── 📖 MODULE (has learning objective + 1 empty content block)
│   ├── 📄 Chapter (NO content blocks)
│   ├── 📄 Chapter (NO content blocks)
│   └── 📄 Chapter (NO content blocks)
│
└── ...
```

## Quick Commands

```bash
# Start server
npm run dev

# Create example course
node create-quantum-course.js

# Manual API calls
curl -X POST http://localhost:5000/api/courses -H "Content-Type: application/json" -d @course.json
curl -X POST http://localhost:5000/api/courses/{id}/generate-outline
curl http://localhost:5000/api/courses/{id}/modules
```

## Database Schema

```sql
-- Both stored in same table
modules (
  id,
  courseId,
  title,           -- "Foundations of QM" or "Classical vs Quantum"
  description,     -- Learning objective (only for parent modules)
  order,          -- Display sequence
  lessonType      -- "block"
)

-- Only parent modules have this
content_blocks (
  id,
  moduleId,       -- Links to parent module only
  type,           -- "text"
  content,        -- { text: "" }
  order           -- "0"
)
```

## Identify Module Type

```javascript
// Check if module is a parent or chapter
const isParentModule = (module) => 
  module.description && module.description.trim().length > 0;
```

## Key Rules

✅ **Parent Modules**
- Have `description` (learning objective)
- Have 1 empty content block
- Act as section headers

❌ **Chapters**  
- No `description` (or empty)
- NO content blocks
- Empty placeholders for content

## Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | Main implementation |
| `server/ai-service.ts` | AI outline generation |
| `create-quantum-course.js` | Example script |
| `COURSE_OUTLINE_README.md` | Full implementation summary |
| `COURSE_OUTLINE_GUIDE.md` | API documentation |
| `EXAMPLE_STRUCTURE.md` | Visual examples |

## Customization

Edit `server/ai-service.ts`:
```javascript
const targetModules = 6;   // # of modules
const targetChapters = 3;  // # of chapters per module
```

## Workflow

1. Create course via UI or API
2. Call `/generate-outline` endpoint
3. System creates modules + chapters
4. Instructors add content to chapters
5. Publish course

## Reliability Features

🔄 **Auto-Retry**: 3 attempts with exponential backoff (1s, 2s, 4s)
🛡️ **Fallback**: Generic outline if AI unavailable
✅ **Always Works**: Course creation never fails

---

For more details, see `COURSE_OUTLINE_README.md` or `TEST_COURSE_OUTLINE.md`
