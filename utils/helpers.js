const crypto = require('crypto');
const path = require('path');

module.exports = {
    // String helpers
    capitalize: (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    titleCase: (str) => {
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },
    
    slugify: (str) => {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    },
    
    truncate: (str, length = 100, suffix = '...') => {
        if (str.length <= length) return str;
        return str.substr(0, length - suffix.length) + suffix;
    },
    
    // Number helpers
    randomInt: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    formatNumber: (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    
    formatBytes: (bytes, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },
    
    percentage: (value, total, decimals = 2) => {
        if (total === 0) return 0;
        return ((value / total) * 100).toFixed(decimals);
    },
    
    // Date helpers
    daysAgo: (days) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
    },
    
    daysBetween: (date1, date2) => {
        const oneDay = 24 * 60 * 60 * 1000;
        const firstDate = new Date(date1);
        const secondDate = new Date(date2);
        return Math.round(Math.abs((firstDate - secondDate) / oneDay));
    },
    
    addDays: (date, days) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    
    isToday: (date) => {
        const today = new Date();
        const compareDate = new Date(date);
        return compareDate.toDateString() === today.toDateString();
    },
    
    isPastDate: (date) => {
        return new Date(date) < new Date();
    },
    
    getTimeAgo: (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        
        return Math.floor(seconds) + ' seconds ago';
    },
    
    // Array helpers
    chunk: (array, size) => {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    },
    
    shuffle: (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },
    
    unique: (array, key) => {
        if (!key) return [...new Set(array)];
        
        const seen = new Set();
        return array.filter(item => {
            const val = item[key];
            if (seen.has(val)) return false;
            seen.add(val);
            return true;
        });
    },
    
    groupBy: (array, key) => {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },
    
    // Object helpers
    pick: (obj, keys) => {
        return keys.reduce((result, key) => {
            if (obj.hasOwnProperty(key)) {
                result[key] = obj[key];
            }
            return result;
        }, {});
    },
    
    omit: (obj, keys) => {
        const result = { ...obj };
        keys.forEach(key => delete result[key]);
        return result;
    },
    
    deepClone: (obj) => {
        return JSON.parse(JSON.stringify(obj));
    },
    
    isEmpty: (obj) => {
        if (!obj) return true;
        if (Array.isArray(obj)) return obj.length === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    },
    
    // Crypto helpers
    hash: (str) => {
        return crypto.createHash('sha256').update(str).digest('hex');
    },
    
    generateToken: (length = 32) => {
        return crypto.randomBytes(length).toString('hex');
    },
    
    generateId: () => {
        return crypto.randomBytes(16).toString('hex');
    },
    
    // File helpers
    getFileExtension: (filename) => {
        return path.extname(filename).toLowerCase();
    },
    
    getFileName: (filepath) => {
        return path.basename(filepath, path.extname(filepath));
    },
    
    isImage: (filename) => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
        return imageExtensions.includes(path.extname(filename).toLowerCase());
    },
    
    isDocument: (filename) => {
        const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
        return docExtensions.includes(path.extname(filename).toLowerCase());
    },
    
    // Async helpers
    sleep: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    retry: async (fn, retries = 3, delay = 1000) => {
        try {
            return await fn();
        } catch (error) {
            if (retries === 0) throw error;
            await module.exports.sleep(delay);
            return module.exports.retry(fn, retries - 1, delay * 2);
        }
    },
    
    timeout: (promise, ms) => {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), ms)
            )
        ]);
    },
    
    // Pagination helpers
    paginate: (array, page = 1, perPage = 10) => {
        const offset = (page - 1) * perPage;
        const items = array.slice(offset, offset + perPage);
        
        return {
            items,
            currentPage: page,
            perPage,
            total: array.length,
            totalPages: Math.ceil(array.length / perPage),
            hasNext: offset + perPage < array.length,
            hasPrev: page > 1
        };
    },
    
    // Validation helpers
    isProduction: () => {
        return process.env.NODE_ENV === 'production';
    },
    
    isDevelopment: () => {
        return process.env.NODE_ENV === 'development';
    },
    
    getEnv: (key, defaultValue = null) => {
        return process.env[key] || defaultValue;
    }
};