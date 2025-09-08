require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const schedulerService = require('./services/scheduler');

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with proper configuration for client serving
const io = require('socket.io')(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    path: '/socket.io/',
    serveClient: true, // IMPORTANT: This ensures Socket.IO serves its client library
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Make io accessible to routes
app.set('io', io);
global.io = io; // Also make it globally accessible for services

// Import database
const database = require('./models/database');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const bidRoutes = require('./routes/bids');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const fileRoutes = require('./routes/files');
const ratingRoutes = require('./routes/ratings');
const adminRoutes = require('./routes/admin');

// Import services
const logger = require('./utils/logger');
const fileService = require('./services/fileService');
const emailService = require('./services/microsoftEmailService');

async function sendStartupNotification() {
    try {
        // Wait a moment for the server to fully start
        setTimeout(async () => {
            if (process.env.NODE_ENV === 'production' || process.env.SEND_STARTUP_EMAIL === 'true') {
                const result = await emailService.sendAppStartupNotification();
                if (result.success) {
                    console.log('✓ Startup notification email sent to admin');
                } else {
                    console.log('⚠️  Failed to send startup notification email');
                }
            }
        }, 3000); // Wait 3 seconds after startup
    } catch (error) {
        console.error('Error sending startup notification:', error);
    }
}

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
            workerSrc: ["'self'", "blob:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"]
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// IMPORTANT: Enable trust proxy for accurate IP detection behind nginx/proxies
app.set('trust proxy', true);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
} else {
    app.use(morgan('dev'));
}

// Custom key generator for better IP extraction
const getClientIp = (req) => {
    // Priority order for IP extraction
    return req.headers['x-real-ip'] ||              // nginx real IP
           req.headers['x-forwarded-for']?.split(',')[0] || // proxy forwarded IP
           req.connection.remoteAddress ||          // direct connection
           req.socket.remoteAddress ||              // socket connection
           req.ip;                                   // Express default
};

// Check if request is from localhost/server itself
const isLocalRequest = (req) => {
    const ip = getClientIp(req);
    const localIPs = [
        '127.0.0.1',
        '::1',
        '::ffff:127.0.0.1',
        'localhost',
        process.env.SERVER_IP, // Add your server's public IP if needed
    ];
    return localIPs.includes(ip);
};

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,  // Disable `X-RateLimit-*` headers
    
    // Custom key generator for consistent IP tracking
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    
    // Skip rate limiting for certain conditions
    skip: (req) => {
        // Skip for local/server requests
        if (isLocalRequest(req)) {
            logger.debug(`Skipping rate limit for local request from ${getClientIp(req)}`);
            return true;
        }
        
        // Skip for whitelisted IPs
        const whitelist = process.env.RATE_LIMIT_WHITELIST?.split(',') || [];
        if (whitelist.includes(getClientIp(req))) {
            logger.debug(`Skipping rate limit for whitelisted IP: ${getClientIp(req)}`);
            return true;
        }
        
        // Skip for internal service-to-service calls (if using special header)
        if (req.headers['x-internal-service'] === process.env.INTERNAL_SERVICE_KEY) {
            return true;
        }
        
        return false;
    },
    
    // Enhanced error handler with logging
    handler: (req, res) => {
        const ip = getClientIp(req);
        logger.warn(`Rate limit exceeded for IP: ${ip}, Path: ${req.path}, User: ${req.user?.id || 'anonymous'}`);
        
        res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            ip: process.env.NODE_ENV === 'development' ? ip : undefined, // Show IP in dev mode
            retryAfter: res.getHeader('Retry-After')
        });
    }
});

app.use('/api', limiter);

// Serve static files from public directory
const publicDir = process.env.PUBLIC_DIR || 'public';
app.use(express.static(path.join(__dirname, publicDir), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        } else if (filepath.endsWith('.js') || filepath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        }
    }
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '30d',
    etag: true,
    lastModified: true
}));

// Explicitly serve Socket.IO client file as a fallback
app.get('/socket.io/socket.io.js', (req, res) => {
    const clientPath = path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js');
    res.sendFile(clientPath, (err) => {
        if (err) {
            logger.error('Error serving Socket.IO client:', err);
            res.status(404).send('Socket.IO client not found');
        }
    });
});

app.get('/socket.io/socket.io.js.map', (req, res) => {
    const mapPath = path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js.map');
    res.sendFile(mapPath, (err) => {
        if (err) {
            res.status(404).send('Map file not found');
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        socketio: io.engine.clientsCount || 0
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin', adminRoutes);

// Catch all route - serve index.html for client-side routing
app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, publicDir, 'index.html'));
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info(`New socket connection: ${socket.id} from ${socket.handshake.address}`);
    
    socket.on('join_user_room', (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            logger.info(`Socket ${socket.id} joined room: user_${userId}`);
            socket.emit('room_joined', { room: `user_${userId}` });
        }
    });
    
    socket.on('join_project_room', (projectId) => {
        if (projectId) {
            socket.join(`project_${projectId}`);
            logger.info(`Socket ${socket.id} joined room: project_${projectId}`);
            socket.to(`project_${projectId}`).emit('user_joined_project', {
                socketId: socket.id,
                projectId: projectId
            });
        }
    });
    
    socket.on('leave_project_room', (projectId) => {
        if (projectId) {
            socket.leave(`project_${projectId}`);
            logger.info(`Socket ${socket.id} left room: project_${projectId}`);
            socket.to(`project_${projectId}`).emit('user_left_project', {
                socketId: socket.id,
                projectId: projectId
            });
        }
    });
    
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
    
    socket.on('disconnect', (reason) => {
        logger.info(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    });
    
    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
    });
});

