#!/bin/bash

# Capital Choice Office Furniture Bidding Platform
# Automated Deployment Script - Updated for Public Folder Structure with Socket.IO Fix
# 
# This script automatically installs and configures the complete platform
# with frontend files in the public directory and proper Socket.IO configuration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="capital-choice-platform"
APP_DIR="/opt/$APP_NAME"
APP_USER="capital-choice"
DOMAIN=""
EMAIL=""
SSL_ENABLED=false
GITHUB_REPO=""  # Optional: GitHub repository URL for cloning

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        print_error "Cannot detect operating system"
        exit 1
    fi
    
    print_status "Detected OS: $OS $VER"
}

# Function to get user input
get_user_input() {
    echo
    print_status "=== Capital Choice Platform Setup ==="
    echo
    
    read -p "Enter your domain name (optional, leave blank for IP access): " DOMAIN
    
    if [[ -n "$DOMAIN" ]]; then
        read -p "Enter your email for SSL certificate: " EMAIL
        if [[ -n "$EMAIL" ]]; then
            SSL_ENABLED=true
        fi
    fi
    
    read -p "Enter GitHub repository URL (optional, for git deployment): " GITHUB_REPO
    
    echo
    print_status "Configuration:"
    print_status "- Domain: ${DOMAIN:-'IP Address Access'}"
    print_status "- SSL: ${SSL_ENABLED}"
    print_status "- Git Repo: ${GITHUB_REPO:-'Local files'}"
    echo
    
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Installation cancelled"
        exit 0
    fi
}

# Function to install Git if needed
install_git() {
    if [[ -n "$GITHUB_REPO" ]]; then
        print_status "Installing Git..."
        
        if command -v apt-get &> /dev/null; then
            apt-get install -y git
        elif command -v yum &> /dev/null; then
            yum install -y git
        fi
        
        print_success "Git installed"
    fi
}

# Function to update system
update_system() {
    print_status "Updating system packages..."
    
    if command -v apt-get &> /dev/null; then
        apt-get update -y
        apt-get upgrade -y
        apt-get install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release
    elif command -v yum &> /dev/null; then
        yum update -y
        yum install -y curl wget gnupg2 epel-release
    else
        print_error "Unsupported package manager"
        exit 1
    fi
    
    print_success "System updated"
}

# Function to install Node.js
install_nodejs() {
    print_status "Installing Node.js 18.x LTS..."
    
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    fi
    
    # Install build tools for native modules
    if command -v apt-get &> /dev/null; then
        apt-get install -y build-essential
    elif command -v yum &> /dev/null; then
        yum groupinstall -y 'Development Tools'
    fi
    
    # Verify installation
    node_version=$(node --version)
    npm_version=$(npm --version)
    
    print_success "Node.js installed: $node_version"
    print_success "NPM installed: $npm_version"
}

# Function to install PM2 for process management
install_pm2() {
    print_status "Installing PM2 process manager..."
    
    npm install -g pm2
    pm2 startup systemd -u $APP_USER --hp $APP_DIR
    
    print_success "PM2 installed"
}

# Function to install Nginx
install_nginx() {
    print_status "Installing Nginx..."
    
    if command -v apt-get &> /dev/null; then
        apt-get install -y nginx
    elif command -v yum &> /dev/null; then
        yum install -y nginx
    fi
    
    systemctl enable nginx
    systemctl start nginx
    
    print_success "Nginx installed and started"
}

# Function to create application user
create_app_user() {
    print_status "Creating application user..."
    
    if ! id "$APP_USER" &>/dev/null; then
        useradd --system --shell /bin/bash --home-dir $APP_DIR $APP_USER
        print_success "User $APP_USER created"
    else
        print_warning "User $APP_USER already exists"
    fi
}

