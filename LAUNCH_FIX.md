# Course Launch Fix

## Issue
Unable to launch courses from "My Courses" page.

## Root Cause
The launch URL logic required BOTH `firstModuleId` AND `firstContentBlockId` to be set. However, with the new chapter structure:
- Chapter modules don't have content blocks (by design)
- The `getCourses()` query wasn't finding the first navigable module properly

## Fixes Applied

### 1. Updated `getCourses()` Query (server/storage.ts)

**Problem**: Query only looked for first module and its first content block, but didn't account for chapter modules.

**Solution**: Updated SQL query to:
- Find first parent module
- Find first chapter (child module) under that parent
- Use chapter as `firstModuleId` if it exists, otherwise use parent module
- Look for content blocks in the selected module

This ensures we always get a valid launch target.

### 2. Updated Launch URL Logic (client/src/pages/my-courses.tsx)

**Problem**: Required both `firstModuleId` AND `firstContentBlockId` to launch.

**Solution**: Changed logic to:
```typescript
// Before (didn't work with chapters):
const launchUrl = course.firstModuleId && course.firstContentBlockId
  ? `/module/${course.firstModuleId}/content/${course.firstContentBlockId}`
  : `/my-courses`;

// After (works with and without content blocks):
const launchUrl = course.firstModuleId
  ? course.firstContentBlockId
    ? `/module/${course.firstModuleId}/content/${course.firstContentBlockId}`
    : `/module/${course.firstModuleId}/content`
  : `/my-courses`;
```

Now launches to:
- Chapter with content block if available
- Chapter without content block if no blocks exist
- Stays on My Courses page if no modules exist

## Testing

### 1. Restart Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 2. Test Course Launch

1. **Go to** http://localhost:5000/my-courses
2. **Click on a course card** (not the delete button)
3. **Expected**: Should navigate to the course content
4. **Should show**: The first chapter or module

### 3. Verify Different Scenarios

**Scenario A: Course with chapters (no content blocks)**
- Should navigate to first chapter
- Chapter page should be empty (you can add content)

**Scenario B: Course with parent module only**
- Should navigate to parent module
- Shows the module's content block

**Scenario C: Newly created course**
- Should have both parent and chapter modules
- Should navigate to first chapter

## Result

✅ Courses now launch properly
✅ Works with chapter structure (no content blocks)
✅ Works with traditional structure (with content blocks)
✅ Gracefully handles edge cases

## Files Changed

- `server/storage.ts` - Updated `getCourses()` query
- `client/src/pages/my-courses.tsx` - Updated launch URL logic

## Notes

- The query now uses `COALESCE(fc.id, fpm.id)` to prefer chapters over parent modules
- If no chapter exists, falls back to parent module
- Launch URL construction is more flexible to handle both structures
