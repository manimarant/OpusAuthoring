// Node.js script to run the database migration
// This adds the parent_module_id column to the modules table

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔄 Running database migration...\n');

  // Read connection string from .env
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
  
  if (!dbUrlMatch) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }

  const connectionString = dbUrlMatch[1].trim();
  console.log('📦 Connecting to database...');

  const pool = new Pool({ connectionString });

  try {
    // Read migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_parent_module_id.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing migration SQL...\n');

    // Run the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the column was added
    console.log('🔍 Verifying the column was added...');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'modules' AND column_name = 'parent_module_id'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Column "parent_module_id" confirmed in database');
      console.log(`   Type: ${result.rows[0].data_type}\n`);
    } else {
      console.log('⚠️  Warning: Column not found after migration');
    }

    // Show current modules table structure
    console.log('📊 Current modules table structure:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'modules'
      ORDER BY ordinal_position
    `);

    columnsResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? '(nullable)' : '(required)';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}`);
    });

    console.log('\n🎉 Migration complete! You can now restart your server.\n');
    console.log('Run: npm run dev\n');

  } catch (error) {
    console.error('\n❌ Error running migration:');
    console.error(error.message);
    
    if (error.code === '42701') {
      console.log('\n✅ Good news: Column already exists!');
      console.log('The migration was likely run before. You can proceed.\n');
    } else {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
