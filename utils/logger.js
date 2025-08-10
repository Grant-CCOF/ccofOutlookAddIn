const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Simple logger implementation
class Logger {
    constructor() {
        this.logFile = path.join(logsDir, 'app.log');
        this.errorFile = path.join(logsDir, 'error.log');
        this.accessFile = path.join(logsDir, 'access.log');
        
        // Rotate logs if they get too large (10MB)
        this.maxLogSize = 10 * 1024 * 1024;
        this.checkLogRotation();
    }
    
    checkLogRotation() {
        const files = [this.logFile, this.errorFile, this.accessFile];
        
        files.forEach(file => {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                if (stats.size > this.maxLogSize) {
                    const timestamp = new Date().toISOString().replace(/:/g, '-');
                    const rotatedFile = file.replace('.log', `-${timestamp}.log`);
                    fs.renameSync(file, rotatedFile);
                }
            }
        });
    }
    
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (data) {
            if (typeof data === 'object') {
                logMessage += ` ${JSON.stringify(data)}`;
            } else {
                logMessage += ` ${data}`;
            }
        }
        
        return logMessage;
    }
    
    writeToFile(file, message) {
        fs.appendFile(file, message + '\n', (err) => {
            if (err) console.error('Failed to write to log file:', err);
        });
    }
    
    log(level, message, data = null) {
        const formattedMessage = this.formatMessage(level, message, data);
        
        // Console output with colors
        const colors = {
            ERROR: '\x1b[31m',
            WARN: '\x1b[33m',
            INFO: '\x1b[36m',
            DEBUG: '\x1b[35m',
            SUCCESS: '\x1b[32m'
        };
        
        const color = colors[level] || '\x1b[37m';
        const reset = '\x1b[0m';
        
        console.log(`${color}${formattedMessage}${reset}`);
        
        // File output
        if (level === 'ERROR') {
            this.writeToFile(this.errorFile, formattedMessage);
        }
        this.writeToFile(this.logFile, formattedMessage);
    }
    
    info(message, data = null) {
        this.log('INFO', message, data);
    }
    
    error(message, data = null) {
        this.log('ERROR', message, data);
        
        // Stack trace for errors
        if (data instanceof Error) {
            this.log('ERROR', 'Stack trace:', data.stack);
        }
    }
    
    warn(message, data = null) {
        this.log('WARN', message, data);
    }
    
    debug(message, data = null) {
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
            this.log('DEBUG', message, data);
        }
    }
    
    success(message, data = null) {
        this.log('SUCCESS', message, data);
    }
    
    access(req) {
        const message = `${req.method} ${req.url} - ${req.ip} - ${req.get('user-agent')}`;
        this.writeToFile(this.accessFile, this.formatMessage('ACCESS', message));
    }
    
    // Get recent logs
    async getRecentLogs(type = 'all', lines = 100) {
        return new Promise((resolve, reject) => {
            let file;
            switch (type) {
                case 'error':
                    file = this.errorFile;
                    break;
                case 'access':
                    file = this.accessFile;
                    break;
                default:
                    file = this.logFile;
            }
            
            if (!fs.existsSync(file)) {
                resolve([]);
                return;
            }
            
            fs.readFile(file, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const allLines = data.split('\n').filter(line => line.trim());
                const recentLines = allLines.slice(-lines);
                resolve(recentLines);
            });
        });
    }
    
    // Clear logs
    clearLogs(type = 'all') {
        const files = type === 'all' 
            ? [this.logFile, this.errorFile, this.accessFile]
            : [type === 'error' ? this.errorFile : type === 'access' ? this.accessFile : this.logFile];
        
        files.forEach(file => {
            if (fs.existsSync(file)) {
                fs.truncateSync(file, 0);
            }
        });
        
        this.info(`Logs cleared: ${type}`);
    }
}

module.exports = new Logger();