#!/bin/bash

# Capital Choice Office Furniture Bidding Platform
# Complete Cleanup/Uninstall Script
# 
# This script completely removes the platform installation
# Works with both original and modular deployment versions

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration (must match deploy.sh)
APP_NAME="capital-choice-platform"
APP_DIR="/opt/$APP_NAME"
APP_USER="capital-choice"
BACKUP_DIR="/opt/backups"

# Tracking variables
ERRORS_OCCURRED=false
CLEANUP_LOG="/tmp/${APP_NAME}-cleanup-$(date +%Y%m%d_%H%M%S).log"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$CLEANUP_LOG"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$CLEANUP_LOG"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$CLEANUP_LOG"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$CLEANUP_LOG"
    ERRORS_OCCURRED=true
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to create safety backup
create_safety_backup() {
    print_status "Creating safety backup before cleanup..."
    
    SAFETY_BACKUP_DIR="/tmp/${APP_NAME}_safety_backup_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$SAFETY_BACKUP_DIR"
    
    # Backup database if exists
    if [[ -f "$APP_DIR/database.sqlite" ]]; then
        cp "$APP_DIR/database.sqlite" "$SAFETY_BACKUP_DIR/" 2>/dev/null || true
        print_status "Database backed up to $SAFETY_BACKUP_DIR"
    fi
    
    # Backup .env if exists
    if [[ -f "$APP_DIR/.env" ]]; then
        cp "$APP_DIR/.env" "$SAFETY_BACKUP_DIR/" 2>/dev/null || true
        print_status "Configuration backed up to $SAFETY_BACKUP_DIR"
    fi
    
    # Backup uploads if exists
    if [[ -d "$APP_DIR/uploads" ]]; then
        tar -czf "$SAFETY_BACKUP_DIR/uploads_backup.tar.gz" -C "$APP_DIR" uploads 2>/dev/null || true
        print_status "Uploads backed up to $SAFETY_BACKUP_DIR"
    fi
    
    print_success "Safety backup created at: $SAFETY_BACKUP_DIR"
    echo
    print_warning "IMPORTANT: This backup will remain in /tmp and may be deleted on reboot"
    print_warning "Move it to a permanent location if you need to keep it:"
    print_warning "  sudo mv $SAFETY_BACKUP_DIR /path/to/permanent/location"
    echo
}

# Function to get user confirmation
get_confirmation() {
    echo
    print_warning "=== CAPITAL CHOICE PLATFORM UNINSTALL ==="
    echo
    print_warning "This script will PERMANENTLY remove:"
    echo "  • Application service (systemd/PM2)"
    echo "  • Application user: $APP_USER"
    echo "  • Application directory: $APP_DIR"
    echo "  • Nginx configuration"
    echo "  • SSL certificates (if configured)"
    echo "  • Cron jobs"
    echo "  • Application backups in $APP_DIR/backups"
    echo
    print_warning "This action CANNOT be undone!"
    echo
    
    read -p "Do you want to create a safety backup first? (recommended) (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_safety_backup
    fi
    
    read -p "Are you SURE you want to completely remove the Capital Choice platform? (yes/NO): " -r
    if [[ ! $REPLY == "yes" ]]; then
        print_status "Uninstall cancelled"
        exit 0
    fi
    
    read -p "Type 'DELETE' to confirm permanent removal: " -r
    if [[ ! $REPLY == "DELETE" ]]; then
        print_status "Uninstall cancelled"
        exit 0
    fi
}

# Function to stop and remove PM2 processes
remove_pm2_processes() {
    print_status "Checking for PM2 processes..."
    
    if command -v pm2 &> /dev/null; then
        # Check if PM2 is managing our app
        if sudo -u $APP_USER pm2 list 2>/dev/null | grep -q "$APP_NAME"; then
            print_status "Stopping PM2 process..."
            sudo -u $APP_USER pm2 stop "$APP_NAME" 2>/dev/null || true
            sudo -u $APP_USER pm2 delete "$APP_NAME" 2>/dev/null || true
            sudo -u $APP_USER pm2 save --force 2>/dev/null || true
            print_success "PM2 process removed"
        else
            print_status "No PM2 process found for $APP_NAME"
        fi
        
        # Remove PM2 startup script for the user
        pm2 unstartup systemd -u $APP_USER --hp $APP_DIR 2>/dev/null || true
    else
        print_status "PM2 not installed, skipping"
    fi
}

# Function to stop and remove systemd service
remove_systemd_service() {
    print_status "Removing systemd service..."
    
    SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
    
    if [[ -f "$SERVICE_FILE" ]]; then
        # Stop the service
        systemctl stop "$APP_NAME" 2>/dev/null || true
        systemctl disable "$APP_NAME" 2>/dev/null || true
        
        # Remove service file
        rm -f "$SERVICE_FILE"
        
        # Reload systemd
        systemctl daemon-reload
        
        print_success "Systemd service removed"
    else
        print_status "No systemd service found"
    fi
}

