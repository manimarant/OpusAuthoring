-- SQL commands to reset cover images for specific courses
-- This will force them to regenerate with new image selection

-- Option 1: Reset cover image for the Cyber Security course specifically
-- UPDATE courses SET coverImage = NULL WHERE title LIKE '%Cyber Security%';

-- Option 2: Reset ALL course cover images (use carefully!)
-- UPDATE courses SET coverImage = NULL;

-- Option 3: Reset only courses that are currently using the nature-growth image
-- UPDATE courses SET coverImage = NULL WHERE coverImage LIKE '%nature-growth%';

-- After running any of these, the next time you view the course,
-- the system should automatically generate a new cover image using your updated catalog

-- To check current cover images:
SELECT id, title, coverImage FROM courses;