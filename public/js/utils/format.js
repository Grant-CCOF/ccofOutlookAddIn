// Capital Choice Platform - Formatting Utilities

const Formatter = {
    // Format currency
    currency(amount, decimals = 2) {
        if (typeof amount === 'string') {
            amount = parseFloat(amount);
        }
        
        if (isNaN(amount)) {
            return '$0.00';
        }
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(amount);
    },
    
    // Format number
    number(value, decimals = 0) {
        if (typeof value === 'string') {
            value = parseFloat(value);
        }
        
        if (isNaN(value)) {
            return '0';
        }
        
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    },
    
    // Format percentage
    percentage(value, decimals = 1) {
        if (typeof value === 'string') {
            value = parseFloat(value);
        }
        
        if (isNaN(value)) {
            return '0%';
        }
        
        return `${value.toFixed(decimals)}%`;
    },
    
    // Format date
    date(date, format = 'MM/DD/YYYY') {
        if (!date) return '';
        
        // Fix timezone issue - treat date strings as local time, not UTC
        let d;
        if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // For date-only strings (YYYY-MM-DD), parse as local time
            const [year, month, day] = date.split('-').map(num => parseInt(num, 10));
            d = new Date(year, month - 1, day); // month is 0-based in JS
        } else {
            d = new Date(date);
        }
        
        if (isNaN(d.getTime())) return '';
        
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        let formatted = format;
        formatted = formatted.replace('YYYY', year);
        formatted = formatted.replace('MM', month);
        formatted = formatted.replace('DD', day);
        formatted = formatted.replace('HH', hours);
        formatted = formatted.replace('mm', minutes);
        formatted = formatted.replace('ss', seconds);
        
        // Handle 12-hour format
        if (format.includes('hh')) {
            const hours12 = d.getHours() % 12 || 12;
            formatted = formatted.replace('hh', String(hours12).padStart(2, '0'));
        }
        
        if (format.includes('A')) {
            const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
            formatted = formatted.replace('A', ampm);
        }
        
        return formatted;
    },
    
    // Format time
    time(date) {
        return this.date(date, 'hh:mm A');
    },
    
    // Format datetime
    datetime(date) {
        return this.date(date, 'MM/DD/YYYY hh:mm A');
    },
    
    // Format relative time (time ago)
    timeAgo(date) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const seconds = Math.floor((new Date() - d) / 1000);
        
        if (seconds < 60) {
            return 'just now';
        }
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [name, secondsInInterval] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInInterval);
            if (interval >= 1) {
                return `${interval} ${name}${interval > 1 ? 's' : ''} ago`;
            }
        }
        
        return 'just now';
    },
    
    // Format time until
    timeUntil(date) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const seconds = Math.floor((d - new Date()) / 1000);
        
        if (seconds < 0) {
            return 'expired';
        }
        
        if (seconds < 60) {
            return 'less than a minute';
        }
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [name, secondsInInterval] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInInterval);
            if (interval >= 1) {
                return `${interval} ${name}${interval > 1 ? 's' : ''}`;
            }
        }
        
        return 'less than a minute';
    },
    
    // Format file size
    fileSize(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },
    
    // Format phone number
    phone(phone) {
        if (!phone) return '';
        
        // Remove all non-numeric characters
        const cleaned = String(phone).replace(/\D/g, '');
        
        // Format as (XXX) XXX-XXXX
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        
        // Format as +X (XXX) XXX-XXXX
        if (cleaned.length === 11 && cleaned[0] === '1') {
            return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        
        return phone;
    },
    
    // Format ZIP code
    zipCode(zip) {
        if (!zip) return '';
        
        const cleaned = String(zip).replace(/\D/g, '');
        
        if (cleaned.length === 5) {
            return cleaned;
        }
        
        if (cleaned.length === 9) {
            return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
        }
        
        return zip;
    },
    
    // Format status
    status(status, type = 'project') {
        const config = type === 'project' ? Config.PROJECT_STATUS : Config.BID_STATUS;
        const statusConfig = config[status];
        
        if (!statusConfig) {
            return {
                label: status,
                color: 'secondary',
                icon: 'fa-question-circle'
            };
        }
        
        return statusConfig;
    },
    
    // Format role
    role(role) {
        const roleConfig = Config.USER_ROLES[role];
        
        if (!roleConfig) {
            return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return roleConfig.label;
    },
    
    // Format name
    name(firstName, lastName = '') {
        if (!firstName && !lastName) return '';
        
        return `${firstName || ''} ${lastName || ''}`.trim();
    },
    
    // Format initials
    initials(name) {
        if (!name) return '';
        
        const parts = name.trim().split(' ');
        
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        
        return parts.map(part => part[0]).join('').substring(0, 2).toUpperCase();
    },
    
    // Truncate text
    truncate(text, length = 100, suffix = '...') {
        if (!text || text.length <= length) return text;
        
        return text.substring(0, length - suffix.length) + suffix;
    },
    
    // Pluralize
    pluralize(count, singular, plural = null) {
        if (count === 1) {
            return `${count} ${singular}`;
        }
        
        return `${count} ${plural || singular + 's'}`;
    },
    
    // Title case
    titleCase(str) {
        if (!str) return '';
        
        return str.replace(/\w\S*/g, txt => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },
    
    // Snake case to title
    snakeToTitle(str) {
        if (!str) return '';
        
        return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },
    
    // Highlight text
    highlight(text, search) {
        if (!text || !search) return text;
        
        const regex = new RegExp(`(${search})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    },
    
    // Format rating
    rating(value, maxStars = 5) {
        const fullStars = Math.floor(value);
        const hasHalfStar = value % 1 >= 0.5;
        const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);
        
        let html = '';
        
        for (let i = 0; i < fullStars; i++) {
            html += '<i class="fas fa-star"></i>';
        }
        
        if (hasHalfStar) {
            html += '<i class="fas fa-star-half-alt"></i>';
        }
        
        for (let i = 0; i < emptyStars; i++) {
            html += '<i class="far fa-star"></i>';
        }
        
        return html;
    },
    
    // Format boolean
    boolean(value, trueText = 'Yes', falseText = 'No') {
        return value ? trueText : falseText;
    },
    
    // Format list
    list(items, separator = ', ') {
        if (!Array.isArray(items)) return '';
        
        return items.filter(item => item).join(separator);
    },
    
    // Format address
    address(street, city, state, zip) {
        const parts = [street, city, state, zip].filter(part => part);
        
        if (parts.length === 0) return '';
        
        if (city && state) {
            return `${street || ''}\n${city}, ${state} ${zip || ''}`.trim();
        }
        
        return parts.join(', ');
    }
};