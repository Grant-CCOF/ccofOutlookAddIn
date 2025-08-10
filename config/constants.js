// Application constants and configuration values

module.exports = {
    // User Roles
    ROLES: {
        ADMIN: 'admin',
        PROJECT_MANAGER: 'project_manager',
        INSTALLATION_COMPANY: 'installation_company',
        OPERATIONS: 'operations'
    },
    
    // Project Statuses
    PROJECT_STATUS: {
        DRAFT: 'draft',
        BIDDING: 'bidding',
        REVIEWING: 'reviewing',
        AWARDED: 'awarded',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },
    
    // Bid Statuses
    BID_STATUS: {
        PENDING: 'pending',
        WON: 'won',
        LOST: 'lost',
        WITHDRAWN: 'withdrawn'
    },
    
    // Notification Types
    NOTIFICATION_TYPES: {
        SYSTEM: 'system',
        BID_RECEIVED: 'bid_received',
        BID_ACCEPTED: 'bid_accepted',
        BID_REJECTED: 'bid_rejected',
        PROJECT_UPDATE: 'project_update',
        PROJECT_CANCELLED: 'project_cancelled',
        PROJECT_COMPLETED: 'project_completed',
        ACCOUNT_APPROVED: 'account_approved',
        ACCOUNT_SUSPENDED: 'account_suspended',
        NEW_PROJECT: 'new_project',
        RATING_RECEIVED: 'rating_received',
        MESSAGE: 'message'
    },
    
    // File Upload Configuration
    FILE_UPLOAD: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: {
            DOCUMENTS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'],
            IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
            ARCHIVES: ['.zip', '.rar', '.7z']
        },
        UPLOAD_PATHS: {
            PROJECTS: 'uploads/projects',
            BIDS: 'uploads/bids',
            AVATARS: 'uploads/avatars',
            TEMP: 'uploads/temp'
        }
    },
    
    // Pagination
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100
    },
    
    // Token Configuration
    TOKEN: {
        ACCESS_EXPIRY: '7d',
        REFRESH_EXPIRY: '30d',
        RESET_EXPIRY: '1h',
        VERIFICATION_EXPIRY: '24h'
    },
    
    // Rate Limiting
    RATE_LIMITS: {
        GENERAL: {
            WINDOW_MS: 15 * 60 * 1000, // 15 minutes
            MAX_REQUESTS: 100
        },
        AUTH: {
            WINDOW_MS: 15 * 60 * 1000, // 15 minutes
            MAX_REQUESTS: 5
        },
        API: {
            WINDOW_MS: 1 * 60 * 1000, // 1 minute
            MAX_REQUESTS: 60
        }
    },
    
    // Email Configuration
    EMAIL: {
        TEMPLATES: {
            WELCOME: 'welcome',
            ACCOUNT_APPROVED: 'accountApproved',
            PASSWORD_RESET: 'passwordReset',
            BID_RECEIVED: 'bidReceived',
            BID_ACCEPTED: 'bidAccepted',
            BID_REJECTED: 'bidRejected',
            PROJECT_COMPLETED: 'projectCompleted',
            NEW_RATING: 'newRating',
            WEEKLY_REPORT: 'weeklyReport'
        },
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000 // 1 second
    },
    
    // Validation Rules
    VALIDATION: {
        USERNAME: {
            MIN_LENGTH: 3,
            MAX_LENGTH: 20,
            PATTERN: /^[a-zA-Z0-9_-]+$/
        },
        PASSWORD: {
            MIN_LENGTH: 8,
            PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
        },
        ZIP_CODE: {
            PATTERN: /^\d{5}(-\d{4})?$/
        },
        PHONE: {
            PATTERN: /^[\d\s\-\+\(\)]+$/
        }
    },
    
    // Business Rules
    BUSINESS_RULES: {
        MIN_BID_AMOUNT: 100,
        MAX_BID_AMOUNT: 10000000,
        BID_SUBMISSION_BUFFER: 24 * 60 * 60 * 1000, // 24 hours before due date
        PROJECT_CANCELLATION_WINDOW: 48 * 60 * 60 * 1000, // 48 hours after creation
        RATING_WINDOW: 30 * 24 * 60 * 60 * 1000, // 30 days after completion
        AUTO_CLOSE_BIDDING_DAYS: 30,
        MIN_BIDS_TO_AWARD: 1
    },
    
    // Cache Configuration
    CACHE: {
        TTL: {
            SHORT: 60, // 1 minute
            MEDIUM: 300, // 5 minutes
            LONG: 3600, // 1 hour
            DAY: 86400 // 24 hours
        }
    },
    
    // System Messages
    MESSAGES: {
        SUCCESS: {
            LOGIN: 'Login successful',
            LOGOUT: 'Logout successful',
            REGISTER: 'Registration successful. Please wait for admin approval.',
            PROJECT_CREATED: 'Project created successfully',
            PROJECT_UPDATED: 'Project updated successfully',
            PROJECT_DELETED: 'Project deleted successfully',
            BID_SUBMITTED: 'Bid submitted successfully',
            BID_UPDATED: 'Bid updated successfully',
            BID_WITHDRAWN: 'Bid withdrawn successfully',
            USER_APPROVED: 'User approved successfully',
            USER_SUSPENDED: 'User suspended successfully',
            PASSWORD_CHANGED: 'Password changed successfully',
            PASSWORD_RESET: 'Password reset successfully',
            FILE_UPLOADED: 'File uploaded successfully',
            FILE_DELETED: 'File deleted successfully',
            RATING_SUBMITTED: 'Rating submitted successfully'
        },
        ERROR: {
            UNAUTHORIZED: 'Unauthorized access',
            FORBIDDEN: 'Access forbidden',
            NOT_FOUND: 'Resource not found',
            VALIDATION_FAILED: 'Validation failed',
            INVALID_CREDENTIALS: 'Invalid username or password',
            ACCOUNT_SUSPENDED: 'Your account has been suspended',
            ACCOUNT_PENDING: 'Your account is pending approval',
            TOKEN_EXPIRED: 'Token has expired',
            TOKEN_INVALID: 'Invalid token',
            FILE_TOO_LARGE: 'File size exceeds maximum allowed',
            FILE_TYPE_NOT_ALLOWED: 'File type not allowed',
            PROJECT_NOT_FOUND: 'Project not found',
            BID_NOT_FOUND: 'Bid not found',
            USER_NOT_FOUND: 'User not found',
            ALREADY_EXISTS: 'Already exists',
            INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
            SERVER_ERROR: 'Internal server error'
        }
    }
};