// Validation helper functions

module.exports = {
    isEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    isValidPassword: (password) => {
        return password && password.length >= 6;
    },
    
    isStrongPassword: (password) => {
        // At least 8 characters, one uppercase, one lowercase, one number
        const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        return strongRegex.test(password);
    },
    
    isValidRole: (role) => {
        const validRoles = ['admin', 'project_manager', 'installation_company', 'operations'];
        return validRoles.includes(role);
    },
    
    isValidProjectStatus: (status) => {
        const validStatuses = ['draft', 'bidding', 'reviewing', 'awarded', 'completed', 'cancelled'];
        return validStatuses.includes(status);
    },
    
    isValidBidStatus: (status) => {
        const validStatuses = ['pending', 'won', 'lost'];
        return validStatuses.includes(status);
    },
    
    isValidZipCode: (zipCode) => {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        return zipRegex.test(zipCode);
    },
    
    isValidPhone: (phone) => {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        return !phone || phoneRegex.test(phone);
    },
    
    isValidAmount: (amount) => {
        return !isNaN(amount) && parseFloat(amount) > 0;
    },
    
    isValidRating: (rating) => {
        return Number.isInteger(rating) && rating >= 1 && rating <= 5;
    },
    
    isValidDate: (date) => {
        const d = new Date(date);
        return d instanceof Date && !isNaN(d);
    },
    
    isFutureDate: (date) => {
        return new Date(date) > new Date();
    },
    
    isValidUrl: (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    isValidUsername: (username) => {
        // Alphanumeric, underscore, hyphen, 3-20 characters
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        return usernameRegex.test(username);
    },
    
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return input
            .trim()
            .replace(/[<>]/g, '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },
    
    sanitizeHtml: (html) => {
        // Basic HTML sanitization - in production, use a library like DOMPurify
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    },
    
    validateFileType: (filename, allowedTypes) => {
        const ext = filename.split('.').pop().toLowerCase();
        return allowedTypes.includes(ext);
    },
    
    validateImageFile: (filename) => {
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        return this.validateFileType(filename, imageTypes);
    },
    
    validateDocumentFile: (filename) => {
        const docTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
        return this.validateFileType(filename, docTypes);
    },
    
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    formatDateTime: (date) => {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    generateRandomString: (length = 10) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    parseJSON: (str, defaultValue = null) => {
        try {
            return JSON.parse(str);
        } catch {
            return defaultValue;
        }
    },
    
    escapeRegex: (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};