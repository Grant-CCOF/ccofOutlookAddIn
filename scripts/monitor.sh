#!/bin/bash

# Capital Choice Platform Monitoring Script
# Monitors application health, resources, and performs auto-recovery

# Configuration
APP_NAME="capital-choice-platform"
APP_DIR="/opt/$APP_NAME"
URL="http://localhost:3000/api/health"
LOG_FILE="$APP_DIR/logs/monitor.log"
ERROR_LOG="$APP_DIR/logs/monitor-error.log"
ALERT_EMAIL="${MONITOR_EMAIL:-admin@example.com}"
MAX_RETRIES=3
RETRY_DELAY=10

# Thresholds
DISK_THRESHOLD=80
MEMORY_THRESHOLD=85
CPU_THRESHOLD=90
DB_SIZE_THRESHOLD=500  # MB
RESPONSE_TIME_THRESHOLD=5  # seconds

# Colors for console output (if run manually)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track alert state to avoid spam
ALERT_STATE_FILE="/tmp/${APP_NAME}_monitor_state"

# Function to log messages
log_message() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    if [[ "$level" == "ERROR" ]]; then
        echo "[$timestamp] $message" >> "$ERROR_LOG"
    fi
    
    # If running in terminal, show colored output
    if [ -t 1 ]; then
        case $level in
            ERROR)   echo -e "${RED}[$level]${NC} $message" ;;
            WARNING) echo -e "${YELLOW}[$level]${NC} $message" ;;
            SUCCESS) echo -e "${GREEN}[$level]${NC} $message" ;;
            *)       echo "[$level] $message" ;;
        esac
    fi
}

# Function to send alerts
send_alert() {
    local subject=$1
    local message=$2
    local alert_key=$3
    
    # Check if we've already sent this alert recently (within 1 hour)
    if [[ -f "$ALERT_STATE_FILE" ]]; then
        last_alert=$(grep "$alert_key" "$ALERT_STATE_FILE" 2>/dev/null | cut -d: -f2)
        if [[ -n "$last_alert" ]]; then
            current_time=$(date +%s)
            time_diff=$((current_time - last_alert))
            if [[ $time_diff -lt 3600 ]]; then
                return  # Skip alert if sent within last hour
            fi
        fi
    fi
    
    # Send email alert if configured
    if command -v mail &> /dev/null && [[ -n "$ALERT_EMAIL" ]]; then
        echo -e "$message" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null
    fi
    
    # Update alert state
    grep -v "$alert_key" "$ALERT_STATE_FILE" 2>/dev/null > "$ALERT_STATE_FILE.tmp" || true
    echo "$alert_key:$(date +%s)" >> "$ALERT_STATE_FILE.tmp"
    mv "$ALERT_STATE_FILE.tmp" "$ALERT_STATE_FILE"
    
    log_message "ALERT" "Alert sent: $subject"
}

# Function to check application health
check_app_health() {
    local retry_count=0
    local is_healthy=false
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        # Check if application responds
        response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time $RESPONSE_TIME_THRESHOLD "$URL" 2>/dev/null)
        curl_exit_code=$?
        
        if [ $curl_exit_code -eq 0 ]; then
            # Check response time
            if (( $(echo "$response_time < $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
                is_healthy=true
                log_message "SUCCESS" "Application is healthy (Response time: ${response_time}s)"
                break
            else
                log_message "WARNING" "Application slow response: ${response_time}s"
            fi
        else
            log_message "ERROR" "Application not responding (Attempt $((retry_count + 1))/$MAX_RETRIES)"
            sleep $RETRY_DELAY
        fi
        
        retry_count=$((retry_count + 1))
    done
    
    if [ "$is_healthy" = false ]; then
        log_message "ERROR" "Application health check failed after $MAX_RETRIES attempts"
        restart_application
    fi
}

# Function to restart application
restart_application() {
    log_message "WARNING" "Attempting to restart application..."
    
    # Try PM2 first
    if command -v pm2 &> /dev/null; then
        pm2 restart "$APP_NAME" 2>&1 | tee -a "$LOG_FILE"
        sleep 5
        
        if pm2 list | grep -q "$APP_NAME.*online"; then
            log_message "SUCCESS" "Application restarted successfully with PM2"
            send_alert "Application Restarted" "The $APP_NAME application was automatically restarted due to health check failure." "app_restart"
            return 0
        fi
    fi
    
    # Try systemd
    if systemctl is-enabled "$APP_NAME" &> /dev/null; then
        systemctl restart "$APP_NAME" 2>&1 | tee -a "$LOG_FILE"
        sleep 5
        
        if systemctl is-active --quiet "$APP_NAME"; then
            log_message "SUCCESS" "Application restarted successfully with systemd"
            send_alert "Application Restarted" "The $APP_NAME application was automatically restarted due to health check failure." "app_restart"
            return 0
        fi
    fi
    
    log_message "ERROR" "Failed to restart application"
    send_alert "Critical: Application Down" "Failed to restart $APP_NAME application. Manual intervention required!" "app_critical"
    return 1
}

# Function to check disk usage
check_disk_usage() {
    local disk_usage=$(df -h "$APP_DIR" | awk 'NR==2 {print int($5)}')
    
    if [ "$disk_usage" -gt "$DISK_THRESHOLD" ]; then
        log_message "WARNING" "High disk usage: ${disk_usage}%"
        send_alert "High Disk Usage" "Disk usage is at ${disk_usage}% on $APP_NAME server" "disk_usage"
        
        # Try to clean up old logs and backups
        find "$APP_DIR/logs" -name "*.log" -type f -mtime +30 -delete 2>/dev/null
        find "$APP_DIR/backups" -name "*.gz" -type f -mtime +60 -delete 2>/dev/null
        
        log_message "INFO" "Cleaned up old logs and backups"
    else
        log_message "INFO" "Disk usage normal: ${disk_usage}%"
    fi
}

# Function to check memory usage
check_memory_usage() {
    local memory_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    
    if [ "$memory_usage" -gt "$MEMORY_THRESHOLD" ]; then
        log_message "WARNING" "High memory usage: ${memory_usage}%"
        send_alert "High Memory Usage" "Memory usage is at ${memory_usage}% on $APP_NAME server" "memory_usage"
        
        # Log top memory consumers
        echo "Top memory consumers:" >> "$LOG_FILE"
        ps aux --sort=-%mem | head -5 >> "$LOG_FILE"
    else
        log_message "INFO" "Memory usage normal: ${memory_usage}%"
    fi
}

# Function to check CPU usage
check_cpu_usage() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}')
    
    if [ "$cpu_usage" -gt "$CPU_THRESHOLD" ]; then
        log_message "WARNING" "High CPU usage: ${cpu_usage}%"
        send_alert "High CPU Usage" "CPU usage is at ${cpu_usage}% on $APP_NAME server" "cpu_usage"
        
        # Log top CPU consumers
        echo "Top CPU consumers:" >> "$LOG_FILE"
        ps aux --sort=-%cpu | head -5 >> "$LOG_FILE"
    else
        log_message "INFO" "CPU usage normal: ${cpu_usage}%"
    fi
}

