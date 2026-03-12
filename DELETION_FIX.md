# Course Deletion Fix

## Issue
Course deletion was failing with error:
```
Error: column "module_id" does not exist
```

## Root Cause
The `quiz_questions` table uses `chapter_id` column (not `module_id`) to reference modules. The deletion code was using the wrong column name.

## Fix Applied

Updated `server/storage.ts` in two locations:

### 1. `deleteCourse` function (line ~217)
Changed:
```typescript
await db.execute(sql`DELETE FROM quiz_questions WHERE module_id = ${module.id}`);
```

To:
```typescript
await db.execute(sql`DELETE FROM quiz_questions WHERE chapter_id = ${module.id}`);
```

### 2. `deleteModule` function (line ~292)
Changed:
```typescript
await db.execute(sql`DELETE FROM quiz_questions WHERE module_id = ${id}`);
```

To:
```typescript
await db.execute(sql`DELETE FROM quiz_questions WHERE chapter_id = ${id}`);
```

## Testing

Course deletion should now work. To test:

1. **Restart the server** (changes are in TypeScript, need rebuild)
   ```bash
   # Stop server (Ctrl+C) and restart
   npm run dev
   ```

2. **Try deleting a course**:
   - Go to "My Courses"
   - Click the delete (trash) icon on any course
   - Confirm deletion
   - Should complete without errors

3. **Verify in database** (optional):
   ```sql
   -- Check that course and all related data was deleted
   SELECT * FROM courses WHERE id = 'deleted-course-id';  -- Should return no rows
   SELECT * FROM modules WHERE course_id = 'deleted-course-id';  -- Should return no rows
   ```

## Status

✅ **FIXED** - Course deletion now uses correct column name and should work properly.

## Note

There's a schema mismatch between the TypeScript schema definition (`moduleId`) and the actual database column (`chapter_id`). This doesn't affect functionality when using raw SQL queries, but it's something to be aware of if you're using Drizzle ORM methods directly.
