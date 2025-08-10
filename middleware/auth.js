const jwt = require('jsonwebtoken');
const UserModel = require('../models/user');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', async (err, decoded) => {
            if (err) {
                logger.error('Token verification failed:', err);
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
            
            // Get fresh user data from database
            const user = await UserModel.getById(decoded.id);
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            if (user.suspended) {
                return res.status(403).json({ error: 'Account suspended' });
            }
            
            if (!user.approved) {
                return res.status(403).json({ error: 'Account pending approval' });
            }
            
            req.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                name: user.name,
                company: user.company
            };
            
            next();
        });
    } catch (error) {
        logger.error('Authentication error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(userRole)) {
            logger.warn(`Access denied for user ${req.user.id} with role ${userRole}. Required roles: ${allowedRoles.join(', ')}`);
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', async (err, decoded) => {
            if (err) {
                req.user = null;
            } else {
                const user = await UserModel.getById(decoded.id);
                req.user = user ? {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    name: user.name,
                    company: user.company
                } : null;
            }
            next();
        });
    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth
};