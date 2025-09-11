const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config/constants');
const logger = require('../utils/logger');

// Store for tracking requests (in production, use Redis)
const requestCounts = new Map();

// Custom store for rate limiting
class CustomStore {
    constructor(windowMs) {
        this.windowMs = windowMs;
        this.requests = new Map();
        
        // Clean up old entries periodically
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of this.requests.entries()) {
                if (now - data.resetTime > this.windowMs) {
                    this.requests.delete(key);
                }
            }
        }, this.windowMs);
    }
    
    increment(key) {
        const now = Date.now();
        const record = this.requests.get(key) || {
            count: 0,
            resetTime: now + this.windowMs
        };
        
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + this.windowMs;
        } else {
            record.count++;
        }
        
        this.requests.set(key, record);
        
        return {
            count: record.count,
            resetTime: new Date(record.resetTime)
        };
    }
    
    decrement(key) {
        const record = this.requests.get(key);
        if (record) {
            record.count = Math.max(0, record.count - 1);
        }
    }
    
    reset(key) {
        this.requests.delete(key);
    }
}

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: RATE_LIMITS.GENERAL.WINDOW_MS,
    max: RATE_LIMITS.GENERAL.MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: new CustomStore(RATE_LIMITS.GENERAL.WINDOW_MS),
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: res.getHeader('Retry-After')
        });
    },
    skip: (req) => {
        // Skip rate limiting for certain IPs (whitelist)
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
    store: new CustomStore(RATE_LIMITS.AUTH.WINDOW_MS),
    skipSuccessfulRequests: true, // Don't count successful auth requests
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
            // Different limits based on user role
            if (!req.user) return RATE_LIMITS.API.MAX_REQUESTS;
            
            switch (req.user.role) {
                case 'admin':
                    return RATE_LIMITS.API.MAX_REQUESTS * 3; // Admins get 3x limit
                case 'project_manager':
                    return RATE_LIMITS.API.MAX_REQUESTS * 2; // Project managers get 2x limit
                default:
                    return RATE_LIMITS.API.MAX_REQUESTS;
            }
        },
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise use IP
            return req.user ? `user_${req.user.id}` : req.ip;
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: new CustomStore(RATE_LIMITS.API.WINDOW_MS),
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per window
    message: 'Too many file uploads, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many uploads',
            message: 'Upload rate limit exceeded. Please try again later.',
            retryAfter: res.getHeader('Retry-After')
        });
    }
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
        store: new CustomStore(config.windowMs),
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

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour per IP+email combination
    message: 'Too many password reset attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    store: new CustomStore(60 * 60 * 1000),
    keyGenerator: (req) => {
        // Use IP + email combination for rate limiting
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