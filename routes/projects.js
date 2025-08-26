const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const ProjectModel = require('../models/project');
const BidModel = require('../models/bid');
const FileModel = require('../models/file');
const UserModel = require('../models/user');
const NotificationService = require('../services/notificationService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, manager_id, limit, offset } = req.query;
        
        let projects;
        
        if (req.user.role === 'project_manager') {
            // Project managers only see their own projects
            projects = await ProjectModel.getByManager(req.user.id);
        } else if (manager_id && req.user.role === 'admin') {
            // Admin can filter by manager
            projects = await ProjectModel.getByManager(manager_id);
        } else if (status) {
            projects = await ProjectModel.getByStatus(status);
        } else {
            projects = await ProjectModel.getAll();
        }
        
        res.json(projects);
    } catch (error) {
        logger.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get single project
router.get('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Get project manager details
        if (project.project_manager_id) {
            const manager = await UserModel.getById(project.project_manager_id);
            project.project_manager_name = manager ? manager.name : 'Unknown';
        }
        
        // SECURITY: Control bid count visibility
        if (req.user.role === 'installation_company') {
            // For installation companies, only show if they have bid
            const userBid = await BidModel.getUserBidForProject(req.user.id, project.id);
            project.has_bid = !!userBid;
            project.user_bid_status = userBid ? userBid.status : null;
            
            // Don't reveal total bid count or other bid details
            delete project.bid_count;
            delete project.lowest_bid;
            delete project.highest_bid;
            delete project.average_bid;
        } else if (req.user.role === 'project_manager' || req.user.role === 'admin') {
            // Project managers and admins can see bid statistics
            const bidStats = await BidModel.getProjectBidStats(project.id);
            project.bid_count = bidStats.count;
            project.lowest_bid = bidStats.min_amount;
            project.highest_bid = bidStats.max_amount;
            project.average_bid = bidStats.avg_amount;
        }
        
        logger.info(`Project details retrieved: ${project.id} by ${req.user.username}`);
        
        res.json(project);
    } catch (error) {
        logger.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Create project
router.post('/', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional(),
    body('zip_code').matches(/^\d{5}(-\d{4})?$/).withMessage('Valid ZIP code required'),
    body('delivery_date').isISO8601().withMessage('Valid delivery date required'),
    body('bid_due_date').isISO8601().withMessage('Valid bid due date required'),
    body('max_bid').optional().isFloat({ min: 0 }).withMessage('Max bid must be positive'),
    body('show_max_bid').optional().isBoolean(),
    body('site_conditions').optional().isArray(),
    handleValidationErrors
], async (req, res) => {
    try {
        const projectData = {
            ...req.body,
            project_manager_id: req.user.id,
            status: 'draft'
        };
        
        // Validate dates
        if (new Date(projectData.bid_due_date) > new Date(projectData.delivery_date)) {
            return res.status(400).json({ error: 'Bid due date must be before delivery date' });
        }
        
        const projectId = await ProjectModel.create(projectData);
        const project = await ProjectModel.getById(projectId);
        
        logger.info(`Project created: ${project.title} by ${req.user.username}`);
        
        res.status(201).json(project);
    } catch (error) {
        logger.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// Update project
router.put('/:id', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check ownership
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Don't allow certain changes after bidding starts
        if (project.status !== 'draft' && (req.body.max_bid || req.body.bid_due_date)) {
            return res.status(400).json({ error: 'Cannot modify bid parameters after bidding starts' });
        }
        
        await ProjectModel.update(req.params.id, req.body);
        const updatedProject = await ProjectModel.getById(req.params.id);
        
        // Notify if status changed
        if (req.body.status && req.body.status !== project.status) {
            await NotificationService.notifyProjectUpdate(
                project.id,
                'Project Status Update',
                `Project status changed to ${req.body.status}`
            );
        }
        
        logger.info(`Project updated: ${project.id} by ${req.user.username}`);
        
        res.json(updatedProject);
    } catch (error) {
        logger.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// Delete project
router.delete('/:id', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check ownership
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Don't allow deletion if project is awarded or completed
        if (['awarded', 'completed'].includes(project.status)) {
            return res.status(400).json({ error: 'Cannot delete awarded or completed projects' });
        }
        
        await ProjectModel.delete(req.params.id);
        
        logger.info(`Project deleted: ${project.id} by ${req.user.username}`);
        
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        logger.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// Start bidding
router.post('/:id/start-bidding', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check ownership
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (project.status !== 'draft') {
            return res.status(400).json({ error: 'Project must be in draft status to start bidding' });
        }
        
        await ProjectModel.updateStatus(req.params.id, 'bidding');
        
        // Notify installation companies
        await NotificationService.broadcastToRole(
            'installation_company',
            'New Project Available',
            `New project "${project.title}" is now open for bidding`,
            { projectId: project.id }
        );
        
        logger.info(`Bidding started for project: ${project.id}`);
        
        res.json({ message: 'Bidding started successfully' });
    } catch (error) {
        logger.error('Error starting bidding:', error);
        res.status(500).json({ error: 'Failed to start bidding' });
    }
});

// Award project
router.post('/:id/award', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('id').isInt().withMessage('Valid project ID required'),
    body('bidId').isInt().withMessage('Valid bid ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check ownership
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (project.status !== 'reviewing') {
            return res.status(400).json({ error: 'Project must be in reviewing status to award' });
        }
        
        const bid = await BidModel.getById(req.body.bidId);
        
        if (!bid || bid.project_id !== project.id) {
            return res.status(404).json({ error: 'Bid not found for this project' });
        }
        
        // Award project
        await ProjectModel.awardProject(project.id, bid.id, bid.amount);
        await BidModel.updateProjectBidsStatus(project.id, bid.id);
        
        // Notify winner and losers
        await NotificationService.notifyBidStatusChange(bid, project, 'won');
        
        const otherBids = await BidModel.getProjectBids(project.id);
        for (const otherBid of otherBids) {
            if (otherBid.id !== bid.id) {
                await NotificationService.notifyBidStatusChange(otherBid, project, 'lost');
            }
        }
        
        logger.info(`Project awarded: ${project.id} to bid ${bid.id}`);
        
        res.json({ message: 'Project awarded successfully' });
    } catch (error) {
        logger.error('Error awarding project:', error);
        res.status(500).json({ error: 'Failed to award project' });
    }
});

// Mark project as completed with optional review
router.post('/:id/complete', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('id').isInt().withMessage('Valid project ID required'),
    body('rating').optional().isObject(),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check ownership
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (project.status !== 'awarded') {
            return res.status(400).json({ error: 'Only awarded projects can be marked as completed' });
        }
        
        // Mark project as completed
        await ProjectModel.markCompleted(req.params.id);
        
        // If rating was provided, submit it
        if (req.body.rating && project.awarded_to) {
            const RatingModel = require('../models/rating');
            
            // Check if rating already exists
            const existingRating = await RatingModel.getByProjectAndRater(req.params.id, req.user.id);
            
            if (!existingRating) {
                await RatingModel.create({
                    project_id: req.params.id,
                    rated_user_id: project.awarded_to,
                    rated_by_user_id: req.user.id,
                    price: req.body.rating.price || 5,
                    speed: req.body.rating.speed || 5,
                    quality: req.body.rating.quality || 5,
                    responsiveness: req.body.rating.responsiveness || 5,
                    customer_satisfaction: req.body.rating.customer_satisfaction || 5,
                    comments: req.body.rating.comments || ''
                });
            }
        }
        
        logger.info(`Project completed: ${project.id}`);
        
        res.json({ message: 'Project marked as completed' });
    } catch (error) {
        logger.error('Error completing project:', error);
        res.status(500).json({ error: 'Failed to complete project' });
    }
});

// Admin-only: Close bidding
router.post('/:id/close-bidding', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (project.status !== 'bidding') {
            return res.status(400).json({ error: 'Project is not open for bidding' });
        }
        
        await ProjectModel.updateStatus(req.params.id, 'reviewing');
        
        logger.info(`Bidding closed for project: ${project.id}`);
        res.json({ message: 'Bidding closed successfully' });
    } catch (error) {
        logger.error('Error closing bidding:', error);
        res.status(500).json({ error: 'Failed to close bidding' });
    }
});

// Admin-only: Force complete
router.post('/:id/admin-complete', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        await ProjectModel.updateStatus(req.params.id, 'completed');
        logger.info(`Project force completed by admin: ${req.params.id}`);
        res.json({ message: 'Project completed' });
    } catch (error) {
        logger.error('Error completing project:', error);
        res.status(500).json({ error: 'Failed to complete project' });
    }
});

// Admin-only: Reset to draft
router.post('/:id/admin-reset', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        await ProjectModel.updateStatus(req.params.id, 'draft');
        logger.info(`Project reset to draft by admin: ${req.params.id}`);
        res.json({ message: 'Project reset to draft' });
    } catch (error) {
        logger.error('Error resetting project:', error);
        res.status(500).json({ error: 'Failed to reset project' });
    }
});



module.exports = router;