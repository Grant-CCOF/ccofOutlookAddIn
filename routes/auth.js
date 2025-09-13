const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const UserModel = require('../models/user');
const AuthService = require('../services/authService');
//const emailService = require('../services/emailService');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const PasswordResetService = require('../services/passwordResetService');
const RegistrationService = require('../services/registrationService');
const { passwordResetLimiter } = require('../middleware/rateLimiter');

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

router.post('/forgot-password', [
    passwordResetLimiter,
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');
        
        // Create reset request
        const result = await PasswordResetService.createResetRequest(
            email, 
            ipAddress, 
            userAgent
        );
        
        if (!result.success && result.error) {
            // Rate limit exceeded
            return res.status(429).json({ 
                error: result.error 
            });
        }
        
        // Always return same message for security
        res.json({ 
            message: 'If the email exists in our system, a password reset link has been sent.',
            // Include debug info only in development
            debug: result.debug
        });
        
    } catch (error) {
        logger.error('Password reset request error:', error);
        res.status(500).json({ 
            error: 'Failed to process password reset request' 
        });
    }
});

router.post('/verify-reset-code', [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('code')
        .notEmpty()
        .matches(/^\d{6}$/)
        .withMessage('Valid 6-digit code is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { token, code } = req.body;
        
        const result = await PasswordResetService.verifyTokenAndCode(token, code);
        
        if (!result.valid) {
            return res.status(400).json({ 
                error: result.error 
            });
        }
        
        res.json({ 
            success: true,
            tempToken: result.tempToken,
            email: result.email ? result.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null
        });
        
    } catch (error) {
        logger.error('Code verification error:', error);
        res.status(500).json({ 
            error: 'Verification failed' 
        });
    }
});

// Reset password
router.post('/reset-password', [
    body('tempToken').notEmpty().withMessage('Authorization token is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { tempToken, newPassword } = req.body;
        
        const result = await PasswordResetService.resetPassword(
            tempToken, 
            newPassword
        );
        
        if (!result.success) {
            return res.status(400).json({ 
                error: result.error 
            });
        }
        
        res.json({ 
            message: 'Password has been reset successfully. You can now login with your new password.' 
        });
        
    } catch (error) {
        logger.error('Password reset error:', error);
        res.status(500).json({ 
            error: 'Failed to reset password' 
        });
    }
});

// Request registration - sends email with verification code
router.post('/request-registration', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    handleValidationErrors
], passwordResetLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');
        
        const result = await RegistrationService.createRegistrationRequest(
            email,
            ipAddress,
            userAgent
        );
        
        res.json({
            success: result.success,
            message: result.message || result.error,
            // Include debug info only in development
            debug: result.debug
        });
        
    } catch (error) {
        logger.error('Registration request error:', error);
        res.status(500).json({ 
            error: 'Failed to process registration request' 
        });
    }
});

// Verify registration code
router.post('/verify-registration-code', [
    body('token').notEmpty().withMessage('Registration token is required'),
    body('code')
        .notEmpty()
        .matches(/^\d{6}$/)
        .withMessage('Valid 6-digit code is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { token, code } = req.body;
        
        const result = await RegistrationService.verifyTokenAndCode(token, code);
        
        if (!result.valid) {
            return res.status(400).json({ 
                error: result.error 
            });
        }
        
        res.json({ 
            success: true,
            tempToken: result.tempToken,
            email: result.email
        });
        
    } catch (error) {
        logger.error('Code verification error:', error);
        res.status(500).json({ 
            error: 'Verification failed' 
        });
    }
});

// Complete registration
router.post('/complete-registration', [
    body('tempToken').notEmpty().withMessage('Authorization token is required'),
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),
    body('name').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('company').notEmpty().withMessage('Company name is required'),
    body('phone')
        .matches(/^[\d\s\-\+\(\)]+$/)
        .withMessage('Valid phone number is required'),
    body('position').notEmpty().withMessage('Position/title is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { 
            tempToken, 
            username, 
            password, 
            name, 
            email, 
            company, 
            phone, 
            position 
        } = req.body;
        
        const result = await RegistrationService.completeRegistration(
            tempToken,
            {
                username,
                password,
                name,
                email,
                company,
                phone,
                position
            }
        );
        
        if (!result.success) {
            return res.status(400).json({ 
                error: result.error 
            });
        }
        
        res.json({ 
            message: result.message 
        });
        
    } catch (error) {
        logger.error('Registration completion error:', error);
        res.status(500).json({ 
            error: 'Failed to complete registration' 
        });
    }
});

// Validate registration token (for checking if token is still valid)
router.get('/validate-registration-token', [
    query('token').notEmpty().withMessage('Token is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { token } = req.query;
        const RegistrationTokenModel = require('../models/registrationToken');
        
        const tokenHash = require('crypto')
            .createHash('sha256')
            .update(token)
            .digest('hex');
        
        const regToken = await RegistrationTokenModel.getByTokenHash(tokenHash);
        
        if (!regToken) {
            return res.json({ 
                valid: false, 
                error: 'Invalid or expired token' 
            });
        }
        
        res.json({ 
            valid: true,
            email: regToken.email,
            verified: !!regToken.verified_at
        });
        
    } catch (error) {
        logger.error('Token validation error:', error);
        res.status(500).json({ 
            error: 'Validation failed' 
        });
    }
});

module.exports = router;