# Function to create application directory structure
setup_app_directory() {
    print_status "Setting up application directory structure..."
    
    # Create main directories
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/logs
    mkdir -p $APP_DIR/uploads/projects
    mkdir -p $APP_DIR/uploads/bids
    mkdir -p $APP_DIR/backups
    mkdir -p $APP_DIR/scripts
    
    # Create backend directories
    mkdir -p $APP_DIR/config
    mkdir -p $APP_DIR/middleware
    mkdir -p $APP_DIR/routes
    mkdir -p $APP_DIR/models
    mkdir -p $APP_DIR/services
    mkdir -p $APP_DIR/sockets
    mkdir -p $APP_DIR/utils
    
    # Create frontend public directory structure
    mkdir -p $APP_DIR/public
    mkdir -p $APP_DIR/public/css
    mkdir -p $APP_DIR/public/js
    mkdir -p $APP_DIR/public/js/components
    mkdir -p $APP_DIR/public/js/modals
    mkdir -p $APP_DIR/public/js/templates
    mkdir -p $APP_DIR/public/js/utils
    mkdir -p $APP_DIR/public/images
    
    chown -R $APP_USER:$APP_USER $APP_DIR
    chmod 755 $APP_DIR
    
    print_success "Application directory structure created"
}

# Function to install application files from Git
install_from_git() {
    print_status "Cloning application from Git repository..."
    
    cd /tmp
    rm -rf capital-choice-temp
    git clone $GITHUB_REPO capital-choice-temp
    
    # Copy all files to application directory
    cp -r /tmp/capital-choice-temp/* $APP_DIR/
    cp -r /tmp/capital-choice-temp/.[^.]* $APP_DIR/ 2>/dev/null || true
    
    # Clean up
    rm -rf /tmp/capital-choice-temp
    
    print_success "Application cloned from Git"
}

# Function to install application files from local
install_app_files() {
    print_status "Installing application files..."
    
    if [[ -n "$GITHUB_REPO" ]]; then
        install_from_git
    else
        # Backend files - Main
        [[ -f "server.js" ]] && cp server.js $APP_DIR/ || print_warning "server.js not found"
        [[ -f "package.json" ]] && cp package.json $APP_DIR/ || print_warning "package.json not found"
        [[ -f "emailTemplates.js" ]] && cp emailTemplates.js $APP_DIR/ || print_warning "emailTemplates.js not found"
        
        # Backend directories
        for dir in config middleware routes models services sockets utils; do
            if [[ -d "$dir" ]]; then
                cp -r $dir/* $APP_DIR/$dir/ 2>/dev/null && print_status "Copied $dir files"
            fi
        done

        # IMPORTANT: Copy nginx configuration
        if [[ -f "nginx-config.conf" ]]; then
            cp nginx-config.conf $APP_DIR/
            print_status "Copied nginx-config.conf"
        elif [[ -f "../nginx-config.conf" ]]; then
            cp ../nginx-config.conf $APP_DIR/
            print_status "Copied nginx-config.conf from parent directory"
        fi
        
        # Frontend files - Check both possible locations
        # Priority 1: public/index.html (new structure)
        if [[ -f "public/index.html" ]]; then
            print_status "Found frontend files in public/ directory"
            cp -r public/* $APP_DIR/public/
            print_success "Frontend files copied from public/"
        # Priority 2: Direct files (for backward compatibility)
        elif [[ -f "index.html" ]]; then
            print_status "Found frontend files in root directory (legacy structure)"
            cp index.html $APP_DIR/public/
            
            # Copy CSS files
            if [[ -d "css" ]]; then
                cp -r css/* $APP_DIR/public/css/
            fi
            
            # Copy JavaScript files
            if [[ -d "js" ]]; then
                cp -r js/* $APP_DIR/public/js/
            fi
            
            # Copy images if they exist
            if [[ -d "images" ]]; then
                cp -r images/* $APP_DIR/public/images/
            fi
            
            print_success "Frontend files copied from root (legacy)"
        else
            print_warning "No frontend files found - you may need to add them manually"
        fi
        
        # Copy deployment scripts
        if [[ -d "scripts" ]]; then
            cp -r scripts/* $APP_DIR/scripts/
        else
            # Copy individual script files if they exist in root
            [[ -f "deploy.sh" ]] && cp deploy.sh $APP_DIR/scripts/
            [[ -f "cleanup.sh" ]] && cp cleanup.sh $APP_DIR/scripts/
            [[ -f "backup.sh" ]] && cp backup.sh $APP_DIR/scripts/
            [[ -f "monitor.sh" ]] && cp monitor.sh $APP_DIR/scripts/
        fi
        
        # Copy documentation if exists
        if [[ -d "docs" ]]; then
            cp -r docs $APP_DIR/
        fi
        
        # Copy README and LICENSE if they exist
        [[ -f "README.md" ]] && cp README.md $APP_DIR/
        [[ -f "LICENSE" ]] && cp LICENSE $APP_DIR/
        
        print_success "Application files installed"
    fi
    
    # Create or copy environment file
    if [[ -f ".env" ]]; then
        cp .env $APP_DIR/.env
        print_status "Copied existing .env file"
    elif [[ -f ".env.example" ]]; then
        cp .env.example $APP_DIR/.env
        print_status "Created .env from .env.example"
    else
        create_env_file
    fi
    
    # Set ownership
    chown -R $APP_USER:$APP_USER $APP_DIR
    chmod 644 $APP_DIR/.env
}

# Function to create environment file
create_env_file() {
    print_status "Creating environment file..."
    
    cat > $APP_DIR/.env << EOF
# Environment
NODE_ENV=production

# Server Configuration
PORT=3000

# Database Configuration
DATABASE_PATH=./database.sqlite

# Security Configuration
JWT_SECRET=$(openssl rand -base64 32)
BCRYPT_ROUNDS=10

# File Upload Configuration
UPLOAD_DIR=uploads/
MAX_FILE_SIZE=10485760

# Email Configuration (Configure these with your SMTP settings)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS Configuration
CORS_ORIGIN=*

# Default Admin Configuration
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# Public Directory
PUBLIC_DIR=public
EOF
    
    print_success "Environment file created"
}

# Function to update package.json for production
update_package_json() {
    print_status "Updating package.json for production..."
    
    # Check if package.json exists
    if [[ -f "$APP_DIR/package.json" ]]; then
        # Add production scripts if not present
        cd $APP_DIR
        npm pkg set scripts.start="node server.js"
        npm pkg set scripts.production="NODE_ENV=production node server.js"
        
        print_success "package.json updated"
    else
        print_warning "package.json not found, creating minimal version"
        create_package_json
    fi
}

# Function to create minimal package.json
create_package_json() {
    cat > $APP_DIR/package.json << 'EOF'
{
  "name": "capital-choice-platform",
  "version": "1.0.0",
  "description": "Capital Choice Office Furniture Bidding Platform",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "production": "NODE_ENV=production node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "multer": "^1.4.5-lts.1",
    "socket.io": "^4.6.1",
    "nodemailer": "^6.9.7",
    "dotenv": "^16.3.1",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
EOF
}

# Function to install NPM dependencies
install_dependencies() {
    print_status "Installing NPM dependencies..."
    
    cd $APP_DIR
    
    # Clean install for production (using new syntax)
    sudo -u $APP_USER npm ci --omit=dev 2>/dev/null || sudo -u $APP_USER npm install --omit=dev
    
    # Ensure Socket.IO is installed
    sudo -u $APP_USER npm install socket.io@^4.7.4 --save
    
    # Run security audit and attempt fixes
    print_status "Running security audit..."
    sudo -u $APP_USER npm audit fix --omit=dev || true
    
    print_success "Dependencies installed"
}

# Function to configure PM2
configure_pm2() {
    print_status "Configuring PM2 process manager..."
    
    # Create PM2 ecosystem file
    cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: './server.js',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,
    cron_restart: '0 2 * * *'
  }]
};
EOF
    
    chown $APP_USER:$APP_USER $APP_DIR/ecosystem.config.js
    
    # Start application with PM2
    cd $APP_DIR
    sudo -u $APP_USER pm2 start ecosystem.config.js
    sudo -u $APP_USER pm2 save
    
    print_success "PM2 configured and application started"
}

# Function to create systemd service (alternative to PM2)
create_systemd_service() {
    print_status "Creating systemd service..."
    
    cat > /etc/systemd/system/$APP_NAME.service << EOF
[Unit]
Description=Capital Choice Office Furniture Bidding Platform
Documentation=https://github.com/capital-choice/bidding-platform
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
KillMode=process

# Output to journald
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $APP_NAME
    
    print_success "Systemd service created"
}

# Function to configure Nginx with proper Socket.IO handling
configure_nginx() {
    print_status "Configuring Nginx..."
    
    # Backup default config
    if [[ -f /etc/nginx/sites-available/default ]]; then
        cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
    fi
    
    # Create cache directory
    mkdir -p /var/cache/nginx
    chown www-data:www-data /var/cache/nginx
    
    # Look for nginx-config.conf in multiple possible locations
    NGINX_CONF=""
    
    # Check various possible locations for the config file
    if [[ -f "$APP_DIR/nginx-config.conf" ]]; then
        NGINX_CONF="$APP_DIR/nginx-config.conf"
        print_status "Found nginx config at $APP_DIR/nginx-config.conf"
    elif [[ -f "../nginx-config.conf" ]]; then
        NGINX_CONF="../nginx-config.conf"
        print_status "Found nginx config at ../nginx-config.conf"
    elif [[ -f "./nginx-config.conf" ]]; then
        NGINX_CONF="./nginx-config.conf"
        print_status "Found nginx config at ./nginx-config.conf"
    elif [[ -f "nginx-config.conf" ]]; then
        NGINX_CONF="nginx-config.conf"
        print_status "Found nginx config at nginx-config.conf"
    fi
    
    if [[ -n "$NGINX_CONF" ]]; then
        # Copy the nginx configuration
        cp "$NGINX_CONF" /etc/nginx/sites-available/$APP_NAME
        
        # Replace placeholders
        sed -i "s|your-domain.com|${DOMAIN:-'_'}|g" /etc/nginx/sites-available/$APP_NAME
        sed -i "s|/opt/capital-choice-platform|$APP_DIR|g" /etc/nginx/sites-available/$APP_NAME
        
        print_success "Using complete nginx configuration from file"
    else
        print_warning "nginx-config.conf not found, creating configuration..."
        
        # Fall back to creating the configuration
        cat > /etc/nginx/sites-available/$APP_NAME << EOF
# /etc/nginx/sites-available/capital-choice-platform
# Improved and hardened nginx configuration

# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=app_cache:10m max_size=100m inactive=60m use_temp_path=off;

# Upstream configuration for load balancing
upstream app_backend {
    least_conn;
    server localhost:3000;
    keepalive 64;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=static:10m rate=50r/s;

# Enhanced log format for better debugging
log_format detailed '$remote_addr - $remote_user [$time_local] '
                   '"$request" $status $body_bytes_sent '
                   '"$http_referer" "$http_user_agent" '
                   '$request_time $upstream_response_time';

# Redirect HTTP to HTTPS (uncomment when SSL is configured)
# server {
#     listen 80;
#     server_name your-domain.com;
#     return 301 https://$server_name$request_uri;
# }

server {
    listen 80;
    server_name _;  # Replace with your domain
    
    # SSL configuration (uncomment when SSL is configured)
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    # ssl_prefer_server_ciphers on;
    # ssl_session_cache shared:SSL:10m;
    # ssl_session_timeout 10m;
    # ssl_stapling on;
    # ssl_stapling_verify on;
    # ssl_dhparam /etc/nginx/dhparam.pem;
    
    # Enhanced Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Permitted-Cross-Domain-Policies "none" always;
    add_header X-Download-Options "noopen" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # Improved Content Security Policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.socket.io https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml text/x-js text/x-cross-domain-policy application/x-font-ttf application/x-font-opentype application/vnd.ms-fontobject image/x-icon;
    gzip_disable "msie6";
    
    # Client body size for file uploads
    client_max_body_size 10M;
    client_body_buffer_size 128k;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    send_timeout 60s;
    
    # Root directory for static files
    root /opt/capital-choice-platform/public;
    index index.html;
    
    # Enhanced logging
    access_log /var/log/nginx/capital-choice-access.log detailed;
    error_log /var/log/nginx/capital-choice-error.log warn;
    
    # IMPORTANT: Socket.IO MUST come FIRST before any regex patterns
    # Socket.IO WebSocket and polling transport
    location /socket.io/ {
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_buffering off;
        proxy_cache off;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Socket.IO specific
        proxy_set_header X-NginX-Proxy true;
        proxy_redirect off;
    }
    
    # API routes with rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=3 nodelay;
        limit_req_status 429;
        
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        
        # No caching for auth endpoints
        proxy_cache off;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_req_status 429;
        
        proxy_pass http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_cache_bypass $http_upgrade;
        
        # Cache GET requests for a short time
        proxy_cache app_cache;
        proxy_cache_methods GET HEAD;
        proxy_cache_valid 200 5m;
        proxy_cache_valid 404 1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        add_header X-Cache-Status $upstream_cache_status;
    }
    
    # Enhanced file upload security
    location /uploads/ {
        # First, handle allowed file types with strict validation
        location ~ /uploads/[^/]+\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip)$ {
            client_max_body_size 5M;  # Specific limit for uploads
            add_header X-Content-Type-Options "nosniff" always;
            add_header X-Frame-Options "DENY" always;
            expires 1d;
            access_log /var/log/nginx/uploads.log;
            
            # Prevent execution of any uploaded files
            location ~ \.(php|php3|php4|php5|phtml|pl|py|jsp|asp|sh|cgi|exe|dll)$ {
                deny all;
                return 403;
            }
        }
        
        # Deny everything else in uploads
        deny all;
        return 403;
    }
    
    # Static assets with enhanced caching and rate limiting
    location ~* \.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|map)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        limit_req zone=static burst=50 nodelay;
        access_log off;
        
        # Security headers for static assets
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # CSS files with moderate caching
    location ~* \.css$ {
        expires 7d;
        add_header Cache-Control "public, must-revalidate";
        add_header Vary "Accept-Encoding";
        limit_req zone=static burst=30 nodelay;
        access_log off;
    }
    
    # JavaScript files with moderate caching
    location ~* \.js$ {
        expires 7d;
        add_header Cache-Control "public, must-revalidate";
        add_header Vary "Accept-Encoding";
        limit_req zone=static burst=30 nodelay;
        access_log off;
    }
    
    # Main application - serve static files and fall back to index.html
    location / {
        limit_req zone=general burst=10 nodelay;
        limit_req_status 429;
        
        try_files $uri $uri/ /index.html;
        
        # HTML files should not be cached aggressively
        location ~* \.html$ {
            expires 1h;
            add_header Cache-Control "public, must-revalidate";
            add_header Vary "Accept-Encoding";
        }
    }
    
    # Favicon and robots.txt
    location = /favicon.ico {
        log_not_found off;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    location = /robots.txt {
        log_not_found off;
        access_log off;
        expires 7d;
        add_header Cache-Control "public, must-revalidate";
    }
    
    # Security: Deny access to hidden files (except .well-known for Let's Encrypt)
    location ~ /\.(?!well-known) {
        deny all;
        access_log off;
        log_not_found off;
        return 404;
    }
    
    # Security: Deny access to sensitive files
    location ~* \.(log|conf|sql|bak|backup|swp|save|old|tmp|temp)$ {
        deny all;
        return 404;
    }
    
    # Block common attack patterns and malicious requests
    location ~* (eval\(|base64_|shell_|exec\(|php_|\.\.\/|\.\.\\|index\.php|union.*select|insert.*into|drop.*table) {
        deny all;
        return 403;
    }
    
    # Block requests with suspicious user agents
    if ($http_user_agent ~* (bot|spider|crawler|scanner|grabber|scraper)) {
        return 403;
    }
    
    # Block requests with no user agent
    if ($http_user_agent = "") {
        return 403;
    }
    
    # Enhanced error pages
    error_page 404 /404.html;
    error_page 429 /429.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /404.html {
        root /opt/capital-choice-platform/public;
        internal;
        add_header Cache-Control "no-cache" always;
    }
    
    location = /429.html {
        root /opt/capital-choice-platform/public;
        internal;
        add_header Cache-Control "no-cache" always;
        add_header Retry-After "60" always;
    }
    
    location = /50x.html {
        root /opt/capital-choice-platform/public;
        internal;
        add_header Cache-Control "no-cache" always;
    }
}
EOF
    fi
    
    # Enable site
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    if nginx -t; then
        systemctl reload nginx
        print_success "Nginx configured with security rules"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
}

# Function to setup SSL with Let's Encrypt
setup_ssl() {
    if [[ "$SSL_ENABLED" == true && -n "$DOMAIN" && -n "$EMAIL" ]]; then
        print_status "Setting up SSL certificate..."
        
        # Install Certbot
        if command -v apt-get &> /dev/null; then
            apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            yum install -y certbot python3-certbot-nginx
        fi
        
        # Get certificate
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect
        
        # Setup auto-renewal
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        print_success "SSL certificate installed"
    else
        print_warning "Skipping SSL setup"
    fi
}

# Function to configure firewall
setup_firewall() {
    print_status "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw --force enable
        ufw allow ssh
        ufw allow 'Nginx Full'
        print_success "UFW firewall configured"
    elif command -v firewall-cmd &> /dev/null; then
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
        print_success "Firewalld configured"
    else
        print_warning "No firewall found - please configure manually"
    fi
}

# Function to create backup script
create_backup_script() {
    print_status "Creating backup script..."
    
    # Copy backup script if provided, otherwise create default
    if [[ -f "scripts/backup.sh" ]]; then
        cp scripts/backup.sh $APP_DIR/scripts/backup.sh
    else
        cat > $APP_DIR/scripts/backup.sh << 'BACKUP_EOF'
#!/bin/bash

# Capital Choice Platform Backup Script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/capital-choice-platform/backups"
APP_DIR="/opt/capital-choice-platform"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
if [[ -f "$APP_DIR/database.sqlite" ]]; then
    cp $APP_DIR/database.sqlite $BACKUP_DIR/database_$DATE.sqlite
    gzip $BACKUP_DIR/database_$DATE.sqlite
    echo "Database backed up"
fi

# Backup uploads
if [[ -d "$APP_DIR/uploads" ]]; then
    tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $APP_DIR uploads/
    echo "Uploads backed up"
fi

# Backup public files
if [[ -d "$APP_DIR/public" ]]; then
    tar -czf $BACKUP_DIR/public_$DATE.tar.gz -C $APP_DIR public/
    echo "Public files backed up"
fi

# Backup configuration
if [[ -f "$APP_DIR/.env" ]]; then
    cp $APP_DIR/.env $BACKUP_DIR/env_$DATE.backup
    echo "Configuration backed up"
fi

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sqlite.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.backup" -mtime +30 -delete

echo "Backup completed: $DATE"
BACKUP_EOF
    fi
    
    chmod +x $APP_DIR/scripts/backup.sh
    chown $APP_USER:$APP_USER $APP_DIR/scripts/backup.sh
    
    # Setup daily backup cron job
    (crontab -u $APP_USER -l 2>/dev/null; echo "0 2 * * * $APP_DIR/scripts/backup.sh >> $APP_DIR/logs/backup.log 2>&1") | crontab -u $APP_USER -
    
    print_success "Backup script created"
}

# Function to create monitoring script
create_monitoring_script() {
    print_status "Creating monitoring script..."
    
    # Copy monitor script if provided, otherwise create default
    if [[ -f "scripts/monitor.sh" ]]; then
        cp scripts/monitor.sh $APP_DIR/scripts/monitor.sh
    else
        cat > $APP_DIR/scripts/monitor.sh << 'MONITOR_EOF'
#!/bin/bash

# Capital Choice Platform Monitoring Script
APP_NAME="capital-choice-platform"
URL="http://localhost:3000/api/health"
LOG_FILE="/opt/capital-choice-platform/logs/monitor.log"

# Check if application is responding
if ! curl -f -s $URL > /dev/null; then
    echo "Application not responding at $(date)" >> $LOG_FILE
    
    # Try to restart using PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 restart $APP_NAME
    else
        systemctl restart $APP_NAME
    fi
    
    echo "Application restarted at $(date)" >> $LOG_FILE
fi

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "High disk usage: ${DISK_USAGE}% at $(date)" >> $LOG_FILE
fi

# Check database size
DB_SIZE=$(du -h /opt/capital-choice-platform/database.sqlite 2>/dev/null | cut -f1)
if [[ -n "$DB_SIZE" ]]; then
    echo "Database size: $DB_SIZE at $(date)" >> $LOG_FILE
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $MEM_USAGE -gt 80 ]; then
    echo "High memory usage: ${MEM_USAGE}% at $(date)" >> $LOG_FILE
fi
MONITOR_EOF
    fi
    
    chmod +x $APP_DIR/scripts/monitor.sh
    chown $APP_USER:$APP_USER $APP_DIR/scripts/monitor.sh
    
    # Setup monitoring cron job (every 5 minutes)
    (crontab -u $APP_USER -l 2>/dev/null; echo "*/5 * * * * $APP_DIR/scripts/monitor.sh") | crontab -u $APP_USER -
    
    print_success "Monitoring script created"
}

