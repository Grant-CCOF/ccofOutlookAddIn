# Capital Choice Office Furniture Bidding Platform

A comprehensive web-based platform for managing office furniture installation projects and contractor bidding.

## Features

- **Multi-Role System**: Support for Admin, Project Managers, Installation Companies, and Operations
- **Project Management**: Create, manage, and track installation projects
- **Bidding System**: Contractors can submit and manage bids on projects
- **Real-time Updates**: Socket.IO powered real-time notifications
- **File Management**: Upload and manage project documents
- **Rating System**: Rate contractors after project completion
- **Dashboard Analytics**: Role-specific dashboards with metrics and charts
- **Security**: JWT authentication, role-based access control, and data encryption

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (easily upgradeable to PostgreSQL/MySQL)
- **Real-time**: Socket.IO
- **Authentication**: JWT
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Server**: Nginx (reverse proxy)
- **Process Manager**: PM2
- **OS**: Ubuntu/Debian Linux

## Installation

### Prerequisites

- Ubuntu 20.04+ or Debian 10+
- Node.js 18.x or higher
- Nginx
- Git

### Quick Installation

1. Clone the repository:
git clone https://github.com/your-org/capital-choice-platform.git
cd capital-choice-platform
2. Run the deployment script:
sudo bash scripts/deploy.sh
3. Follow the prompts to configure your domain and email settings.

Manual Installation
See INSTALL.md for detailed manual installation instructions.
Configuration
Environment Variables
Copy .env.example to .env and configure:
cp .env.example .env
nano .env
Key configuration options:

JWT_SECRET: Secret key for JWT tokens
DATABASE_PATH: Path to SQLite database
EMAIL_*: SMTP settings for email notifications
RATE_LIMIT_*: API rate limiting settings

Nginx Configuration
The Nginx configuration is automatically set up by the deployment script. For manual configuration, see /etc/nginx/sites-available/capital-choice-platform.
Usage
Default Admin Access

Username: admin
Password: admin123

Important: Change the default password immediately after first login!
Starting the Application
# Using PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Using systemd
sudo systemctl start capital-choice-platform
sudo systemctl enable capital-choice-platform
Monitoring
# View logs
pm2 logs capital-choice-platform

# Monitor resources
pm2 monit

# Check status
pm2 status
API Documentation
Authentication Endpoints

POST /api/auth/login - User login
POST /api/auth/register - User registration
POST /api/auth/refresh - Refresh token
POST /api/auth/logout - User logout
GET /api/auth/me - Get current user

Project Endpoints

GET /api/projects - List projects
GET /api/projects/:id - Get project details
POST /api/projects - Create project
PUT /api/projects/:id - Update project
DELETE /api/projects/:id - Delete project
POST /api/projects/:id/start-bidding - Start bidding
POST /api/projects/:id/award - Award project
POST /api/projects/:id/complete - Mark as completed

Bid Endpoints

GET /api/bids/my-bids - Get user's bids
GET /api/bids/project/:projectId - Get project bids
POST /api/bids - Submit bid
PUT /api/bids/:id - Update bid
DELETE /api/bids/:id - Withdraw bid

User Endpoints

GET /api/users - List users (admin)
GET /api/users/:id - Get user details
PUT /api/users/:id - Update user
POST /api/users/:id/approve - Approve user (admin)
POST /api/users/:id/suspend - Suspend user (admin)
DELETE /api/users/:id - Delete user (admin)

Maintenance
Backup
Automated daily backups are configured. Manual backup:
bashbash /opt/capital-choice-platform/scripts/backup.sh
Cleanup
Remove old logs and temporary files:
bashbash /opt/capital-choice-platform/scripts/cleanup.sh
Monitoring
The monitoring script runs every 5 minutes via cron. Manual check:
bashbash /opt/capital-choice-platform/scripts/monitor.sh
Directory Structure
/opt/capital-choice-platform/
├── server.js              # Main application server
├── package.json           # Node.js dependencies
├── .env                   # Environment configuration
├── ecosystem.config.js    # PM2 configuration
├── database.sqlite        # SQLite database
├── models/               # Database models
├── routes/               # API routes
├── middleware/           # Express middleware
├── services/             # Business logic services
├── utils/                # Utility functions
├── public/               # Frontend static files
│   ├── index.html       # Main HTML file
│   ├── css/             # Stylesheets
│   ├── js/              # JavaScript files
│   └── images/          # Images
├── uploads/              # User uploaded files
├── logs/                 # Application logs
├── backups/              # Database backups
└── scripts/              # Maintenance scripts
Security

