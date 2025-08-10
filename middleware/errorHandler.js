const logger = require('../utils/logger');

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error('Error occurred:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        user: req.user ? req.user.id : 'anonymous'
    });
    
    // Determine error status
    const status = err.status || err.statusCode || 500;
    
    // Prepare error response
    const errorResponse = {
        error: {
            message: err.message || 'Internal server error',
            status: status
        }
    };
    
    // In development, include stack trace
    if (process.env.NODE_ENV === 'development') {
        errorResponse.error.stack = err.stack;
        errorResponse.error.details = err;
    }
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        errorResponse.error.message = 'Validation failed';
        errorResponse.error.details = err.errors;
        return res.status(400).json(errorResponse);
    }
    
    if (err.name === 'UnauthorizedError') {
        errorResponse.error.message = 'Unauthorized access';
        return res.status(401).json(errorResponse);
    }
    
    if (err.name === 'JsonWebTokenError') {
        errorResponse.error.message = 'Invalid token';
        return res.status(401).json(errorResponse);
    }
    
    if (err.name === 'TokenExpiredError') {
        errorResponse.error.message = 'Token expired';
        return res.status(401).json(errorResponse);
    }
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        errorResponse.error.message = 'File too large';
        return res.status(413).json(errorResponse);
    }
    
    if (err.code === 'SQLITE_CONSTRAINT') {
        errorResponse.error.message = 'Database constraint violation';
        return res.status(409).json(errorResponse);
    }
    
    // Send error response
    res.status(status).json(errorResponse);
};

// Not found handler
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Request timeout handler
const timeoutHandler = (timeout = 30000) => {
    return (req, res, next) => {
        const timeoutId = setTimeout(() => {
            const error = new Error('Request timeout');
            error.status = 408;
            next(error);
        }, timeout);
        
        res.on('finish', () => {
            clearTimeout(timeoutId);
        });
        
        next();
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    timeoutHandler
};