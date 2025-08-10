// Capital Choice Platform - Validation Utilities

const Validators = {
    // Required field
    required(value, message = 'This field is required') {
        if (value === null || value === undefined || value === '') {
            return { valid: false, message };
        }
        
        if (typeof value === 'string' && value.trim() === '') {
            return { valid: false, message };
        }
        
        if (Array.isArray(value) && value.length === 0) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Email validation
    email(value, message = 'Please enter a valid email address') {
        if (!value) return { valid: true }; // Use required validator for required check
        
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!pattern.test(value)) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Phone validation
    phone(value, message = 'Please enter a valid phone number') {
        if (!value) return { valid: true };
        
        // Remove all non-numeric characters
        const cleaned = value.replace(/\D/g, '');
        
        // Check if it's a valid US phone number (10 or 11 digits)
        if (cleaned.length !== 10 && cleaned.length !== 11) {
            return { valid: false, message };
        }
        
        if (cleaned.length === 11 && cleaned[0] !== '1') {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // ZIP code validation
    zipCode(value, message = 'Please enter a valid ZIP code') {
        if (!value) return { valid: true };
        
        const pattern = /^\d{5}(-\d{4})?$/;
        
        if (!pattern.test(value)) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Username validation
    username(value) {
        const config = Config.VALIDATION.username;
        
        if (!value) {
            return { valid: false, message: 'Username is required' };
        }
        
        if (value.length < config.minLength || value.length > config.maxLength) {
            return { 
                valid: false, 
                message: `Username must be between ${config.minLength} and ${config.maxLength} characters` 
            };
        }
        
        if (!config.pattern.test(value)) {
            return { valid: false, message: config.message };
        }
        
        return { valid: true };
    },
    
    // Password validation
    password(value) {
        const config = Config.VALIDATION.password;
        
        if (!value) {
            return { valid: false, message: 'Password is required' };
        }
        
        if (value.length < config.minLength) {
            return { 
                valid: false, 
                message: `Password must be at least ${config.minLength} characters` 
            };
        }
        
        if (!config.pattern.test(value)) {
            return { valid: false, message: config.message };
        }
        
        return { valid: true };
    },
    
    // Confirm password validation
    confirmPassword(password, confirmPassword, message = 'Passwords do not match') {
        if (password !== confirmPassword) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Min length validation
    minLength(value, min, message = null) {
        if (!value) return { valid: true };
        
        const length = typeof value === 'string' ? value.length : value;
        
        if (length < min) {
            return { 
                valid: false, 
                message: message || `Must be at least ${min} characters` 
            };
        }
        
        return { valid: true };
    },
    
    // Max length validation
    maxLength(value, max, message = null) {
        if (!value) return { valid: true };
        
        const length = typeof value === 'string' ? value.length : value;
        
        if (length > max) {
            return { 
                valid: false, 
                message: message || `Must be no more than ${max} characters` 
            };
        }
        
        return { valid: true };
    },
    
    // Min value validation
    min(value, min, message = null) {
        if (!value && value !== 0) return { valid: true };
        
        const num = parseFloat(value);
        
        if (isNaN(num) || num < min) {
            return { 
                valid: false, 
                message: message || `Must be at least ${min}` 
            };
        }
        
        return { valid: true };
    },
    
    // Max value validation
    max(value, max, message = null) {
        if (!value && value !== 0) return { valid: true };
        
        const num = parseFloat(value);
        
        if (isNaN(num) || num > max) {
            return { 
                valid: false, 
                message: message || `Must be no more than ${max}` 
            };
        }
        
        return { valid: true };
    },
    
    // Range validation
    range(value, min, max, message = null) {
        if (!value && value !== 0) return { valid: true };
        
        const num = parseFloat(value);
        
        if (isNaN(num) || num < min || num > max) {
            return { 
                valid: false, 
                message: message || `Must be between ${min} and ${max}` 
            };
        }
        
        return { valid: true };
    },
    
    // Pattern validation
    pattern(value, pattern, message = 'Invalid format') {
        if (!value) return { valid: true };
        
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        
        if (!regex.test(value)) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Number validation
    number(value, message = 'Must be a valid number') {
        if (!value && value !== 0) return { valid: true };
        
        if (isNaN(value)) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Integer validation
    integer(value, message = 'Must be a whole number') {
        if (!value && value !== 0) return { valid: true };
        
        if (!Number.isInteger(Number(value))) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // URL validation
    url(value, message = 'Please enter a valid URL') {
        if (!value) return { valid: true };
        
        try {
            new URL(value);
            return { valid: true };
        } catch {
            return { valid: false, message };
        }
    },
    
    // Date validation
    date(value, message = 'Please enter a valid date') {
        if (!value) return { valid: true };
        
        const date = new Date(value);
        
        if (isNaN(date.getTime())) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Future date validation
    futureDate(value, message = 'Date must be in the future') {
        if (!value) return { valid: true };
        
        const date = new Date(value);
        const now = new Date();
        
        if (date <= now) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // Past date validation
    pastDate(value, message = 'Date must be in the past') {
        if (!value) return { valid: true };
        
        const date = new Date(value);
        const now = new Date();
        
        if (date >= now) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    // File validation
    file(file, options = {}) {
        const {
            maxSize = Config.MAX_FILE_SIZE,
            allowedTypes = [],
            message = 'Invalid file'
        } = options;
        
        if (!file) return { valid: true };
        
        // Check file size
        if (file.size > maxSize) {
            return { 
                valid: false, 
                message: `File size must not exceed ${Formatter.fileSize(maxSize)}` 
            };
        }
        
        // Check file type
        if (allowedTypes.length > 0) {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            if (!allowedTypes.includes(extension)) {
                return { 
                    valid: false, 
                    message: `File type must be one of: ${allowedTypes.join(', ')}` 
                };
            }
        }
        
        return { valid: true };
    },
    
    // Custom validation
    custom(value, validatorFn, message = 'Invalid value') {
        const result = validatorFn(value);
        
        if (result === false) {
            return { valid: false, message };
        }
        
        if (typeof result === 'object' && !result.valid) {
            return result;
        }
        
        return { valid: true };
    },
    
    // Validate form
    validateForm(formData, rules) {
        const errors = {};
        let isValid = true;
        
        for (const field in rules) {
            const value = formData[field];
            const fieldRules = Array.isArray(rules[field]) ? rules[field] : [rules[field]];
            
            for (const rule of fieldRules) {
                let result;
                
                if (typeof rule === 'function') {
                    result = rule(value, formData);
                } else if (typeof rule === 'object') {
                    const { validator, ...options } = rule;
                    result = this[validator](value, ...Object.values(options));
                } else {
                    result = this[rule](value);
                }
                
                if (!result.valid) {
                    errors[field] = result.message;
                    isValid = false;
                    break;
                }
            }
        }
        
        return { valid: isValid, errors };
    },
    
    // Show validation errors
    showErrors(errors, formId) {
        // Clear existing errors
        this.clearErrors(formId);
        
        for (const field in errors) {
            const input = document.querySelector(`#${formId} [name="${field}"]`);
            if (input) {
                input.classList.add('is-invalid');
                
                // Create error message element
                const errorDiv = document.createElement('div');
                errorDiv.className = 'invalid-feedback';
                errorDiv.textContent = errors[field];
                
                // Insert after input
                input.parentNode.insertBefore(errorDiv, input.nextSibling);
            }
        }
    },
    
    // Clear validation errors
    clearErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        form.querySelectorAll('.is-invalid').forEach(el => {
            el.classList.remove('is-invalid');
        });
        
        form.querySelectorAll('.invalid-feedback').forEach(el => {
            el.remove();
        });
    }
};