JWT-based authentication
Password hashing with bcrypt
Input validation and sanitization
SQL injection prevention
XSS protection
CSRF protection
Rate limiting
File upload restrictions
Security headers via Helmet

Troubleshooting
Application Not Starting
bash# Check logs
pm2 logs capital-choice-platform

# Check Node.js
node --version

# Check database
sqlite3 /opt/capital-choice-platform/database.sqlite "SELECT COUNT(*) FROM users;"
Socket.IO Connection Issues
bash# Test Socket.IO endpoint
curl http://localhost:3000/socket.io/socket.io.js

# Check Nginx configuration
nginx -t
sudo systemctl reload nginx
Database Issues
bash# Check database integrity
sqlite3 /opt/capital-choice-platform/database.sqlite "PRAGMA integrity_check;"

# Backup and recreate if needed
cp database.sqlite database.sqlite.backup
Contributing

Fork the repository
Create a feature branch
Commit your changes
Push to the branch
Create a Pull Request

License
Copyright © 2024 Capital Choice. All rights reserved.
Support
For support, email support@capitalchoice.com or create an issue in the repository.
Changelog
See CHANGELOG.md for version history.
Authors

Capital Choice Development Team

Acknowledgments

Node.js community
Express.js team
Socket.IO contributors
Open source community


### **35. CHANGELOG.md**
```markdown
# Changelog

All notable changes to the Capital Choice Bidding Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

### Added
- Initial release of Capital Choice Bidding Platform
- Multi-role authentication system (Admin, Project Manager, Installation Company, Operations)
- Project management functionality
- Bidding system for contractors
- Real-time notifications using Socket.IO
- File upload and management
- Rating system for completed projects
- Dashboard with role-specific metrics
- Email notifications for important events
- Automated backup system
- Monitoring and health check scripts
- Comprehensive API endpoints
- Security features including JWT authentication and rate limiting

### Security
- Implemented JWT-based authentication
- Added password hashing with bcrypt
- Configured security headers with Helmet
- Implemented rate limiting for API endpoints
- Added input validation and sanitization
- Configured CORS properly
- Added file upload restrictions

### Infrastructure
- Configured Nginx as reverse proxy
- Set up PM2 for process management
- Implemented automated deployment script
- Added backup and cleanup scripts
- Configured monitoring and alerting

## [0.9.0] - 2024-01-01 (Beta)

### Added
- Beta release for testing
- Core functionality implementation
- Basic UI/UX
- Database schema design
- API structure

### Changed
- Refactored authentication flow
- Improved error handling
- Optimized database queries

### Fixed
- Socket.IO connection issues
- File upload bugs
- Session management issues

## [0.5.0] - 2023-12-15 (Alpha)

### Added
- Initial alpha release
- Basic project creation
- Simple bidding system
- User registration and login

### Known Issues
- Socket.IO configuration needs improvement
- Some UI elements not responsive
- Performance optimization needed

## Future Releases

### [1.1.0] - Planned
- Advanced reporting features
- Mobile application
- Integration with accounting systems
- Advanced analytics dashboard
- Bulk operations support
- API v2 with GraphQL support

### [1.2.0] - Planned
- Multi-language support
- Advanced notification preferences
- Custom workflow automation
- Third-party integrations
- Advanced search and filtering
- Data export functionality

## Upgrade Instructions

### From 0.9.0 to 1.0.0
1. Backup your database and files
2. Update code to latest version
3. Run database migrations (if any)
4. Update environment variables
5. Restart the application

### From 0.5.0 to 1.0.0
1. Full backup required
2. Database schema has changed - migration required
3. Update all dependencies
4. Update Nginx configuration
5. Re-deploy using new deployment script

## Support

For upgrade assistance, contact support@capitalchoice.com

---

For detailed commit history, see the [Git repository](https://github.com/capital-choice/platform).