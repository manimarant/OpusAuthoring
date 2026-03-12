import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Starbucks%239@localhost:5432/opus_authoring'
});

async function debugCourse() {
  try {
    // Get all courses with their module info
    console.log('=== Courses ===\n');
    const courses = await pool.query(`
      SELECT id, title, created_at 
      FROM courses 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    if (courses.rows.length === 0) {
      console.log('No courses found. Create one first!');
      await pool.end();
      return;
    }
    
    for (const course of courses.rows) {
      console.log(`Course: ${course.title} (${course.id})\n`);
      
      // Get modules for this course
      const modules = await pool.query(`
        SELECT id, title, parent_module_id, "order"
        FROM modules 
        WHERE course_id = $1
        ORDER BY "order"::integer
      `, [course.id]);
      
      console.log('  Modules:');
      modules.rows.forEach(mod => {
        const type = mod.parent_module_id ? '    📄 Chapter' : '  📖 Parent';
        console.log(`    ${type}: ${mod.title} (ID: ${mod.id})`);
      });
      
      // Check what the getCourses query would return
      const launchInfo = await pool.query(`
        WITH ranked_modules AS (
            SELECT
                m.id,
                m.course_id,
                m.parent_module_id,
                ROW_NUMBER() OVER(PARTITION BY m.course_id ORDER BY m.order::integer) as rn
            FROM modules m
        ),
        first_parent_modules AS (
            SELECT id, course_id FROM ranked_modules WHERE rn = 1 AND parent_module_id IS NULL
        ),
        first_child_modules AS (
            SELECT 
                m.id,
                m.parent_module_id,
                ROW_NUMBER() OVER(PARTITION BY m.parent_module_id ORDER BY m.order::integer) as child_rn
            FROM modules m
            WHERE m.parent_module_id IS NOT NULL
        ),
        first_chapters AS (
            SELECT id, parent_module_id FROM first_child_modules WHERE child_rn = 1
        )
        SELECT
            c.id as course_id,
            fpm.id as parent_module_id,
            fc.id as first_chapter_id,
            COALESCE(fc.id, fpm.id) as "firstModuleId"
        FROM courses c
        LEFT JOIN first_parent_modules fpm ON c.id = fpm.course_id
        LEFT JOIN first_chapters fc ON fpm.id = fc.parent_module_id
        WHERE c.id = $1
      `, [course.id]);
      
      console.log('\n  Launch Info:');
      if (launchInfo.rows.length > 0) {
        const info = launchInfo.rows[0];
        console.log(`    Parent Module ID: ${info.parent_module_id}`);
        console.log(`    First Chapter ID: ${info.first_chapter_id}`);
        console.log(`    firstModuleId (used): ${info.firstModuleId}`);
        
        if (info.firstModuleId) {
          console.log(`    ✅ Launch URL: /module/${info.firstModuleId}/content`);
        } else {
          console.log(`    ❌ No launch URL available (no modules)`);
        }
      } else {
        console.log('    ❌ Query returned no results');
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
  } finally {
    await pool.end();
  }
}

debugCourse();
