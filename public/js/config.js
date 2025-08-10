// Capital Choice Platform - Configuration

const Config = {
    // API Configuration
    API_BASE_URL: window.location.origin + '/api',
    SOCKET_URL: window.location.origin,
    
    // Authentication
    TOKEN_KEY: 'cc_token',
    REFRESH_TOKEN_KEY: 'cc_refresh_token',
    USER_KEY: 'cc_user',
    
    // Application Settings
    APP_NAME: 'Capital Choice Platform',
    APP_VERSION: '1.0.0',
    
    // Pagination
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZES: [10, 25, 50, 100],
    
    // File Upload
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: {
        documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'],
        images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        archives: ['.zip', '.rar', '.7z']
    },
    
    // Timeouts
    API_TIMEOUT: 30000, // 30 seconds
    NOTIFICATION_TIMEOUT: 5000, // 5 seconds
    DEBOUNCE_DELAY: 300, // 300ms
    
    // Refresh Intervals
    DASHBOARD_REFRESH: 60000, // 1 minute
    NOTIFICATION_REFRESH: 30000, // 30 seconds
    
    // Chart Configuration
    CHART_COLORS: {
        primary: '#667eea',
        secondary: '#764ba2',
        success: '#48bb78',
        danger: '#f56565',
        warning: '#ed8936',
        info: '#4299e1',
        light: '#f7fafc',
        dark: '#2d3748'
    },
    
    CHART_OPTIONS: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom'
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    borderDash: [2, 2]
                }
            }
        }
    },
    
    // Status Configuration
    PROJECT_STATUS: {
        draft: { label: 'Draft', color: 'secondary', icon: 'fa-pencil-alt' },
        bidding: { label: 'Open for Bidding', color: 'info', icon: 'fa-gavel' },
        reviewing: { label: 'Under Review', color: 'warning', icon: 'fa-search' },
        awarded: { label: 'Awarded', color: 'success', icon: 'fa-trophy' },
        in_progress: { label: 'In Progress', color: 'primary', icon: 'fa-spinner' },
        completed: { label: 'Completed', color: 'success', icon: 'fa-check-circle' },
        cancelled: { label: 'Cancelled', color: 'danger', icon: 'fa-times-circle' }
    },
    
    BID_STATUS: {
        pending: { label: 'Pending', color: 'warning', icon: 'fa-clock' },
        won: { label: 'Won', color: 'success', icon: 'fa-trophy' },
        lost: { label: 'Lost', color: 'danger', icon: 'fa-times-circle' },
        withdrawn: { label: 'Withdrawn', color: 'secondary', icon: 'fa-undo' }
    },
    
    USER_ROLES: {
        admin: { label: 'Administrator', icon: 'fa-user-shield', color: 'danger' },
        project_manager: { label: 'Project Manager', icon: 'fa-project-diagram', color: 'primary' },
        installation_company: { label: 'Installation Company', icon: 'fa-building', color: 'success' },
        operations: { label: 'Operations', icon: 'fa-cogs', color: 'info' }
    },
    
    // Notification Types
    NOTIFICATION_TYPES: {
        system: { icon: 'fa-info-circle', color: 'info' },
        bid_received: { icon: 'fa-gavel', color: 'primary' },
        bid_accepted: { icon: 'fa-check-circle', color: 'success' },
        bid_rejected: { icon: 'fa-times-circle', color: 'danger' },
        project_update: { icon: 'fa-project-diagram', color: 'info' },
        project_completed: { icon: 'fa-flag-checkered', color: 'success' },
        rating_received: { icon: 'fa-star', color: 'warning' },
        message: { icon: 'fa-envelope', color: 'secondary' }
    },
    
    // Validation Rules
    VALIDATION: {
        username: {
            minLength: 3,
            maxLength: 20,
            pattern: /^[a-zA-Z0-9_-]+$/,
            message: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'
        },
        password: {
            minLength: 8,
            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            message: 'Password must be at least 8 characters with uppercase, lowercase, and numbers'
        },
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address'
        },
        phone: {
            pattern: /^[\d\s\-\+\(\)]+$/,
            message: 'Please enter a valid phone number'
        },
        zipCode: {
            pattern: /^\d{5}(-\d{4})?$/,
            message: 'Please enter a valid ZIP code (12345 or 12345-6789)'
        }
    },
    
    // Date/Time Formats
    DATE_FORMAT: 'MM/DD/YYYY',
    TIME_FORMAT: 'hh:mm A',
    DATETIME_FORMAT: 'MM/DD/YYYY hh:mm A',
    
    // Map Configuration
    MAP_CONFIG: {
        defaultCenter: { lat: 39.8283, lng: -98.5795 }, // Geographic center of USA
        defaultZoom: 4,
        style: 'mapbox://styles/mapbox/light-v10'
    },
    
    // Feature Flags
    FEATURES: {
        enableChat: false,
        enableVideoCall: false,
        enableAdvancedAnalytics: true,
        enableBulkOperations: true,
        enableExport: true,
        enableImport: false,
        enableAPI: false,
        enableWebhooks: false
    },
    
    // Environment
    ENV: window.location.hostname === 'localhost' ? 'development' : 'production',
    DEBUG: window.location.hostname === 'localhost',
    
    // Get config value with fallback
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    },
    
    // Set config value
    set(key, value) {
        const keys = key.split('.');
        let obj = this;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in obj) || typeof obj[k] !== 'object') {
                obj[k] = {};
            }
            obj = obj[k];
        }
        
        obj[keys[keys.length - 1]] = value;
    },
    
    // Log debug message
    log(...args) {
        if (this.DEBUG) {
            console.log('[Capital Choice]', ...args);
        }
    },
    
    // Log error
    error(...args) {
        console.error('[Capital Choice Error]', ...args);
    }
};

// Freeze config to prevent accidental modifications
Object.freeze(Config.VALIDATION);
Object.freeze(Config.PROJECT_STATUS);
Object.freeze(Config.BID_STATUS);
Object.freeze(Config.USER_ROLES);
Object.freeze(Config.NOTIFICATION_TYPES);
Object.freeze(Config.FEATURES);