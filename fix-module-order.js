import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Starbucks%239@localhost:5432/opus_authoring'
});

async function fixModuleOrder() {
  try {
    console.log('🔧 Fixing module ordering for existing courses...\n');
    
    // Get all courses
    const courses = await pool.query('SELECT id, title FROM courses');
    
    for (const course of courses.rows) {
      console.log(`Processing: ${course.title}`);
      
      // Get all modules for this course
      const modules = await pool.query(`
        SELECT id, title, parent_module_id, "order"
        FROM modules
        WHERE course_id = $1
        ORDER BY parent_module_id NULLS FIRST, "order"::integer
      `, [course.id]);
      
      if (modules.rows.length === 0) {
        console.log('  No modules found\n');
        continue;
      }
      
      // Reorder: parent modules first, then their chapters
      let globalOrder = 0;
      const updates = [];
      
      // First pass: parent modules (no parent_module_id)
      const parentModules = modules.rows.filter(m => !m.parent_module_id);
      
      for (const parent of parentModules) {
        updates.push({
          id: parent.id,
          newOrder: globalOrder++,
          title: parent.title,
          isParent: true
        });
        
        // Get chapters for this parent
        const chapters = modules.rows.filter(m => m.parent_module_id === parent.id);
        for (const chapter of chapters) {
          updates.push({
            id: chapter.id,
            newOrder: globalOrder++,
            title: chapter.title,
            isParent: false
          });
        }
      }
      
      // Apply updates
      for (const update of updates) {
        await pool.query(
          'UPDATE modules SET "order" = $1 WHERE id = $2',
          [update.newOrder.toString(), update.id]
        );
        const prefix = update.isParent ? '  📖' : '    📄';
        console.log(`${prefix} Order ${update.newOrder}: ${update.title}`);
      }
      
      console.log(`  ✅ Updated ${updates.length} modules\n`);
    }
    
    console.log('🎉 All courses fixed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixModuleOrder();
