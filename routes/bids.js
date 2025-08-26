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
router.get('/my-bids', [
    authenticateToken
], async (req, res) => {
    try {
        const { page = 1, limit = 10, status, project_id } = req.query;
        
        // Only get bids for the current user
        const bids = await BidModel.getUserBids(req.user.id, {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            project_id
        });
        
        // Add files to each bid
        const bidsWithFiles = await Promise.all(bids.map(async (bid) => {
            try {
                bid.files = await FileModel.getBidFiles(bid.id);
                // For each bid, only include limited project information
                const project = await ProjectModel.getById(bid.project_id);
                bid.project_title = project.title;
                bid.project_delivery_date = project.delivery_date;
            } catch (error) {
                bid.files = [];
            }
            return bid;
        }));
        
        logger.info(`User bids retrieved for ${req.user.username}`);
        
        res.json(bidsWithFiles);
    } catch (error) {
        logger.error('Error fetching user bids:', error);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

router.get('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid bid ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const bid = await BidModel.getById(req.params.id);
        
        if (!bid) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        // Get project details
        const project = await ProjectModel.getById(bid.project_id);
        
        if (!project) {
            return res.status(404).json({ error: 'Associated project not found' });
        }
        
        // Check access permissions
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let hasAccess = false;
        
        if (userRole === 'admin') {
            hasAccess = true;
        } else if (bid.user_id === userId) {
            // Bidder can see their own bid
            hasAccess = true;
        } else if (project.project_manager_id === userId) {
            // Project manager can see bids for their project
            hasAccess = true;
        }
        
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get bidder details
        const bidder = await UserModel.getById(bid.user_id);
        
        // Get bid files
        const FileModel = require('../models/file');
        bid.files = await FileModel.getBidFiles(bid.id);
        
        // Get ratings for the bidder
        const RatingModel = require('../models/rating');
        const ratings = await RatingModel.getAverageRatings(bid.user_id);
        
        // Combine all information
        const bidDetails = {
            ...bid,
            project: {
                id: project.id,
                title: project.title,
                description: project.description,
                delivery_date: project.delivery_date,
                zip_code: project.zip_code,
                status: project.status,
                max_bid: project.show_max_bid ? project.max_bid : null
            },
            bidder: {
                id: bidder.id,
                name: bidder.name,
                company: bidder.company,
                email: userRole === 'admin' || project.project_manager_id === userId ? bidder.email : null,
                phone: userRole === 'admin' || project.project_manager_id === userId ? bidder.phone : null,
                position: bidder.position
            },
            ratings: ratings || null
        };
        
        res.json(bidDetails);
        
    } catch (error) {
        logger.error('Error fetching bid details:', error);
        res.status(500).json({ error: 'Failed to fetch bid details' });
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
        
        // SECURITY CHECK: Only admins and project managers can see all bids
        const userRole = req.user.role;
        const userId = req.user.id;
        
        if (userRole === 'installation_company') {
            // Installation companies can only see their own bid
            const userBid = await BidModel.getUserBidForProject(userId, req.params.projectId);
            
            // Return only their own bid in an array format for consistency
            // but without revealing other bidders
            return res.json(userBid ? [{
                id: userBid.id,
                amount: userBid.amount,
                delivery_date: userBid.delivery_date,
                status: userBid.status,
                created_at: userBid.created_at,
                // Don't include other bidder information
                user_id: userBid.user_id,
                user_name: 'Your Bid',
                company: userBid.company
            }] : []);
        }
        
        // For project managers, only show bids for their projects
        if (userRole === 'project_manager' && project.project_manager_id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Admins and authorized project managers can see all bids
        const bids = await BidModel.getProjectBids(req.params.projectId);
        
        logger.info(`Bids retrieved for project ${req.params.projectId} by ${req.user.username}`);
        
        // Add files to each bid
        const bidsWithFiles = await Promise.all(bids.map(async (bid) => {
            try {
                bid.files = await FileModel.getBidFiles(bid.id);
            } catch (error) {
                bid.files = [];
            }
            return bid;
        }));

        res.json(bidsWithFiles);
    } catch (error) {
        logger.error('Error fetching project bids:', error);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Submit a bid
router.post('/', [
    authenticateToken,
    requireRole(['installation_company', 'operations', 'admin']), // Added admin
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
        
        // Allow admin to bid on any status for testing
        if (req.user.role !== 'admin' && project.status !== 'bidding') {
            return res.status(400).json({ error: 'Project is not open for bidding' });
        }
        
        // Skip deadline check for admin
        if (req.user.role !== 'admin' && new Date() > new Date(project.bid_due_date)) {
            return res.status(400).json({ error: 'Bid submission deadline has passed' });
        }
        
        // Check if user already submitted a bid (skip for admin)
        const existingBid = await BidModel.getUserBidForProject(req.user.id, project_id);
        if (existingBid && req.user.role !== 'admin') {
            return res.status(400).json({ error: 'You have already submitted a bid for this project' });
        }
        
        // Create bid
        const bidData = {
            project_id,
            user_id: req.user.id,
            user_role: req.user.role,
            amount,
            comments,
            alternate_delivery_date,
            status: 'pending'
        };
        
        const bidId = await BidModel.create(bidData);
        const newBid = await BidModel.getById(bidId);
        
        // Notify project manager
        await NotificationService.notifyUser(
            project.project_manager_id,
            'New Bid Received',
            `New bid submitted for project "${project.title}"`,
            'new_bid',
            { projectId: project_id, bidId: bidId }
        );
        
        logger.info(`Bid submitted: Project ${project_id} by user ${req.user.id}`);
        
        res.status(201).json(newBid);
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