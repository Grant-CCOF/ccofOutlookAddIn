const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const UserModel = require('../models/user');
const ProjectModel = require('../models/project');
const BidModel = require('../models/bid');
const RatingModel = require('../models/rating');
const AuthService = require('../services/authService');
const emailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const RegistrationService = require('../services/registrationService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get all users (admin only)
router.get('/', [
    authenticateToken,
    requireRole('admin')
], async (req, res) => {
    try {
        const users = await UserModel.getAllWithStats();
        
        // Remove passwords from response
        const sanitizedUsers = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });
        
        res.json(sanitizedUsers);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user (admin only)
router.post('/create', [
    authenticateToken,
    requireRole('admin'),
    body('username').isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('role').isIn(['admin', 'project_manager', 'installation_company', 'operations'])
        .withMessage('Valid role is required'),
    body('company').optional(),
    body('phone').optional(),
    body('position').optional(),
    body('approved').optional().isBoolean(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { 
            username, 
            password, 
            name, 
            email, 
            role, 
            company, 
            phone, 
            position,
            approved 
        } = req.body;
        
        // Check if username already exists
        const existingUser = await UserModel.getByUsername(username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        // Check if email already exists
        const existingEmail = await UserModel.getByEmail(email);
        if (existingEmail) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        
        // Hash password
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user with admin-specified approval status
        const userId = await UserModel.create({
            username,
            password: hashedPassword,
            name,
            email,
            role,
            company: company || null,
            phone: phone || null,
            position: position || null,
            approved: approved ? 1 : 0,  // Admin can set immediate approval
            suspended: 0
        });
        
        // Get created user (without password)
        const user = await UserModel.getById(userId);
        const { password: _, ...userWithoutPassword } = user;
        
        // Send welcome email if approved
        if (approved) {
            try {
                //await emailService.sendWelcomeEmail(user);
            } catch (emailError) {
                logger.warn(`Failed to send welcome email to ${email}:`, emailError);
                // Don't fail the user creation if email fails
            }
        }
        
        logger.info(`User created by admin ${req.user.username}: ${username} (${email})`);
        
        res.status(201).json({
            message: 'User created successfully',
            user: userWithoutPassword
        });
        
    } catch (error) {
        logger.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get single user
router.get('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        // Users can view their own profile, admins can view any
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const user = await UserModel.getByIdWithStats(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        
        res.json(userWithoutPassword);
    } catch (error) {
        logger.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user
router.put('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid user ID required'),
    body('name').optional().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional(),
    body('company').optional(),
    body('position').optional(),
    handleValidationErrors
], async (req, res) => {
    try {
        // Users can update their own profile, admins can update any
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const user = await UserModel.getById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if email is being changed and is unique
        if (req.body.email && req.body.email !== user.email) {
            const existingEmail = await UserModel.getByEmail(req.body.email);
            if (existingEmail) {
                return res.status(409).json({ error: 'Email already in use' });
            }
        }
        
        // Don't allow non-admins to change certain fields
        if (req.user.role !== 'admin') {
            delete req.body.role;
            delete req.body.approved;
            delete req.body.suspended;
        }
        
        await UserModel.update(req.params.id, req.body);
        const updatedUser = await UserModel.getById(req.params.id);
        
        logger.info(`User updated: ${req.params.id} by ${req.user.username}`);
        
        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;
        
        res.json(userWithoutPassword);
    } catch (error) {
        logger.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Approve user
router.put('/:id/approve', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Get user details before approval
        const user = await UserModel.getById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.approved) {
            return res.status(400).json({ error: 'User is already approved' });
        }
        
        // Approve the user
        await UserModel.update(userId, { approved: 1 });
        
        // Send approval email if it's an installation company
        if (user.role === 'installation_company' && user.email) {
            try {
                await RegistrationService.sendApprovalEmail(user);
                logger.info(`Approval email sent to ${user.email}`);
            } catch (emailError) {
                logger.error('Failed to send approval email:', emailError);
                // Don't fail the approval if email fails
            }
        }
        
        /* Create notification
        await NotificationService.create({
            user_id: userId,
            title: 'Account Approved',
            content: 'Your account has been approved. You can now access all features.',
            type: 'account_approved',
            data: JSON.stringify({ 
                approved_by: req.user.id,
                approved_at: new Date().toISOString() 
            })
        }); */
        
        logger.info(`User ${userId} approved by admin ${req.user.id}`);
        
        res.json({ 
            message: 'User approved successfully',
            emailSent: user.role === 'installation_company' 
        });
    } catch (error) {
        logger.error('Error approving user:', error);
        res.status(500).json({ error: 'Failed to approve user' });
    }
});

// Suspend user (admin only)
router.post('/:id/suspend', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid user ID required'),
    body('reason').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        const user = await UserModel.getById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot suspend yourself' });
        }
        
        if (user.suspended) {
            return res.status(400).json({ error: 'User is already suspended' });
        }
        
        await UserModel.update(req.params.id, { suspended: 1 });
        
        logger.info(`User suspended: ${user.username} by admin ${req.user.username}. Reason: ${req.body.reason || 'Not specified'}`);
        
        res.json({ message: 'User suspended successfully' });
    } catch (error) {
        logger.error('Error suspending user:', error);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// Unsuspend user (admin only)
router.post('/:id/unsuspend', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const user = await UserModel.getById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.suspended) {
            return res.status(400).json({ error: 'User is not suspended' });
        }
        
        await UserModel.update(req.params.id, { suspended: 0 });
        
        logger.info(`User unsuspended: ${user.username} by admin ${req.user.username}`);
        
        res.json({ message: 'User unsuspended successfully' });
    } catch (error) {
        logger.error('Error unsuspending user:', error);
        res.status(500).json({ error: 'Failed to unsuspend user' });
    }
});

// Delete user (admin only)
router.delete('/:id', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const user = await UserModel.getById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        if (user.role === 'admin') {
            // Check if this is the last admin
            const adminCount = await UserModel.getCountByRole('admin');
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last admin user' });
            }
        }
        
        await UserModel.delete(req.params.id);
        
        logger.info(`User deleted: ${user.username} by admin ${req.user.username}`);
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Change user role (admin only)
router.post('/:id/change-role', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid user ID required'),
    body('role').isIn(['admin', 'project_manager', 'installation_company', 'operations'])
        .withMessage('Valid role required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const user = await UserModel.getById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot change your own role' });
        }
        
        if (user.role === 'admin' && req.body.role !== 'admin') {
            // Check if this is the last admin
            const adminCount = await UserModel.getCountByRole('admin');
            if (adminCount <= 1) {
                return res.status(400).json({ error: 'Cannot remove admin role from the last admin user' });
            }
        }
        
        await UserModel.update(req.params.id, { role: req.body.role });
        
        logger.info(`User role changed: ${user.username} from ${user.role} to ${req.body.role} by admin ${req.user.username}`);
        
        res.json({ message: 'User role changed successfully' });
    } catch (error) {
        logger.error('Error changing user role:', error);
        res.status(500).json({ error: 'Failed to change user role' });
    }
});