# Function to optimize system for Node.js
optimize_system() {
    print_status "Optimizing system for Node.js..."
    
    # Increase file descriptor limits
    cat >> /etc/security/limits.conf << EOF
$APP_USER soft nofile 65536
$APP_USER hard nofile 65536
$APP_USER soft nproc 32768
$APP_USER hard nproc 32768
EOF
    
    # Optimize sysctl for web server
    cat >> /etc/sysctl.conf << 'EOF'
# Network optimizations for Node.js
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.ip_local_port_range = 1024 65535
EOF
    
    sysctl -p
    
    print_success "System optimized"
}

# Function to verify installation
verify_installation() {
    print_status "Verifying installation..."
    
    VERIFY_PASSED=true
    
    # Check if public directory exists and has files
    if [[ -d "$APP_DIR/public" ]] && [[ -f "$APP_DIR/public/index.html" ]]; then
        print_success "Frontend files verified"
    else
        print_error "Frontend files missing in $APP_DIR/public"
        VERIFY_PASSED=false
    fi
    
    # Check if backend files exist
    if [[ -f "$APP_DIR/server.js" ]]; then
        print_success "Backend files verified"
    else
        print_error "Backend files missing"
        VERIFY_PASSED=false
    fi
    
    # Check if node_modules exists
    if [[ -d "$APP_DIR/node_modules" ]]; then
        print_success "Dependencies installed"
    else
        print_error "Dependencies not installed"
        VERIFY_PASSED=false
    fi
    
    # Check if Socket.IO is installed
    if [[ -f "$APP_DIR/node_modules/socket.io/client-dist/socket.io.js" ]]; then
        print_success "Socket.IO client library found"
    else
        print_warning "Socket.IO client library not found - installing..."
        cd $APP_DIR && sudo -u $APP_USER npm install socket.io@4.6.1
    fi
    
    # Check if service is running
    if command -v pm2 &> /dev/null && pm2 list | grep -q $APP_NAME; then
        print_success "Application service running (PM2)"
    elif systemctl is-active --quiet $APP_NAME; then
        print_success "Application service running (systemd)"
    else
        print_error "Application service not running"
        VERIFY_PASSED=false
    fi
    
    # Check if Nginx is configured
    if nginx -t 2>/dev/null; then
        print_success "Nginx configuration valid"
    else
        print_error "Nginx configuration invalid"
        VERIFY_PASSED=false
    fi
    
    # Check API endpoint
    if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "API endpoint responding"
    else
        print_warning "API endpoint not responding (may still be starting)"
    fi
    
    # Check Socket.IO endpoint
    if curl -f -s http://localhost:3000/socket.io/socket.io.js > /dev/null 2>&1; then
        print_success "Socket.IO serving client library"
    else
        print_warning "Socket.IO client library not accessible"
    fi
    
    # Check frontend
    if curl -f -s http://localhost/ > /dev/null 2>&1; then
        print_success "Frontend accessible"
    else
        print_warning "Frontend not accessible via Nginx"
    fi
    
    if [[ "$VERIFY_PASSED" == false ]]; then
        print_warning "Some verification checks failed - manual intervention may be required"
    else
        print_success "All verification checks passed!"
    fi
}

