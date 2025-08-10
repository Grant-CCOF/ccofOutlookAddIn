#!/bin/bash

# Capital Choice Platform Backup Script
# Performs automated backups of database, uploads, and configuration

# Configuration
APP_NAME="capital-choice-platform"
APP_DIR="/opt/$APP_NAME"
BACKUP_DIR="$APP_DIR/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_RETENTION_DAYS=30

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Log file
LOG_FILE="$APP_DIR/logs/backup.log"

# Function to log messages
log_message() {
    echo -e "$1" | tee -a "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Function to check disk space
check_disk_space() {
    AVAILABLE_SPACE=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=1048576  # 1GB in KB
    
    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
        log_message "${RED}[ERROR]${NC} Insufficient disk space for backup"
        exit 1
    fi
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Start backup
log_message "${GREEN}[INFO]${NC} Starting backup process at $(date)"

# Check disk space
check_disk_space

# Backup database
if [[ -f "$APP_DIR/database.sqlite" ]]; then
    DB_BACKUP="$BACKUP_DIR/database_$DATE.sqlite"
    cp "$APP_DIR/database.sqlite" "$DB_BACKUP"
    
    if [[ -f "$DB_BACKUP" ]]; then
        # Compress the database backup
        gzip "$DB_BACKUP"
        DB_SIZE=$(du -h "$DB_BACKUP.gz" | cut -f1)
        log_message "${GREEN}[SUCCESS]${NC} Database backed up: $DB_BACKUP.gz (Size: $DB_SIZE)"
    else
        log_message "${RED}[ERROR]${NC} Failed to backup database"
    fi
else
    log_message "${YELLOW}[WARNING]${NC} Database file not found"
fi

# Backup uploads directory
if [[ -d "$APP_DIR/uploads" ]]; then
    UPLOADS_BACKUP="$BACKUP_DIR/uploads_$DATE.tar.gz"
    tar -czf "$UPLOADS_BACKUP" -C "$APP_DIR" uploads/ 2>/dev/null
    
    if [[ -f "$UPLOADS_BACKUP" ]]; then
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP" | cut -f1)
        log_message "${GREEN}[SUCCESS]${NC} Uploads backed up: $UPLOADS_BACKUP (Size: $UPLOADS_SIZE)"
    else
        log_message "${YELLOW}[WARNING]${NC} No uploads to backup or backup failed"
    fi
else
    log_message "${YELLOW}[WARNING]${NC} Uploads directory not found"
fi

# Backup public files (in case of customization)
if [[ -d "$APP_DIR/public" ]]; then
    PUBLIC_BACKUP="$BACKUP_DIR/public_$DATE.tar.gz"
    tar -czf "$PUBLIC_BACKUP" -C "$APP_DIR" \
        --exclude='*.log' \
        --exclude='node_modules' \
        --exclude='*.tmp' \
        public/ 2>/dev/null
    
    if [[ -f "$PUBLIC_BACKUP" ]]; then
        PUBLIC_SIZE=$(du -h "$PUBLIC_BACKUP" | cut -f1)
        log_message "${GREEN}[SUCCESS]${NC} Public files backed up: $PUBLIC_BACKUP (Size: $PUBLIC_SIZE)"
    else
        log_message "${YELLOW}[WARNING]${NC} Failed to backup public files"
    fi
fi

# Backup configuration files
if [[ -f "$APP_DIR/.env" ]]; then
    CONFIG_BACKUP="$BACKUP_DIR/config_$DATE.tar.gz"
    tar -czf "$CONFIG_BACKUP" -C "$APP_DIR" \
        .env \
        ecosystem.config.js \
        package.json \
        2>/dev/null
    
    if [[ -f "$CONFIG_BACKUP" ]]; then
        CONFIG_SIZE=$(du -h "$CONFIG_BACKUP" | cut -f1)
        log_message "${GREEN}[SUCCESS]${NC} Configuration backed up: $CONFIG_BACKUP (Size: $CONFIG_SIZE)"
    else
        log_message "${YELLOW}[WARNING]${NC} Failed to backup configuration"
    fi
else
    log_message "${YELLOW}[WARNING]${NC} Configuration files not found"
fi

# Create a manifest file with backup information
MANIFEST_FILE="$BACKUP_DIR/manifest_$DATE.txt"
cat > "$MANIFEST_FILE" << MANIFEST
Backup Manifest
===============
Date: $(date)
Hostname: $(hostname)
Application: $APP_NAME
Directory: $APP_DIR

Files Backed Up:
----------------
$(ls -la "$BACKUP_DIR" | grep "$DATE")

Disk Usage:
-----------
$(df -h "$BACKUP_DIR")

Database Info:
--------------
$(if [[ -f "$APP_DIR/database.sqlite" ]]; then
    echo "Size: $(du -h "$APP_DIR/database.sqlite" | cut -f1)"
    echo "Tables: $(sqlite3 "$APP_DIR/database.sqlite" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null | wc -l)"
else
    echo "Database not found"
fi)

Application Status:
-------------------
$(if command -v pm2 &> /dev/null; then
    pm2 show "$APP_NAME" 2>/dev/null | grep -E "status|uptime|restarts" || echo "PM2 process not found"
else
    systemctl status "$APP_NAME" 2>/dev/null | grep -E "Active|Main PID" || echo "Service not found"
fi)
MANIFEST

log_message "${GREEN}[INFO]${NC} Backup manifest created: $MANIFEST_FILE"

# Remove old backups (older than retention period)
log_message "${GREEN}[INFO]${NC} Cleaning up old backups (older than $BACKUP_RETENTION_DAYS days)..."

# Count files before cleanup
BEFORE_COUNT=$(find "$BACKUP_DIR" -type f -name "*.gz" -o -name "*.txt" | wc -l)

# Remove old database backups
find "$BACKUP_DIR" -name "database_*.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null

# Remove old upload backups
find "$BACKUP_DIR" -name "uploads_*.tar.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null

# Remove old public backups
find "$BACKUP_DIR" -name "public_*.tar.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null

# Remove old config backups
find "$BACKUP_DIR" -name "config_*.tar.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null

# Remove old manifest files
find "$BACKUP_DIR" -name "manifest_*.txt" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null

# Count files after cleanup
AFTER_COUNT=$(find "$BACKUP_DIR" -type f -name "*.gz" -o -name "*.txt" | wc -l)
REMOVED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))