# Function to check database
check_database() {
    local db_path="$APP_DIR/database.sqlite"
    
    if [[ -f "$db_path" ]]; then
        local db_size=$(du -m "$db_path" | cut -f1)
        log_message "INFO" "Database size: ${db_size}MB"
        
        if [ "$db_size" -gt "$DB_SIZE_THRESHOLD" ]; then
            log_message "WARNING" "Database size exceeds threshold: ${db_size}MB > ${DB_SIZE_THRESHOLD}MB"
            send_alert "Large Database Size" "Database size is ${db_size}MB, exceeding threshold of ${DB_SIZE_THRESHOLD}MB" "db_size"
        fi
        
        # Check database integrity
        if command -v sqlite3 &> /dev/null; then
            integrity_check=$(sqlite3 "$db_path" "PRAGMA integrity_check;" 2>&1)
            if [[ "$integrity_check" != "ok" ]]; then
                log_message "ERROR" "Database integrity check failed: $integrity_check"
                send_alert "Database Integrity Issue" "Database integrity check failed for $APP_NAME" "db_integrity"
            else
                log_message "INFO" "Database integrity check passed"
            fi
        fi
    else
        log_message "ERROR" "Database file not found"
        send_alert "Database Missing" "Database file not found for $APP_NAME" "db_missing"
    fi
}

# Function to check if services are running
check_services() {
    # Check Nginx
    if systemctl is-active --quiet nginx; then
        log_message "INFO" "Nginx is running"
    else
        log_message "ERROR" "Nginx is not running"
        systemctl start nginx 2>&1 | tee -a "$LOG_FILE"
    fi
    
    # Check Node.js process
    if pgrep -f "node.*$APP_NAME" > /dev/null || pgrep -f "node.*server.js" > /dev/null; then
        log_message "INFO" "Node.js process is running"
    else
        log_message "ERROR" "Node.js process not found"
        restart_application
    fi
}

# Function to check network connectivity
check_network() {
    # Check if we can reach external services
    if ping -c 1 8.8.8.8 &> /dev/null; then
        log_message "INFO" "Network connectivity OK"
    else
        log_message "ERROR" "No network connectivity"
        send_alert "Network Issue" "Network connectivity issue detected on $APP_NAME server" "network"
    fi
}

# Function to collect metrics
collect_metrics() {
    local metrics_file="$APP_DIR/logs/metrics_$(date +%Y%m%d).json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Collect various metrics
    local app_status="down"
    if curl -s --max-time 2 "$URL" &> /dev/null; then
        app_status="up"
    fi
    
    # Create JSON metrics
    cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "app_status": "$app_status",
  "disk_usage": $(df -h "$APP_DIR" | awk 'NR==2 {print int($5)}'),
  "memory_usage": $(free | grep Mem | awk '{print int($3/$2 * 100)}'),
  "cpu_usage": $(top -bn1 | grep "Cpu(s)" | awk '{print int($2)}'),
  "db_size_mb": $(du -m "$APP_DIR/database.sqlite" 2>/dev/null | cut -f1 || echo 0),
  "process_count": $(pgrep -f "node" | wc -l),
  "uptime_seconds": $(cat /proc/uptime | cut -d' ' -f1)
}
EOF
}

# Main monitoring function
main() {
    log_message "INFO" "===== Starting monitoring check ====="
    
    # Run all checks
    check_app_health
    check_disk_usage
    check_memory_usage
    check_cpu_usage
    check_database
    check_services
    check_network
    collect_metrics
    
    log_message "INFO" "===== Monitoring check completed ====="
}

# Create log directory if it doesn't exist
mkdir -p "$APP_DIR/logs"

# Run main function
main

# Clean up old log entries (keep last 10000 lines)
if [ $(wc -l < "$LOG_FILE") -gt 10000 ]; then
    tail -n 10000 "$LOG_FILE" > "$LOG_FILE.tmp"
    mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

# Exit successfully
exit 0