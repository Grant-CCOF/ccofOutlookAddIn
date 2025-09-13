const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config/constants');
const logger = require('../utils/logger');

// Store for tracking requests (in production, use Redis)
const requestCounts = new Map();

// Custom store for rate limiting
class CustomStore {
    constructor() {
        this.requests = new Map();
        this.windowMs = 60000; // Default, will be set by init()
        this.interval = null;
    }
    
    // Init method is called by express-rate-limit with options
    async init(options) {
        this.windowMs = options.windowMs;
        
        // Clean up old entries periodically
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        this.interval = setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.requests.entries()) {
                if (now - data.resetTime > this.windowMs) {
                    this.requests.delete(key);
                }
            }
        }, this.windowMs);
    }
    
    // Get method to retrieve current hit count
    async get(key) {
        const record = this.requests.get(key);
        if (!record) {
            return undefined;
        }
        
        const now = Date.now();
        if (now > record.resetTime) {
            this.requests.delete(key);
            return undefined;
        }
        
        return {
            totalHits: record.count,
            resetTime: new Date(record.resetTime)
        };
    }
    
    // Increment the hit counter for a key
    async increment(key) {
        const now = Date.now();
        let record = this.requests.get(key);
        
        if (!record || now > record.resetTime) {
            record = {
                count: 1,
                resetTime: now + this.windowMs
            };
        } else {
            record.count++;
        }
        
        this.requests.set(key, record);
        
        return {
            totalHits: record.count,
            resetTime: new Date(record.resetTime)
        };
    }
    
    // Decrement the hit counter for a key
    async decrement(key) {
        const record = this.requests.get(key);
        if (record && record.count > 0) {
            record.count--;
            this.requests.set(key, record);
        }
    }
    
    // Reset a specific key
    async resetKey(key) {
        this.requests.delete(key);
    }
    
    // Reset all keys
    async resetAll() {
        this.requests.clear();
    }
    
    // Cleanup method
    async shutdown() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.requests.clear();
    }
}

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: RATE_LIMITS.GENERAL.WINDOW_MS,
    max: RATE_LIMITS.GENERAL.MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: new CustomStore(), // No need to pass windowMs
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: res.getHeader('Retry-After')
        });
    },
    skip: (req) => {
        const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
        return whitelist.includes(req.ip);
    }
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
    windowMs: RATE_LIMITS.AUTH.WINDOW_MS,
    max: RATE_LIMITS.AUTH.MAX_REQUESTS,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: new CustomStore(), // Changed here
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        logger.error(`Auth rate limit exceeded for IP: ${req.ip}, Username: ${req.body.username}`);
        res.status(429).json({
            error: 'Too many authentication attempts',
            message: 'Account temporarily locked. Please try again later.',
            retryAfter: res.getHeader('Retry-After')
        });
    }
});

// API rate limiter with different limits per user role
const createApiLimiter = () => {
    return rateLimit({
        windowMs: RATE_LIMITS.API.WINDOW_MS,
        max: (req) => {
            if (!req.user) return RATE_LIMITS.API.MAX_REQUESTS;
            
            switch (req.user.role) {
                case 'admin':
                    return RATE_LIMITS.API.MAX_REQUESTS * 3;
                case 'project_manager':
                    return RATE_LIMITS.API.MAX_REQUESTS * 2;
                default:
                    return RATE_LIMITS.API.MAX_REQUESTS;
            }
        },
        keyGenerator: (req) => {
            return req.user ? `user_${req.user.id}` : req.ip;
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new CustomStore(), // Changed here
        handler: (req, res) => {
            const identifier = req.user ? `User ${req.user.id}` : `IP ${req.ip}`;
            logger.warn(`API rate limit exceeded for ${identifier}`);
            res.status(429).json({
                error: 'Too many API requests',
                message: 'API rate limit exceeded. Please slow down your requests.',
                retryAfter: res.getHeader('Retry-After')
            });
        }
    });
};

// File upload rate limiter
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many file uploads, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: new CustomStore(), // Changed here
    handler: (req, res) => {
        logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many uploads',
            message: 'Upload rate limit exceeded. Please try again later.',
            retryAfter: res.getHeader('Retry-After')
        });
    }
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: new CustomStore(), // Changed here
    keyGenerator: (req) => {
        return `reset_${req.ip}:${req.body.email || 'unknown'}`;
    },
    handler: (req, res) => {
        logger.warn(`Password reset rate limit exceeded for IP: ${req.ip}, Email: ${req.body.email}`);
        res.status(429).json({
            error: 'Too many password reset attempts',
            message: 'Please wait before requesting another password reset. Check your spam folder for existing emails.',
            retryAfter: res.getHeader('Retry-After')
        });
    },
});

// Dynamic rate limiter based on endpoint
const dynamicLimiter = (options = {}) => {
    const defaults = {
        windowMs: RATE_LIMITS.GENERAL.WINDOW_MS,
        max: RATE_LIMITS.GENERAL.MAX_REQUESTS,
        message: 'Too many requests, please try again later.'
    };
    
    const config = { ...defaults, ...options };
    
    return rateLimit({
        ...config,
        standardHeaders: true,
        legacyHeaders: false,
        store: new CustomStore(), // Changed here
        handler: (req, res) => {
            logger.warn(`Dynamic rate limit exceeded for IP: ${req.ip}, Endpoint: ${req.originalUrl}`);
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: config.message,
                retryAfter: res.getHeader('Retry-After')
            });
        }
    });
};

// Middleware to track request patterns (for detecting abuse)
const trackRequestPatterns = (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!requestCounts.has(key)) {
        requestCounts.set(key, {
            count: 0,
            firstRequest: now,
            lastRequest: now,
            endpoints: new Map()
        });
    }
    
    const data = requestCounts.get(key);
    data.count++;
    data.lastRequest = now;
    
    // Track endpoint access patterns
    const endpoint = `${req.method} ${req.path}`;
    const endpointCount = data.endpoints.get(endpoint) || 0;
    data.endpoints.set(endpoint, endpointCount + 1);
    
    // Detect potential abuse patterns
    const timeDiff = (now - data.firstRequest) / 1000; // seconds
    const requestRate = data.count / (timeDiff || 1);
    
    if (requestRate > 10 && data.count > 100) {
        // More than 10 requests per second sustained over 100 requests
        logger.error(`Potential abuse detected from IP: ${req.ip}, Rate: ${requestRate.toFixed(2)} req/s`);
        
        // Could implement automatic blocking here
        // For now, just log it
    }
    
    next();
};

module.exports = {
    generalLimiter,
    authLimiter,
    apiLimiter: createApiLimiter(),
    uploadLimiter,
    passwordResetLimiter,
    dynamicLimiter,
    trackRequestPatterns,
    CustomStore
};