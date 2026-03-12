# PowerShell script to run the database migration
# This adds the parent_module_id column to the modules table

$ErrorActionPreference = "Stop"

Write-Host "Running database migration..." -ForegroundColor Yellow

# Database connection details from .env
$env:PGPASSWORD = "Starbucks#9"
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "opus_authoring"
$dbUser = "postgres"

# Path to migration file
$migrationFile = "migrations\add_parent_module_id.sql"

Write-Host "Connecting to database: $dbName at $dbHost" -ForegroundColor Cyan

try {
    # Run the migration using psql
    $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host "`nVerifying the column was added..." -ForegroundColor Cyan
        
        # Verify the column exists
        $verifyQuery = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'modules' AND column_name = 'parent_module_id';"
        $verification = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $verifyQuery 2>&1
        
        if ($verification -match "parent_module_id") {
            Write-Host "✅ Column 'parent_module_id' confirmed in database" -ForegroundColor Green
        }
    } else {
        Write-Host "`n❌ Migration failed!" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
} catch {
    Write-Host "`n❌ Error running migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "`nMake sure PostgreSQL command-line tools (psql) are installed and in your PATH" -ForegroundColor Yellow
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`n🎉 Done! You can now restart your server with: npm run dev" -ForegroundColor Green
