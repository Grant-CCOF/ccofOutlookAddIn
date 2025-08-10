const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const UserModel = require('../models/user');
const logger = require('../utils/logger');

class AuthService {
    static generateToken(user) {
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email
        };
        
        return jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
    }
    
    static generateRefreshToken(user) {
        const payload = {
            id: user.id,
            type: 'refresh'
        };
        
        return jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );
    }
    
    static verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (error) {
            logger.error('Token verification failed:', error);
            return null;
        }
    }
    
    static async validateCredentials(username, password) {
        try {
            const user = await UserModel.getByUsername(username);
            
            if (!user) {
                return { valid: false, message: 'User not found' };
            }
            
            const isValidPassword = await bcrypt.compare(password, user.password);
            
            if (!isValidPassword) {
                return { valid: false, message: 'Invalid password' };
            }
            
            if (user.suspended) {
                return { valid: false, message: 'Account suspended' };
            }
            
            if (!user.approved) {
                return { valid: false, message: 'Account pending approval' };
            }
            
            return { valid: true, user };
        } catch (error) {
            logger.error('Credential validation error:', error);
            return { valid: false, message: 'Authentication failed' };
        }
    }
    
    static async hashPassword(password) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
        return bcrypt.hash(password, rounds);
    }
    
    static async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    
    static generateResetToken() {
        return jwt.sign(
            { type: 'password_reset', random: Math.random() },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );
    }
    
    static validatePasswordStrength(password) {
        const errors = [];
        
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = AuthService;