# Function to remove Nginx configuration
remove_nginx_config() {
    print_status "Removing Nginx configuration..."
    
    NGINX_SITES_AVAILABLE="/etc/nginx/sites-available/$APP_NAME"
    NGINX_SITES_ENABLED="/etc/nginx/sites-enabled/$APP_NAME"
    NGINX_CONF_D="/etc/nginx/conf.d/${APP_NAME}.conf"
    
    # Remove configuration files
    if [[ -f "$NGINX_SITES_AVAILABLE" ]]; then
        rm -f "$NGINX_SITES_AVAILABLE"
        print_status "Removed sites-available configuration"
    fi
    
    if [[ -L "$NGINX_SITES_ENABLED" ]]; then
        rm -f "$NGINX_SITES_ENABLED"
        print_status "Removed sites-enabled symlink"
    fi
    
    if [[ -f "$NGINX_CONF_D" ]]; then
        rm -f "$NGINX_CONF_D"
        print_status "Removed conf.d configuration"
    fi
    
    # Restore default site if backup exists
    if [[ -f "/etc/nginx/sites-available/default.backup" ]]; then
        mv /etc/nginx/sites-available/default.backup /etc/nginx/sites-available/default
        ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
        print_status "Restored default Nginx configuration"
    fi
    
    # Test and reload Nginx if it's running
    if systemctl is-active --quiet nginx; then
        if nginx -t 2>/dev/null; then
            systemctl reload nginx
            print_success "Nginx configuration removed and reloaded"
        else
            print_error "Nginx configuration test failed - manual intervention may be required"
        fi
    fi
}

# Function to remove SSL certificates
remove_ssl_certificates() {
    print_status "Checking for SSL certificates..."
    
    # Get domain from Nginx config or certbot
    if command -v certbot &> /dev/null; then
        DOMAINS=$(certbot certificates 2>/dev/null | grep "Domains:" | grep -v "INVALID" | cut -d: -f2 | tr -d ' ')
        
        for domain in $DOMAINS; do
            read -p "Remove SSL certificate for $domain? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                certbot delete --cert-name "$domain" --non-interactive 2>/dev/null || true
                print_success "SSL certificate removed for $domain"
            else
                print_status "Keeping SSL certificate for $domain"
            fi
        done
    else
        print_status "Certbot not installed, skipping SSL cleanup"
    fi
}

# Function to remove cron jobs
remove_cron_jobs() {
    print_status "Removing cron jobs..."
    
    # Remove backup cron job
    if crontab -u $APP_USER -l 2>/dev/null | grep -q "$APP_DIR/backup.sh"; then
        (crontab -u $APP_USER -l 2>/dev/null | grep -v "$APP_DIR/backup.sh") | crontab -u $APP_USER - 2>/dev/null || true
        print_status "Removed backup cron job"
    fi
    
    # Remove monitoring cron job
    if crontab -u $APP_USER -l 2>/dev/null | grep -q "$APP_DIR/monitor.sh"; then
        (crontab -u $APP_USER -l 2>/dev/null | grep -v "$APP_DIR/monitor.sh") | crontab -u $APP_USER - 2>/dev/null || true
        print_status "Removed monitoring cron job"
    fi
    
    # Remove certbot renewal cron job (root)
    if crontab -l 2>/dev/null | grep -q "certbot renew"; then
        read -p "Remove certbot auto-renewal cron job? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            (crontab -l 2>/dev/null | grep -v "certbot renew") | crontab - 2>/dev/null || true
            print_status "Removed certbot renewal cron job"
        fi
    fi
    
    print_success "Cron jobs cleaned up"
}

# Function to remove application directory
remove_app_directory() {
    print_status "Removing application directory..."
    
    if [[ -d "$APP_DIR" ]]; then
        # Show directory size
        DIR_SIZE=$(du -sh "$APP_DIR" 2>/dev/null | cut -f1)
        print_status "Directory size: $DIR_SIZE"
        
        rm -rf "$APP_DIR"
        print_success "Application directory removed"
    else
        print_status "Application directory not found"
    fi
}

# Function to remove application user
remove_app_user() {
    print_status "Removing application user..."
    
    if id "$APP_USER" &>/dev/null; then
        # Kill any remaining processes owned by the user
        pkill -u "$APP_USER" 2>/dev/null || true
        
        # Wait a moment for processes to terminate
        sleep 2
        
        # Remove the user
        userdel -r "$APP_USER" 2>/dev/null || userdel "$APP_USER" 2>/dev/null || true
        
        print_success "Application user removed"
    else
        print_status "Application user not found"
    fi
}

# Function to remove firewall rules
remove_firewall_rules() {
    print_status "Checking firewall rules..."
    
    if command -v ufw &> /dev/null; then
        # UFW doesn't need specific cleanup for HTTP/HTTPS as they're standard services
        print_status "UFW rules for Nginx will remain (used by other sites)"
    elif command -v firewall-cmd &> /dev/null; then
        # Firewalld also uses standard services
        print_status "Firewalld rules for HTTP/HTTPS will remain (used by other sites)"
    else
        print_status "No firewall configuration found"
    fi
}

