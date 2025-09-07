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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
} else {
    app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
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

// Initialize database and start server
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
        
        server.listen(PORT, HOST, () => {
            logger.info(`Server running on ${HOST}:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
            logger.info(`Application URL: http://localhost:${PORT}`);
            logger.info(`Socket.IO enabled with ${io.engine.clientsCount || 0} clients`);
            
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
                routes.forEach(route => {
                    logger.info(`  ${route.methods.padEnd(10)} ${route.path}`);
                });
            }
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, starting graceful shutdown...');
    server.close(() => logger.info('HTTP server closed'));
    io.close(() => logger.info('Socket.IO closed'));
    schedulerService.stop();
    try {
        await database.close();
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('Error closing database:', error);
    }
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, starting graceful shutdown...');
    server.close(() => logger.info('HTTP server closed'));
    io.close(() => logger.info('Socket.IO closed'));
    schedulerService.stop();
    try {
        await database.close();
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('Error closing database:', error);
    }
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    setTimeout(() => process.exit(1), 1000);
});

// Start the server
startServer();

module.exports = { app, server, io };