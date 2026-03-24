
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runLtiMigration() {
  console.log('🔄 Running LTI platforms table migration...\n');

  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in .env file or environment');
    process.exit(1);
  }

  console.log('📦 Connecting to database...');
  const pool = new Pool({ connectionString });

  try {
    // Read migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_lti_platforms.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing LTI platforms migration SQL...\n');

    // Run the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the table was created
    console.log('🔍 Verifying the table was created...');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'lti_platforms'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Table "lti_platforms" confirmed in database');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
      console.log('');
    } else {
      console.log('⚠️  Warning: Table not found after migration\n');
    }

    console.log('🎉 LTI Migration complete! You can now use LTI features.\n');

  } catch (error) {
    console.error('\n❌ Error running LTI migration:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runLtiMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
