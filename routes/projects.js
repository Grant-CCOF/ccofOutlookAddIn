const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const ProjectModel = require('../models/project');
const BidModel = require('../models/bid');
const FileModel = require('../models/file');
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
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check access rights
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get bids if user has access
        if (req.user.role === 'admin' || project.project_manager_id === req.user.id) {
            project.bids = await BidModel.getProjectBids(project.id);
        }
        
        // Get files
        project.files = await FileModel.getByProject(project.id);
        
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

// Mark project as completed
router.post('/:id/complete', [
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
        
        if (project.status !== 'awarded') {
            return res.status(400).json({ error: 'Only awarded projects can be marked as completed' });
        }
        
        await ProjectModel.markCompleted(req.params.id);
        
        logger.info(`Project completed: ${project.id}`);
        
        res.json({ message: 'Project marked as completed' });
    } catch (error) {
        logger.error('Error completing project:', error);
        res.status(500).json({ error: 'Failed to complete project' });
    }
});

module.exports = router;