# Function to start services
start_services() {
    print_status "Starting services..."
    
    # Reload Nginx
    systemctl reload nginx
    
    # Check if using PM2 or systemd
    if command -v pm2 &> /dev/null; then
        # PM2 is already started in configure_pm2
        print_success "Application managed by PM2"
    else
        # Start systemd service
        systemctl start $APP_NAME
        
        if systemctl is-active --quiet $APP_NAME; then
            print_success "Application started successfully"
        else
            print_error "Failed to start application"
            journalctl -u $APP_NAME --no-pager -n 20
            exit 1
        fi
    fi
    
    if systemctl is-active --quiet nginx; then
        print_success "Nginx started successfully"
    else
        print_error "Failed to start Nginx"
        exit 1
    fi
}

# Function to display completion message
show_completion() {
    echo
    print_success "=== Installation Complete! ==="
    echo
    print_status "Access your Capital Choice Platform at:"
    
    if [[ -n "$DOMAIN" ]]; then
        if [[ "$SSL_ENABLED" == true ]]; then
            print_status "  https://$DOMAIN"
        else
            print_status "  http://$DOMAIN"
        fi
    else
        SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
        print_status "  http://$SERVER_IP"
    fi
    
    echo
    print_status "Default login credentials:"
    print_status "  Username: admin"
    print_status "  Password: admin123"
    echo
    print_warning "IMPORTANT: Change the default password immediately!"
    echo
    
    if command -v pm2 &> /dev/null; then
        print_status "Process management (PM2):"
        print_status "  Status:  pm2 status"
        print_status "  Logs:    pm2 logs $APP_NAME"
        print_status "  Restart: pm2 restart $APP_NAME"
        print_status "  Stop:    pm2 stop $APP_NAME"
        print_status "  Monitor: pm2 monit"
    else
        print_status "Service management:"
        print_status "  Start:   systemctl start $APP_NAME"
        print_status "  Stop:    systemctl stop $APP_NAME"
        print_status "  Restart: systemctl restart $APP_NAME"
        print_status "  Status:  systemctl status $APP_NAME"
        print_status "  Logs:    journalctl -u $APP_NAME -f"
    fi
    
    echo
    print_status "File locations:"
    print_status "  Application:   $APP_DIR"
    print_status "  Frontend:      $APP_DIR/public"
    print_status "  Configuration: $APP_DIR/.env"
    print_status "  Database:      $APP_DIR/database.sqlite"
    print_status "  Uploads:       $APP_DIR/uploads"
    print_status "  Logs:          $APP_DIR/logs"
    print_status "  Backups:       $APP_DIR/backups"
    print_status "  Scripts:       $APP_DIR/scripts"
    echo
    print_status "Configuration files:"
    print_status "  Nginx: /etc/nginx/sites-available/$APP_NAME"
    if command -v pm2 &> /dev/null; then
        print_status "  PM2: $APP_DIR/ecosystem.config.js"
    fi
    echo
    print_status "Maintenance:"
    print_status "  Backup script:  $APP_DIR/scripts/backup.sh (runs daily at 2 AM)"
    print_status "  Monitor script: $APP_DIR/scripts/monitor.sh (runs every 5 minutes)"
    print_status "  Cleanup script: $APP_DIR/scripts/cleanup.sh"
    echo
    print_status "Next steps:"
    print_status "  1. Configure email settings in $APP_DIR/.env"
    print_status "  2. Change the default admin password"
    print_status "  3. Test file uploads"
    print_status "  4. Configure monitoring alerts"
    print_status "  5. Review security settings"
    echo
}

# Main installation function
main() {
    echo
    print_status "Capital Choice Office Furniture Bidding Platform"
    print_status "Automated Installation Script"
    echo
    
    check_root
    detect_os
    get_user_input
    
    print_status "Starting installation..."
    
    update_system
    install_git
    install_nodejs
    install_pm2
    install_nginx
    create_app_user
    setup_app_directory
    install_app_files
    update_package_json
    install_dependencies
    
    # Choose between PM2 or systemd
    read -p "Use PM2 for process management? (recommended) (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        configure_pm2
    else
        create_systemd_service
    fi
    
    configure_nginx
    setup_ssl
    setup_firewall
    create_backup_script
    create_monitoring_script
    optimize_system
    start_services
    
    # Wait for services to fully start
    sleep 5
    
    verify_installation
    show_completion
    
    print_success "Installation completed successfully!"
}

# Error handling
trap 'print_error "Installation failed on line $LINENO"' ERR

# Run main function
main "$@"