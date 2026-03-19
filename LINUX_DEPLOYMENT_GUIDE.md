# OpusLearn Linux Deployment Guide

A comprehensive step-by-step guide to deploy OpusLearn e-learning platform on Linux with PostgreSQL database.

## Table of Contents
- [Prerequisites](#prerequisites)
- [System Preparation](#system-preparation)
- [Node.js Installation](#nodejs-installation)
- [PostgreSQL Installation](#postgresql-installation)
- [Application Setup](#application-setup)
- [Database Configuration](#database-configuration)
- [Build and Test](#build-and-test)
- [Production Service Setup](#production-service-setup)
- [Reverse Proxy Configuration](#reverse-proxy-configuration)
- [SSL Certificate](#ssl-certificate)
- [Firewall Configuration](#firewall-configuration)
- [Backup Strategy](#backup-strategy)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / Rocky Linux 9+
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Storage**: At least 10GB free space
- **Network**: Internet connection for package installation
- **User**: Root access or sudo privileges

### Required Software Versions
- **Node.js**: v18 or higher
- **npm**: v8 or higher
- **PostgreSQL**: v13 or higher
- **Git**: Latest version
- **Nginx**: Latest version (for reverse proxy)

## System Preparation

### 1. Update System Packages

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt upgrade -y
```

**CentOS/RHEL/Rocky Linux:**
```bash
sudo dnf update -y
```

### 2. Install Essential Build Tools

**Ubuntu/Debian:**
```bash
sudo apt install -y curl wget git build-essential software-properties-common
```

**CentOS/RHEL/Rocky Linux:**
```bash
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y curl wget git epel-release
```

## Node.js Installation

### Using NodeSource Repository (Recommended)

**Ubuntu/Debian:**
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**CentOS/RHEL/Rocky Linux:**
```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs npm
```

### Verify Installation
```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 8.x.x or higher
```

## PostgreSQL Installation

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt install -y postgresql postgresql-contrib postgresql-client
```

**CentOS/RHEL/Rocky Linux:**
```bash
sudo dnf install -y postgresql postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
```

### 2. Start and Enable PostgreSQL Service
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

### 3. Configure PostgreSQL

#### Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Execute these commands in PostgreSQL shell:
CREATE DATABASE opus_authoring;
CREATE USER opus_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE opus_authoring TO opus_user;
ALTER USER opus_user CREATEDB;
\q
```

#### Configure Authentication
```bash
# Find and edit pg_hba.conf
# Ubuntu/Debian path:
sudo nano /etc/postgresql/13/main/pg_hba.conf

# CentOS/RHEL path:
sudo nano /var/lib/pgsql/data/pg_hba.conf

# Change this line from 'peer' to 'md5':
# local   all             all                                     md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Test Database Connection
```bash
psql -h localhost -U opus_user -d opus_authoring -c "SELECT version();"
```

## Application Setup

### 1. Create Application User (Security Best Practice)
```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash opuslearn
sudo mkdir -p /home/opuslearn
sudo chown opuslearn:opuslearn /home/opuslearn

# Switch to application user
sudo su - opuslearn
```

### 2. Clone Repository
```bash
cd /home/opuslearn
git clone https://github.com/manimarant/OpusAuthoring.git
cd OpusAuthoring
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

#### Configure .env File
```env
# Database Configuration
DATABASE_URL="postgresql://opus_user:your_secure_password_here@localhost:5432/opus_authoring"

# Server Configuration
PORT=5000
NODE_ENV=production

# AI Services (Required for content generation)
GEMINI_API_KEY="your_gemini_api_key_here"
BFL_API_KEY="your_black_forest_labs_api_key_here"

# Session Security (Generate a secure 32+ character string)
SESSION_SECRET="your_very_secure_session_secret_here_min_32_chars"

# File Upload Settings
MAX_FILE_SIZE=10485760
UPLOAD_PATH="./uploads"
```

### 5. Create Required Directories
```bash
mkdir -p uploads
mkdir -p logs
mkdir -p backups
chmod 755 uploads
```

## Database Configuration

### 1. Setup Database Schema

**Option A: Using Drizzle Kit (Recommended)**
```bash
# Push schema to database (creates all tables)
npm run db:push
```

**Option B: Manual Schema Creation**
```bash
# Create comprehensive database schema file
cat > database_schema.sql << 'EOF'
-- OpusLearn Database Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Course themes table
CREATE TABLE IF NOT EXISTS course_themes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    is_default TEXT DEFAULT 'false',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    learning_objectives TEXT NOT NULL,
    duration TEXT,
    difficulty TEXT,
    reference_urls JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    theme_id VARCHAR REFERENCES course_themes(id),
    cover_image TEXT,
    logo TEXT,
    navigation_restricted TEXT DEFAULT 'false',
    sidebar_visible TEXT DEFAULT 'open',
    search_enabled TEXT DEFAULT 'true',
    completion_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR NOT NULL REFERENCES courses(id),
    parent_module_id VARCHAR REFERENCES modules(id),
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    "order" TEXT NOT NULL,
    thumbnail TEXT,
    lesson_type TEXT NOT NULL DEFAULT 'block',
    icon TEXT DEFAULT 'book',
    navigation_settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Content blocks table
CREATE TABLE IF NOT EXISTS content_blocks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id VARCHAR NOT NULL REFERENCES modules(id),
    type TEXT NOT NULL,
    block_style TEXT DEFAULT 'default',
    content JSONB NOT NULL,
    styling JSONB DEFAULT '{}',
    accessibility JSONB DEFAULT '{}',
    "order" TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Reference files table
CREATE TABLE IF NOT EXISTS reference_files (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR NOT NULL REFERENCES courses(id),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Media assets table
CREATE TABLE IF NOT EXISTS media_assets (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR REFERENCES courses(id),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    uploaded_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Question banks table
CREATE TABLE IF NOT EXISTS question_banks (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id VARCHAR NOT NULL REFERENCES courses(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Quiz questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    question_bank_id VARCHAR REFERENCES question_banks(id),
    module_id VARCHAR REFERENCES modules(id),
    type TEXT NOT NULL,
    question TEXT NOT NULL,
    options JSONB DEFAULT '{}',
    explanation TEXT,
    points TEXT DEFAULT '1',
    "order" TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Block templates table
CREATE TABLE IF NOT EXISTS block_templates (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    block_type TEXT NOT NULL,
    template_data JSONB NOT NULL,
    is_public TEXT DEFAULT 'false',
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_parent_module_id ON modules(parent_module_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_parent ON modules(course_id, parent_module_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_module_id ON content_blocks(module_id);
CREATE INDEX IF NOT EXISTS idx_reference_files_course_id ON reference_files(course_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_course_id ON media_assets(course_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_course_id ON question_banks(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_bank_id ON quiz_questions(question_bank_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_module_id ON quiz_questions(module_id);

-- Constraints
ALTER TABLE quiz_questions ADD CONSTRAINT check_quiz_question_parent 
    CHECK ((question_bank_id IS NULL) != (module_id IS NULL));
EOF

# Execute schema creation
psql -h localhost -U opus_user -d opus_authoring -f database_schema.sql
```

### 2. Run Additional Migrations
```bash
# If migration files exist, run them
if [ -f "run-migration.js" ]; then
    node run-migration.js
fi
```

### 3. Insert Default Data
```bash
# Insert default course theme
psql -h localhost -U opus_user -d opus_authoring -c "
INSERT INTO course_themes (name, is_default, settings) 
VALUES (
    'Default Theme', 
    'true', 
    '{\"layout\": \"sidebar\", \"colors\": {\"primary\": \"#2563eb\", \"secondary\": \"#64748b\"}, \"navigation\": {\"style\": \"modern\", \"position\": \"left\"}}'
) ON CONFLICT DO NOTHING;
"
```

### 4. Verify Database Setup
```bash
# List all tables
psql -h localhost -U opus_user -d opus_authoring -c "\dt"

# Verify modules table structure
psql -h localhost -U opus_user -d opus_authoring -c "
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'modules' 
ORDER BY ordinal_position;
"
```

## Build and Test

### 1. Build Application for Production
```bash
npm run build
```

### 2. Test Production Build
```bash
# Test that the application starts correctly
npm start
# Press Ctrl+C to stop after verifying it works
```

### 3. Run Type Checking
```bash
npm run check
```

## Production Service Setup

### 1. Create Systemd Service File
```bash
# Exit from opuslearn user back to root/sudo user
exit

# Create service file
sudo tee /etc/systemd/system/opuslearn.service > /dev/null << 'EOF'
[Unit]
Description=OpusLearn E-Learning Platform
Documentation=https://github.com/manimarant/OpusAuthoring
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=opuslearn
Group=opuslearn
WorkingDirectory=/home/opuslearn/OpusAuthoring
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=opuslearn

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/home/opuslearn/OpusAuthoring/uploads /home/opuslearn/OpusAuthoring/logs

[Install]
WantedBy=multi-user.target
EOF
```

### 2. Enable and Start Service
```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable opuslearn

# Start the service
sudo systemctl start opuslearn

# Check service status
sudo systemctl status opuslearn

# View service logs
sudo journalctl -u opuslearn -f
```

## Reverse Proxy Configuration

### 1. Install Nginx

**Ubuntu/Debian:**
```bash
sudo apt install -y nginx
```

**CentOS/RHEL/Rocky Linux:**
```bash
sudo dnf install -y nginx
```

### 2. Configure Nginx
```bash
# Remove default site (Ubuntu/Debian)
sudo rm -f /etc/nginx/sites-enabled/default

# Create OpusLearn site configuration
sudo tee /etc/nginx/sites-available/opuslearn > /dev/null << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Client max body size (for file uploads)
    client_max_body_size 10M;
    
    # Static file serving with caching
    location /uploads/ {
        alias /home/opuslearn/OpusAuthoring/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    location /dist/ {
        alias /home/opuslearn/OpusAuthoring/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # Proxy to Node.js application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
```

### 3. Enable Nginx Site

**Ubuntu/Debian:**
```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/opuslearn /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**CentOS/RHEL/Rocky Linux:**
```bash
# Copy configuration to conf.d
sudo cp /etc/nginx/sites-available/opuslearn /etc/nginx/conf.d/opuslearn.conf

# Test Nginx configuration
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## SSL Certificate

### Using Let's Encrypt with Certbot

### 1. Install Certbot

**Ubuntu/Debian:**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

**CentOS/RHEL/Rocky Linux:**
```bash
sudo dnf install -y certbot python3-certbot-nginx
```

### 2. Obtain SSL Certificate
```bash
# Replace with your actual domain
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 3. Setup Automatic Renewal
```bash
# Add crontab entry for automatic renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Firewall Configuration

### UFW (Ubuntu/Debian)
```bash
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw delete allow 'Nginx HTTP'  # Remove HTTP if using HTTPS only
sudo ufw status
```

### Firewalld (CentOS/RHEL/Rocky Linux)
```bash
sudo systemctl start firewalld
sudo systemctl enable firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

## Backup Strategy

### 1. Create Backup Directory and Script
```bash
sudo mkdir -p /opt/backups/opuslearn
sudo chown opuslearn:opuslearn /opt/backups/opuslearn

# Create backup script
sudo tee /opt/backups/backup-opuslearn.sh > /dev/null << 'EOF'
#!/bin/bash

set -e  # Exit on error

BACKUP_DIR="/opt/backups/opuslearn"
DATE=$(date +"%Y%m%d_%H%M%S")
DB_NAME="opus_authoring"
DB_USER="opus_user"
DB_PASSWORD="your_secure_password_here"  # Replace with actual password
APP_DIR="/home/opuslearn/OpusAuthoring"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup process: $DATE"

# Database backup
echo "Backing up database..."
export PGPASSWORD="$DB_PASSWORD"
pg_dump -h localhost -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/db_backup_$DATE.sql"
unset PGPASSWORD

# Application files backup (excluding node_modules and other unnecessary files)
echo "Backing up application files..."
tar -czf "$BACKUP_DIR/app_backup_$DATE.tar.gz" \
    --exclude="node_modules" \
    --exclude="dist" \
    --exclude=".git" \
    --exclude="logs" \
    --exclude="*.log" \
    -C /home/opuslearn OpusAuthoring/

# Uploads backup (separate for easier restoration)
echo "Backing up uploaded files..."
if [ -d "$APP_DIR/uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads_backup_$DATE.tar.gz" -C "$APP_DIR" uploads/
fi

# Keep only last 7 days of backups
echo "Cleaning old backups..."
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

# Calculate sizes
DB_SIZE=$(du -h "$BACKUP_DIR/db_backup_$DATE.sql" | cut -f1)
APP_SIZE=$(du -h "$BACKUP_DIR/app_backup_$DATE.tar.gz" | cut -f1)

echo "Backup completed successfully!"
echo "Database backup: $DB_SIZE"
echo "Application backup: $APP_SIZE"
echo "Location: $BACKUP_DIR"
EOF

# Make script executable
sudo chmod +x /opt/backups/backup-opuslearn.sh
```

### 2. Schedule Automated Backups
```bash
# Add to crontab for daily backups at 2 AM
sudo crontab -e
# Add this line:
# 0 2 * * * /opt/backups/backup-opuslearn.sh >> /var/log/opuslearn-backup.log 2>&1
```

### 3. Test Backup Script
```bash
# Run backup script manually to test
sudo /opt/backups/backup-opuslearn.sh
```

## Monitoring and Logging

### 1. Configure Log Rotation
```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/opuslearn > /dev/null << 'EOF'
/home/opuslearn/OpusAuthoring/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 opuslearn opuslearn
    postrotate
        systemctl reload opuslearn > /dev/null 2>&1 || true
    endscript
}
EOF
```

### 2. System Monitoring Commands
```bash
# View application logs
sudo journalctl -u opuslearn -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View PostgreSQL logs (Ubuntu/Debian)
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# View PostgreSQL logs (CentOS/RHEL)
sudo tail -f /var/lib/pgsql/data/log/postgresql-*.log

# System resource monitoring
htop
df -h  # Disk space
free -m  # Memory usage
netstat -tlnp  # Network ports
```

### 3. Install Monitoring Tools
```bash
# Install system monitoring tools
sudo apt install -y htop iotop nethogs  # Ubuntu/Debian
sudo dnf install -y htop iotop nethogs  # CentOS/RHEL
```

### 4. Health Check Script
```bash
# Create health check script
sudo tee /usr/local/bin/opuslearn-health.sh > /dev/null << 'EOF'
#!/bin/bash

echo "OpusLearn Health Check - $(date)"
echo "================================"

# Check service status
echo "Service Status:"
systemctl is-active opuslearn && echo "✅ OpusLearn service: Running" || echo "❌ OpusLearn service: Not running"
systemctl is-active nginx && echo "✅ Nginx service: Running" || echo "❌ Nginx service: Not running"
systemctl is-active postgresql && echo "✅ PostgreSQL service: Running" || echo "❌ PostgreSQL service: Not running"

echo ""

# Check HTTP response
echo "HTTP Response:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Application HTTP: $HTTP_STATUS"
else
    echo "❌ Application HTTP: $HTTP_STATUS"
fi

echo ""

# Check database connection
echo "Database Connection:"
if sudo -u postgres psql -d opus_authoring -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database: Accessible"
else
    echo "❌ Database: Connection failed"
fi

echo ""

# Check disk space
echo "Disk Usage:"
df -h / | tail -1 | awk '{print "Root filesystem: " $5 " used of " $2}'
df -h /home/opuslearn | tail -1 | awk '{print "Application directory: " $5 " used of " $2}'

echo ""

# Check memory usage
echo "Memory Usage:"
free -h | grep "Mem:" | awk '{print "Memory: " $3 " used of " $2 " (" $3/$2*100 "% used)"}'

echo ""
echo "Health check completed."
EOF

sudo chmod +x /usr/local/bin/opuslearn-health.sh

# Run health check
sudo /usr/local/bin/opuslearn-health.sh
```

## Final Verification

### 1. Access Application
```bash
# Test local access
curl -I http://localhost
curl -I http://localhost:5000

# If you have a domain configured:
curl -I http://your-domain.com
```

### 2. Functional Testing
1. **Registration**: Create a new user account
2. **Login**: Test authentication
3. **Course Creation**: Create a sample course
4. **File Upload**: Test media upload functionality
5. **Database Verification**: Check data persistence

### 3. Performance Testing
```bash
# Test application startup time
sudo systemctl restart opuslearn
time sudo systemctl is-active opuslearn

# Monitor resource usage during startup
sudo systemctl restart opuslearn && htop
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Application Won't Start
```bash
# Check service logs
sudo journalctl -u opuslearn -n 50 --no-pager

# Check if port is already in use
sudo netstat -tlnp | grep :5000

# Verify environment variables
sudo -u opuslearn bash -c 'cd /home/opuslearn/OpusAuthoring && printenv | grep DATABASE_URL'

# Test database connection manually
sudo -u opuslearn bash -c 'cd /home/opuslearn/OpusAuthoring && psql "$DATABASE_URL" -c "SELECT version();"'
```

#### 2. Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection with psql
psql -h localhost -U opus_user -d opus_authoring -c "SELECT version();"

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log  # Ubuntu
sudo tail -f /var/lib/pgsql/data/log/postgresql-*.log  # CentOS
```

#### 3. Permission Issues
```bash
# Fix ownership and permissions
sudo chown -R opuslearn:opuslearn /home/opuslearn/OpusAuthoring
sudo chmod -R 755 /home/opuslearn/OpusAuthoring
sudo chmod -R 775 /home/opuslearn/OpusAuthoring/uploads
sudo chmod -R 644 /home/opuslearn/OpusAuthoring/.env
```

#### 4. Nginx Issues
```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

#### 5. SSL Certificate Issues
```bash
# Renew certificate manually
sudo certbot renew --force-renewal

# Check certificate status
sudo certbot certificates
```

#### 6. File Upload Issues
```bash
# Check upload directory permissions
ls -la /home/opuslearn/OpusAuthoring/uploads

# Check disk space
df -h

# Check Nginx client_max_body_size setting
sudo grep -r "client_max_body_size" /etc/nginx/
```

### Log Locations
- **Application logs**: `sudo journalctl -u opuslearn`
- **Nginx access logs**: `/var/log/nginx/access.log`
- **Nginx error logs**: `/var/log/nginx/error.log`
- **PostgreSQL logs**: 
  - Ubuntu: `/var/log/postgresql/postgresql-*-main.log`
  - CentOS: `/var/lib/pgsql/data/log/postgresql-*.log`
- **System logs**: `sudo journalctl -xe`

### Emergency Recovery

#### Restore from Backup
```bash
# Stop the application
sudo systemctl stop opuslearn

# Restore database
export PGPASSWORD="your_secure_password_here"
dropdb -h localhost -U opus_user opus_authoring
createdb -h localhost -U opus_user opus_authoring
psql -h localhost -U opus_user -d opus_authoring -f /opt/backups/opuslearn/db_backup_YYYYMMDD_HHMMSS.sql

# Restore application files
cd /home/opuslearn
sudo rm -rf OpusAuthoring
sudo -u opuslearn tar -xzf /opt/backups/opuslearn/app_backup_YYYYMMDD_HHMMSS.tar.gz

# Restore uploads
cd /home/opuslearn/OpusAuthoring
sudo -u opuslearn tar -xzf /opt/backups/opuslearn/uploads_backup_YYYYMMDD_HHMMSS.tar.gz

# Start the application
sudo systemctl start opuslearn
```

## Security Checklist

- [ ] Database uses strong passwords
- [ ] Application runs as non-root user
- [ ] File permissions are correctly set
- [ ] Firewall is configured and active
- [ ] SSL certificate is installed and auto-renewing
- [ ] Regular backups are scheduled
- [ ] System packages are updated
- [ ] Environment variables are secure
- [ ] Nginx security headers are configured
- [ ] Database access is restricted to localhost

## Maintenance Tasks

### Weekly Tasks
- [ ] Review application logs for errors
- [ ] Check system resource usage
- [ ] Verify backup completion
- [ ] Monitor disk space usage

### Monthly Tasks
- [ ] Update system packages
- [ ] Review and rotate logs
- [ ] Test backup restoration process
- [ ] Update Node.js dependencies (test first)
- [ ] Review SSL certificate status

### Performance Optimization
- [ ] Enable PostgreSQL query optimization
- [ ] Configure Nginx caching for static assets
- [ ] Monitor and tune Node.js memory usage
- [ ] Implement log rotation
- [ ] Consider Redis for session storage (for scaling)

---

**Deployment Complete!** 

OpusLearn should now be successfully deployed and running on your Linux server with PostgreSQL database integration. The application will be accessible through your configured domain or server IP address.

For support and updates, refer to the [GitHub repository](https://github.com/manimarant/OpusAuthoring).