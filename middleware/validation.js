const { validationResult } = require('express-validator');

// Middleware to check validation results
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed',
            errors: errors.array() 
        });
    }
    next();
};

// Custom validators
const customValidators = {
    isValidRole: (value) => {
        const validRoles = ['admin', 'project_manager', 'installation_company', 'operations'];
        return validRoles.includes(value);
    },
    
    isValidProjectStatus: (value) => {
        const validStatuses = ['draft', 'bidding', 'reviewing', 'awarded', 'completed', 'cancelled'];
        return validStatuses.includes(value);
    },
    
    isValidBidStatus: (value) => {
        const validStatuses = ['pending', 'won', 'lost'];
        return validStatuses.includes(value);
    },
    
    isFutureDate: (value) => {
        return new Date(value) > new Date();
    },
    
    isValidZipCode: (value) => {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        return zipRegex.test(value);
    },
    
    isValidEmail: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    },
    
    isStrongPassword: (value) => {
        // At least 8 characters, one uppercase, one lowercase, one number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        return passwordRegex.test(value);
    },
    
    isValidPhone: (value) => {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        return !value || phoneRegex.test(value);
    },
    
    isValidAmount: (value) => {
        return !isNaN(value) && parseFloat(value) > 0;
    },
    
    isValidRating: (value) => {
        return Number.isInteger(value) && value >= 1 && value <= 5;
    }
};

// Request sanitization middleware
const sanitizeInput = (req, res, next) => {
    const sanitize = (obj) => {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].trim();
                // Remove any HTML tags
                obj[key] = obj[key].replace(/<[^>]*>/g, '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitize(obj[key]);
            }
        }
    };
    
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    
    next();
};

module.exports = {
    handleValidationErrors,
    customValidators,
    sanitizeInput
};