if [ $REMOVED_COUNT -gt 0 ]; then
    log_message "${GREEN}[INFO]${NC} Removed $REMOVED_COUNT old backup files"
fi

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log_message "${GREEN}[INFO]${NC} Total backup directory size: $TOTAL_SIZE"

# Optional: Sync to remote storage (uncomment and configure if needed)
# if command -v aws &> /dev/null; then
#     log_message "${GREEN}[INFO]${NC} Syncing to S3..."
#     aws s3 sync "$BACKUP_DIR" "s3://your-bucket-name/backups/" --delete
#     log_message "${GREEN}[SUCCESS]${NC} Backups synced to S3"
# fi

# Send notification if email is configured
if [[ -n "$BACKUP_EMAIL" ]]; then
    SUBJECT="Backup Report - $APP_NAME - $(date +%Y-%m-%d)"
    BODY="Backup completed successfully\n\nTotal Size: $TOTAL_SIZE\nBackup Location: $BACKUP_DIR"
    echo -e "$BODY" | mail -s "$SUBJECT" "$BACKUP_EMAIL" 2>/dev/null || log_message "${YELLOW}[WARNING]${NC} Failed to send email notification"
fi

log_message "${GREEN}[SUCCESS]${NC} Backup completed at $(date)"
log_message "========================================="

# Exit successfully
exit 0