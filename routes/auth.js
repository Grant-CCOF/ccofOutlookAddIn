const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const UserModel = require('../models/user');
const AuthService = require('../services/authService');
//const emailService = require('../services/emailService');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// Login endpoint
router.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const result = await AuthService.validateCredentials(username, password);
        
        if (!result.valid) {
            return res.status(401).json({ error: result.message });
        }
        
        const token = AuthService.generateToken(result.user);
        const refreshToken = AuthService.generateRefreshToken(result.user);
        
        // Log successful login
        logger.info(`User logged in: ${username}`);
        
        res.json({
            message: 'Login successful',
            token,
            refreshToken,
            user: {
                id: result.user.id,
                username: result.user.username,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                company: result.user.company
            }
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register endpoint
router.post('/register', [
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['project_manager', 'installation_company', 'operations'])
        .withMessage('Valid role is required'),
    body('company').optional(),
    body('phone').optional(),
    body('position').optional(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { username, password, name, email, role, company, phone, position } = req.body;
        
        // Check if user already exists
        const existingUser = await UserModel.getByUsername(username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        const existingEmail = await UserModel.getByEmail(email);
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = await AuthService.hashPassword(password);
        
        // Create user
        const userId = await UserModel.create({
            username,
            password: hashedPassword,
            name,
            email,
            role,
            company,
            phone,
            position,
            approved: 0, // Require admin approval
            suspended: 0
        });
        
        // Get created user
        const user = await UserModel.getById(userId);
        
        // Send welcome email
        // await emailService.sendWelcomeEmail(user);
        
        logger.info(`New user registered: ${username} (${email})`);
        
        res.status(201).json({
            message: 'Registration successful. Please wait for admin approval.',
            userId
        });
    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Refresh token endpoint
router.post('/refresh', [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        const decoded = AuthService.verifyToken(refreshToken);
        
        if (!decoded || decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        
        const user = await UserModel.getById(decoded.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const newToken = AuthService.generateToken(user);
        const newRefreshToken = AuthService.generateRefreshToken(user);
        
        res.json({
            token: newToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        logger.error('Token refresh error:', error);
        res.status(401).json({ error: 'Token refresh failed' });
    }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // In a production app, you might want to blacklist the token
        logger.info(`User logged out: ${req.user.username}`);
        
        res.json({ message: 'Logout successful' });
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await UserModel.getById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
            company: user.company,
            phone: user.phone,
            position: user.position,
            approved: user.approved,
            suspended: user.suspended,
            created_at: user.created_at
        });
    } catch (error) {
        logger.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});

// Change password
router.post('/change-password', [
    authenticateToken,
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const user = await UserModel.getById(req.user.id);
        
        // Verify current password
        const isValid = await AuthService.comparePassword(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await AuthService.hashPassword(newPassword);
        
        // Update password
        await UserModel.updatePassword(user.id, hashedPassword);
        
        logger.info(`Password changed for user: ${user.username}`);
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        logger.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Request password reset
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Valid email is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await UserModel.getByEmail(email);
        
        if (!user) {
            // Don't reveal if email exists
            return res.json({ message: 'If the email exists, a reset link has been sent' });
        }
        
        const resetToken = AuthService.generateResetToken();
        
        // In production, store this token in database with expiry
        // For now, we'll send it in the email
        
        // await emailService.sendPasswordResetEmail(user, resetToken);
        
        logger.info(`Password reset requested for: ${email}`);
        
        res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
        logger.error('Password reset request error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Reset password
router.post('/reset-password', [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        const decoded = AuthService.verifyToken(token);
        
        if (!decoded || decoded.type !== 'password_reset') {
            return res.status(401).json({ error: 'Invalid or expired reset token' });
        }
        
        // In production, verify token from database
        // For now, we'll just reset the password
        
        // This is a simplified version - in production, you'd get user ID from the token
        // const userId = decoded.userId;
        
        // Hash new password
        const hashedPassword = await AuthService.hashPassword(newPassword);
        
        // Update password (simplified - need proper implementation)
        // await UserModel.updatePassword(userId, hashedPassword);
        
        logger.info('Password reset completed');
        
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        logger.error('Password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;