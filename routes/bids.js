const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const BidModel = require('../models/bid');
const ProjectModel = require('../models/project');
const UserModel = require('../models/user');
const NotificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get all bids (admin only)
router.get('/', [
    authenticateToken,
    requireRole('admin')
], async (req, res) => {
    try {
        const bids = await BidModel.getAll();
        res.json(bids);
    } catch (error) {
        logger.error('Error fetching bids:', error);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Get user's bids
router.get('/my-bids', authenticateToken, async (req, res) => {
    try {
        if (!['installation_company', 'operations'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only installation companies can view bids' });
        }
        
        const bids = await BidModel.getUserBids(req.user.id);
        res.json(bids);
    } catch (error) {
        logger.error('Error fetching user bids:', error);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Get bids for a project
router.get('/project/:projectId', [
    authenticateToken,
    param('projectId').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check access rights
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (req.user.role === 'installation_company' || req.user.role === 'operations') {
            // Installation companies can only see their own bid
            const userBid = await BidModel.getUserBidForProject(req.user.id, project.id);
            return res.json(userBid ? [userBid] : []);
        }
        
        const bids = await BidModel.getProjectBids(req.params.projectId);
        res.json(bids);
    } catch (error) {
        logger.error('Error fetching project bids:', error);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Submit a bid
router.post('/', [
    authenticateToken,
    requireRole(['installation_company', 'operations']),
    body('project_id').isInt().withMessage('Valid project ID required'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid bid amount required'),
    body('comments').optional().isString(),
    body('alternate_delivery_date').optional().isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { project_id, amount, comments, alternate_delivery_date } = req.body;
        
        // Check if project exists and is open for bidding
        const project = await ProjectModel.getById(project_id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (project.status !== 'bidding') {
            return res.status(400).json({ error: 'Project is not open for bidding' });
        }
        
        // Check if bid due date has passed
        if (new Date() > new Date(project.bid_due_date)) {
            return res.status(400).json({ error: 'Bid submission deadline has passed' });
        }
        
        // Check if user already submitted a bid
        const existingBid = await BidModel.getUserBidForProject(req.user.id, project_id);
        if (existingBid) {
            return res.status(409).json({ error: 'You have already submitted a bid for this project' });
        }
        
        // Check if bid exceeds max bid (if visible)
        if (project.show_max_bid && project.max_bid && amount > project.max_bid) {
            return res.status(400).json({ error: `Bid amount exceeds maximum allowed: $${project.max_bid}` });
        }
        
        // Create bid
        const bidId = await BidModel.create({
            project_id,
            user_id: req.user.id,
            amount,
            comments,
            alternate_delivery_date,
            status: 'pending'
        });
        
        const bid = await BidModel.getById(bidId);
        const bidder = await UserModel.getById(req.user.id);
        const projectManager = await UserModel.getById(project.project_manager_id);
        
        // Notify project manager
        await NotificationService.notifyNewBid(project, bid, bidder);
        await emailService.sendBidNotification(projectManager, project, bid, bidder);
        
        logger.info(`Bid submitted: ${bidId} for project ${project_id} by user ${req.user.id}`);
        
        res.status(201).json(bid);
    } catch (error) {
        logger.error('Error submitting bid:', error);
        res.status(500).json({ error: 'Failed to submit bid' });
    }
});

// Update a bid
router.put('/:id', [
    authenticateToken,
    requireRole(['installation_company', 'operations']),
    param('id').isInt().withMessage('Valid bid ID required'),
    body('amount').optional().isFloat({ min: 0 }),
    body('comments').optional().isString(),
    body('alternate_delivery_date').optional().isISO8601(),
    handleValidationErrors
], async (req, res) => {
    try {
        const bid = await BidModel.getById(req.params.id);
        
        if (!bid) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        // Check ownership
        if (bid.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if bid can be updated
        if (bid.status !== 'pending') {
            return res.status(400).json({ error: 'Cannot update bid after it has been reviewed' });
        }
        
        const project = await ProjectModel.getById(bid.project_id);
        
        if (project.status !== 'bidding') {
            return res.status(400).json({ error: 'Cannot update bid - project is no longer accepting bids' });
        }
        
        // Update bid
        await BidModel.update(req.params.id, req.body);
        const updatedBid = await BidModel.getById(req.params.id);
        
        logger.info(`Bid updated: ${req.params.id} by user ${req.user.id}`);
        
        res.json(updatedBid);
    } catch (error) {
        logger.error('Error updating bid:', error);
        res.status(500).json({ error: 'Failed to update bid' });
    }
});

// Delete/withdraw a bid
router.delete('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid bid ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const bid = await BidModel.getById(req.params.id);
        
        if (!bid) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        // Check ownership or admin
        if (bid.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if bid can be withdrawn
        if (bid.status === 'won') {
            return res.status(400).json({ error: 'Cannot withdraw a winning bid' });
        }
        
        const project = await ProjectModel.getById(bid.project_id);
        
        if (project.status === 'awarded' || project.status === 'completed') {
            return res.status(400).json({ error: 'Cannot withdraw bid from awarded/completed project' });
        }
        
        await BidModel.delete(req.params.id);
        
        logger.info(`Bid withdrawn: ${req.params.id} by user ${req.user.id}`);
        
        res.json({ message: 'Bid withdrawn successfully' });
    } catch (error) {
        logger.error('Error withdrawing bid:', error);
        res.status(500).json({ error: 'Failed to withdraw bid' });
    }
});

module.exports = router;