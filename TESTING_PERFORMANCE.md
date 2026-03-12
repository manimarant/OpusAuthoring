# Testing Performance Improvements

This guide helps you verify that the page flickering issue has been resolved.

## Prerequisites

1. Server is running: `npm run dev`
2. Have at least one course with modules and chapters created
3. Browser DevTools open (F12) - Network tab and Performance tab

## Test Scenarios

### Test 1: First-Time Chapter Load (Cold Cache)

**Goal**: Verify smooth skeleton UI transition without flickering

**Steps**:
1. Open browser in incognito/private mode (or clear cache)
2. Navigate to "My Courses"
3. Click on a course to launch it
4. **Observe**: 
   - Skeleton UI should appear briefly (~500ms)
   - Smooth transition to full content
   - No white flashes or layout jumps

**Expected**:
- ✅ Brief skeleton UI with pulse animation
- ✅ Smooth fade-in to actual content
- ❌ No white screen flash
- ❌ No layout shifting

### Test 2: Subsequent Chapter Navigation (Warm Cache)

**Goal**: Verify instant navigation with placeholder data

**Steps**:
1. After Test 1, stay on the same course
2. Click on a different chapter in the navigation
3. **Observe**:
   - Should be nearly instant (<50ms)
   - Previous content briefly visible while new content loads
   - No skeleton UI shown

**Expected**:
- ✅ Instant navigation
- ✅ Previous data shows briefly (placeholder)
- ✅ No flickering or white screens
- ❌ No skeleton UI (unless >30s since last fetch)

### Test 3: Adjacent Chapter Navigation (Prefetched)

**Goal**: Verify instant navigation to next/previous chapters

**Steps**:
1. Navigate to any chapter
2. Wait 2 seconds (for prefetch to complete)
3. Click the next chapter in the navigation
4. **Observe**:
   - Should be completely instant (<10ms)
   - No loading indicator at all

**Expected**:
- ✅ Completely instant navigation
- ✅ Data ready immediately
- ✅ Feels like a single-page app

### Test 4: Rapid Chapter Switching

**Goal**: Verify smooth experience with multiple rapid clicks

**Steps**:
1. Navigate to a module with multiple chapters
2. Quickly click through 5-6 different chapters
3. **Observe**:
   - Each transition should be smooth
   - Content should update without flashing

**Expected**:
- ✅ Smooth transitions for all clicks
- ✅ No cumulative flickering
- ✅ System stays responsive

### Test 5: Stale Data Refetch

**Goal**: Verify smooth refetch after stale time expires

**Steps**:
1. Navigate to a chapter
2. Wait 35 seconds (module staleTime is 30s)
3. Navigate to another chapter, then back to the first
4. **Observe**:
   - Should still use placeholder data
   - New fetch happens in background
   - No visible loading state

**Expected**:
- ✅ Instant navigation with placeholder data
- ✅ Background refetch (see Network tab)
- ✅ Smooth update when new data arrives

## Browser DevTools Verification

### Network Tab
1. Open DevTools → Network tab
2. Navigate between chapters
3. **Check**:
   - First chapter: Multiple requests (module, course, content-blocks)
   - Adjacent chapters: Should show requests were fulfilled from cache
   - Prefetch: Should see requests for next/previous chapters in background

### Performance Tab
1. Open DevTools → Performance tab
2. Click "Record" 
3. Navigate to a chapter
4. Stop recording
5. **Look for**:
   - Total time < 100ms for cached navigation
   - No long tasks (>50ms)
   - Smooth frame rate (60fps)

## Visual Regression Testing

### What Good Performance Looks Like

**First Load**:
```
[Skeleton UI with animation] → [Fade to content] → [Content displayed]
                ~500ms                ~100ms
```

**Subsequent Load**:
```
[Current content] → [Placeholder content] → [New content]
    instant              instant              instant
```

**Adjacent Chapter (Prefetched)**:
```
[Current content] → [New content]
       instant
```

### What Bad Performance Looks Like (Before Fix)

**First Load** ❌:
```
[White flash] → [Skeleton] → [White flash] → [Content] → [Flash]
   flickering     brief        flickering      brief      flickering
```

**Subsequent Load** ❌:
```
[Content] → [White screen] → [Skeleton] → [Content]
   brief      flickering       brief      flickering
```

## Common Issues & Troubleshooting

### Issue: Still seeing flickering

**Possible causes**:
1. Browser cache not cleared for incognito test
2. React Query DevTools interfering
3. Changes not compiled

**Solutions**:
```bash
# Rebuild the application
npm run build

# Clear all caches
# In browser: Ctrl+Shift+Delete → Clear everything

# Restart dev server
# Ctrl+C then npm run dev
```

### Issue: Navigation is slow

**Possible causes**:
1. Server responding slowly
2. Large content blocks
3. Network throttling enabled

**Solutions**:
- Check server logs for errors
- Check DevTools Network tab for slow requests
- Disable throttling in DevTools

### Issue: Skeleton UI shows too long

**Expected**: <500ms on first load only
**If longer**: Check Network tab for slow API responses

## Performance Metrics to Record

Create a simple table to track improvements:

| Test | Before Fix | After Fix | Status |
|------|-----------|-----------|--------|
| Cold cache (first load) | ~500ms + flicker | ~500ms smooth | ✅ |
| Warm cache (subsequent) | ~200ms + flicker | <50ms smooth | ✅ |
| Adjacent (prefetched) | ~300ms + loading | <10ms instant | ✅ |
| Rapid switching | Cumulative lag | Consistently smooth | ✅ |

## Success Criteria

All of the following should be true:

- ✅ No white screen flashes during navigation
- ✅ Skeleton UI only on true first load
- ✅ Subsequent navigation feels instant
- ✅ Adjacent chapter navigation is completely instant
- ✅ Rapid clicking doesn't cause flickering
- ✅ Loading states are smooth and purposeful
- ✅ User doesn't feel like page is "refreshing"

## Next Steps

If all tests pass:
- ✅ Performance improvements verified
- ✅ Ready for production
- ✅ User experience significantly improved

If tests fail:
1. Check ALL_FIXES_SUMMARY.md for verification steps
2. Ensure server was restarted after changes
3. Clear browser cache completely
4. Check browser console for errors
5. Review PERFORMANCE_IMPROVEMENTS.md for technical details