// Get user statistics
router.get('/:id/stats', [
    authenticateToken,
    param('id').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const requestingUser = req.user;
        
        // Check if user can view the stats
        const isOwnProfile = requestingUser.id === targetUserId;
        const isAdmin = requestingUser.role === 'admin';
        const isProjectManager = requestingUser.role === 'project_manager';
        
        // Basic access check - users can view their own stats, admins can view any
        if (!isOwnProfile && !isAdmin && !isProjectManager) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const user = await UserModel.getById(targetUserId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const stats = {
            user_id: user.id,
            username: user.username,
            role: user.role,
            member_since: user.created_at
        };
        
        // Add role-specific stats
        if (user.role === 'project_manager') {
            stats.projects_count = await ProjectModel.getCountByManager(user.id);
            stats.active_projects = await ProjectModel.getCountByManagerAndStatus(user.id, 'bidding');
            stats.completed_projects = await ProjectModel.getCountByManagerAndStatus(user.id, 'completed');
        } else if (user.role === 'installation_company' || user.role === 'operations') {
            stats.bids_count = await BidModel.getCountByUser(user.id);
            stats.won_bids = await BidModel.getCountByUserAndStatus(user.id, 'won');
            stats.win_rate = await BidModel.getWinRate(user.id);
            
            // RATING ACCESS CONTROL
            // Only include ratings if the requesting user is admin or project manager
            if (isAdmin || isProjectManager) {
                stats.average_rating = await UserModel.getAverageRating(user.id);
                stats.rating_count = await UserModel.getRatingCount(user.id);
                
                // Include detailed rating breakdown if available
                const ratingDetails = await RatingModel.getAverageRatings(user.id);
                if (ratingDetails && ratingDetails.count > 0) {
                    stats.rating_breakdown = {
                        price: ratingDetails.avg_price,
                        speed: ratingDetails.avg_speed,
                        quality: ratingDetails.avg_quality,
                        responsiveness: ratingDetails.avg_responsiveness,
                        customer_satisfaction: ratingDetails.avg_customer_satisfaction
                    };
                }
            } else {
                // For installers viewing their own profile, explicitly exclude ratings
                stats.average_rating = null;
                stats.rating_count = null;
                stats.rating_breakdown = null;
            }
        }
        
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
});

// Additional endpoint to check if user can view ratings
router.get('/:id/can-view-ratings', authenticateToken, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id);
        const requestingUser = req.user;
        
        // Check if the requesting user can view ratings
        const canViewRatings = requestingUser.role === 'admin' || requestingUser.role === 'project_manager';
        
        // Check if the target user can have ratings (is an installer)
        const targetUser = await UserModel.getById(targetUserId);
        const canHaveRatings = targetUser && (targetUser.role === 'installation_company' || targetUser.role === 'operations');
        
        res.json({ 
            canViewRatings: canViewRatings && canHaveRatings,
            reason: !canViewRatings ? 'insufficient_permissions' : !canHaveRatings ? 'user_not_ratable' : 'allowed'
        });
    } catch (error) {
        logger.error('Error checking rating permissions:', error);
        res.status(500).json({ error: 'Failed to check permissions' });
    }
});

module.exports = router;