# Function to clean up system optimizations
cleanup_system_optimizations() {
    print_status "Cleaning up system optimizations..."
    
    # Remove file descriptor limits for the app user
    if grep -q "$APP_USER" /etc/security/limits.conf 2>/dev/null; then
        sed -i "/$APP_USER/d" /etc/security/limits.conf
        print_status "Removed file descriptor limits"
    fi
    
    print_success "System optimizations cleaned up"
}

# Function to remove old backups
remove_old_backups() {
    print_status "Checking for old backups..."
    
    # Check default backup location
    if [[ -d "$BACKUP_DIR" ]]; then
        BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
        read -p "Found backups in $BACKUP_DIR (Size: $BACKUP_SIZE). Remove? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$BACKUP_DIR"
            print_success "Old backups removed"
        else
            print_status "Keeping old backups"
        fi
    fi
    
    # Check for backups in app directory (already handled by remove_app_directory)
    # Just for logging
    if [[ -d "$APP_DIR/backups" ]]; then
        print_status "App backups will be removed with application directory"
    fi
}

# Function to clean npm/node artifacts
cleanup_node_artifacts() {
    print_status "Cleaning Node.js artifacts..."
    
    # Remove PM2 logs
    if [[ -d "/home/$APP_USER/.pm2/logs" ]]; then
        rm -rf "/home/$APP_USER/.pm2/logs" 2>/dev/null || true
        print_status "PM2 logs removed"
    fi
    
    # Remove npm cache for app user
    if [[ -d "/home/$APP_USER/.npm" ]]; then
        rm -rf "/home/$APP_USER/.npm" 2>/dev/null || true
        print_status "NPM cache removed"
    fi
    
    print_success "Node.js artifacts cleaned"
}

# Function to show cleanup summary
show_cleanup_summary() {
    echo
    if [[ "$ERRORS_OCCURRED" == true ]]; then
        print_warning "=== CLEANUP COMPLETED WITH WARNINGS ==="
        print_warning "Some errors occurred during cleanup. Check the log: $CLEANUP_LOG"
    else
        print_success "=== CLEANUP COMPLETED SUCCESSFULLY ==="
    fi
    
    echo
    print_status "The following items were removed:"
    echo "  ✓ Application service (systemd/PM2)"
    echo "  ✓ Application directory: $APP_DIR"
    echo "  ✓ Application user: $APP_USER"
    echo "  ✓ Nginx configuration"
    echo "  ✓ Cron jobs"
    echo "  ✓ System optimizations"
    echo
    
    print_status "The following items were preserved:"
    echo "  • Node.js installation"
    echo "  • Nginx installation"
    echo "  • System packages"
    echo "  • Other websites/applications"
    
    if [[ -d "/tmp/${APP_NAME}_safety_backup"* ]]; then
        echo
        print_warning "Safety backups are available in /tmp/"
        print_warning "These will be deleted on next reboot unless moved"
    fi
    
    echo
    print_status "Cleanup log saved to: $CLEANUP_LOG"
    echo
    print_success "Capital Choice platform has been completely removed!"
}

# Function to handle partial cleanup on error
cleanup_on_error() {
    print_error "An error occurred during cleanup"
    print_warning "Partial cleanup may have occurred"
    print_warning "Check the log for details: $CLEANUP_LOG"
    exit 1
}

# Main cleanup function
main() {
    echo
    print_status "Capital Choice Office Furniture Bidding Platform"
    print_status "Complete Uninstall Script"
    print_status "Cleanup log: $CLEANUP_LOG"
    echo
    
    # Check prerequisites
    check_root
    
    # Get user confirmation
    get_confirmation
    
    print_status "Starting cleanup process..."
    echo
    
    # Set trap for errors
    trap cleanup_on_error ERR
    
    # Stop services first
    remove_pm2_processes
    remove_systemd_service
    
    # Remove configurations
    remove_nginx_config
    remove_ssl_certificates
    remove_cron_jobs
    
    # Remove firewall rules
    remove_firewall_rules
    
    # Clean up system optimizations
    cleanup_system_optimizations
    
    # Remove old backups (ask user)
    remove_old_backups
    
    # Remove application files
    remove_app_directory
    
    # Clean Node artifacts
    cleanup_node_artifacts
    
    # Remove user last (after files are removed)
    remove_app_user
    
    # Show summary
    show_cleanup_summary
}

# Parse command line arguments
FORCE_MODE=false
SKIP_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_MODE=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  --force        Skip confirmation prompts (dangerous!)"
            echo "  --skip-backup  Skip creating safety backup"
            echo "  --help         Show this help message"
            echo
            echo "Example:"
            echo "  sudo ./cleanup.sh"
            echo "  sudo ./cleanup.sh --skip-backup"
            echo
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main

# Exit successfully
exit 0