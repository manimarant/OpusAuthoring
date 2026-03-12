import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:Starbucks%239@localhost:5432/opus_authoring'
});

async function checkColumns() {
  try {
    console.log('Checking content_blocks table columns:\n');
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'content_blocks' 
      ORDER BY ordinal_position
    `);
    
    result.rows.forEach(row => {
      console.log('  -', row.column_name);
    });
    
    console.log('\n\nChecking quiz_questions table columns:\n');
    const result2 = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quiz_questions' 
      ORDER BY ordinal_position
    `);
    
    result2.rows.forEach(row => {
      console.log('  -', row.column_name);
    });
    
  } finally {
    await pool.end();
  }
}

checkColumns();