// Track active connections for graceful shutdown
const connections = new Set();

// Modified startServer function with retry logic
async function startServer() {
    try {
        await fileService.ensureUploadDirectories();
        await database.initialize();
        logger.info('Database initialized successfully');

        // Initialize the scheduler service
        await schedulerService.initialize();
        logger.info('Scheduler service started');
        
        const PORT = process.env.PORT || 3000;
        const HOST = '0.0.0.0';
        
        // Attempt to bind to port with retries
        const success = await bindToPort(PORT, HOST);
        
        if (!success) {
            logger.error(`Failed to bind to port ${PORT} after multiple attempts`);
            process.exit(1);
        }
        
        // Track connections for graceful shutdown
        server.on('connection', (connection) => {
            connections.add(connection);
            connection.on('close', () => {
                connections.delete(connection);
            });
        });
        
        logger.info(`Server running on ${HOST}:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
        logger.info(`Application URL: http://localhost:${PORT}`);
        logger.info(`Socket.IO enabled with ${io.engine.clientsCount || 0} clients`);
        
        // Log registered endpoints in development
        if (process.env.NODE_ENV !== 'production') {
            logger.info('Registered API endpoints:');
            const routes = [];
            app._router.stack.forEach((middleware) => {
                if (middleware.route) {
                    routes.push({
                        path: middleware.route.path,
                        methods: Object.keys(middleware.route.methods).join(', ').toUpperCase()
                    });
                } else if (middleware.name === 'router' && middleware.regexp) {
                    middleware.handle.stack.forEach((handler) => {
                        if (handler.route) {
                            const route = handler.route;
                            const prefix = middleware.regexp.source.replace(/\\/g, '').replace(/\^|\$/g, '').replace(/\(\?\:\/\)/g, '/').replace(/\(\?\=\/\|\$\)/g, '');
                            routes.push({
                                path: prefix + route.path,
                                methods: Object.keys(route.methods).join(', ').toUpperCase()
                            });
                        }
                    });
                }
            });
            
            routes.sort((a, b) => a.path.localeCompare(b.path));
            routes.forEach(route => {
                logger.info(`  ${route.methods.padEnd(8)} ${route.path}`);
            });
        }
        
        // Send startup notification
        await sendStartupNotification();
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${process.env.PORT || 3000} is already in use`);
        // Don't exit immediately on EADDRINUSE during startup
        if (!server.listening) {
            setTimeout(() => process.exit(1), 1000);
        }
    } else {
        gracefulShutdown('uncaughtException');
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejections, just log them
});

// Graceful shutdown handler
async function gracefulShutdown(signal) {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
        logger.info('HTTP server closed');
    });
    
    // Close Socket.IO connections
    if (io) {
        io.close(() => {
            logger.info('Socket.IO server closed');
        });
    }
    
    // Close all active connections
    for (const connection of connections) {
        connection.end();
    }
    
    // Force close after timeout
    setTimeout(() => {
        for (const connection of connections) {
            connection.destroy();
        }
    }, 5000);
    
    // Close database connections
    try {
        await database.close();
        logger.info('Database connections closed');
    } catch (error) {
        logger.error('Error closing database:', error);
    }
    
    // Stop scheduler service
    try {
        if (schedulerService && schedulerService.stop) {
            await schedulerService.stop();
            logger.info('Scheduler service stopped');
        }
    } catch (error) {
        logger.error('Error stopping scheduler:', error);
    }
    
    // Exit process
    setTimeout(() => {
        logger.info('Graceful shutdown complete');
        process.exit(0);
    }, 1000);
}

// Function to attempt binding to port with retries
async function bindToPort(port, host, maxRetries = 5, retryDelay = 2000) {
    let attempts = 0;
    
    while (attempts < maxRetries) {
        try {
            await new Promise((resolve, reject) => {
                const errorHandler = (err) => {
                    if (err.code === 'EADDRINUSE') {
                        server.removeListener('error', errorHandler);
                        reject(err);
                    } else {
                        reject(err);
                    }
                };
                
                server.once('error', errorHandler);
                
                server.listen(port, host, () => {
                    server.removeListener('error', errorHandler);
                    resolve();
                });
            });
            
            return true; // Successfully bound to port
            
        } catch (error) {
            attempts++;
            
            if (error.code === 'EADDRINUSE') {
                if (attempts < maxRetries) {
                    logger.warn(`Port ${port} is in use, attempt ${attempts}/${maxRetries}. Retrying in ${retryDelay/1000} seconds...`);
                    
                    // Try to kill any orphaned process on this port (Linux/Unix only)
                    if (process.platform !== 'win32') {
                        try {
                            const { exec } = require('child_process');
                            await new Promise((resolve) => {
                                exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
                                    // Ignore errors as the command might fail if no process is found
                                    resolve();
                                });
                            });
                        } catch (e) {
                            // Ignore errors from kill command
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }
    
    return false;
}

// Start the server
startServer();

module.exports = { app, server, io };