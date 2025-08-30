const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const RatingModel = require('../models/rating');
const ProjectModel = require('../models/project');
const UserModel = require('../models/user');
const NotificationService = require('../services/notificationService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get ratings for a user
router.get('/user/:userId', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('userId').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const ratings = await RatingModel.getByUser(req.params.userId);
        const averageRatings = await RatingModel.getAverageRatings(req.params.userId);
        
        res.json({
            ratings,
            average: averageRatings,
            overall: averageRatings ? (
                (averageRatings.avg_price +
                 averageRatings.avg_speed +
                 averageRatings.avg_quality +
                 averageRatings.avg_responsiveness +
                 averageRatings.avg_customer_satisfaction) / 5
            ).toFixed(2) : 0
        });
    } catch (error) {
        logger.error('Error fetching user ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

// Get ratings for a project
router.get('/project/:projectId', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
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
            if (project.awarded_to !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        const ratings = await RatingModel.getByProject(req.params.projectId);
        
        res.json(ratings);
    } catch (error) {
        logger.error('Error fetching project ratings:', error);
        res.status(500).json({ error: 'Failed to fetch ratings' });
    }
});

// Get reviews for a user
router.get('/user/:userId/reviews', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('userId').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const reviews = await RatingModel.getByUser(req.params.userId);
        res.json({ reviews });
    } catch (error) {
        logger.error('Error fetching user reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Submit a rating
router.post('/', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    body('project_id').isInt().withMessage('Valid project ID required'),
    body('rated_user_id').isInt().withMessage('Valid user ID required'),
    body('price').isInt({ min: 1, max: 5 }).withMessage('Price rating must be between 1 and 5'),
    body('speed').isInt({ min: 1, max: 5 }).withMessage('Speed rating must be between 1 and 5'),
    body('quality').isInt({ min: 1, max: 5 }).withMessage('Quality rating must be between 1 and 5'),
    body('responsiveness').isInt({ min: 1, max: 5 }).withMessage('Responsiveness rating must be between 1 and 5'),
    body('customer_satisfaction').isInt({ min: 1, max: 5 }).withMessage('Customer satisfaction rating must be between 1 and 5'),
    body('comments').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        const { project_id, rated_user_id, price, speed, quality, responsiveness, customer_satisfaction, comments } = req.body;
        
        // Verify project exists and is completed
        const project = await ProjectModel.getById(project_id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        if (project.status !== 'completed') {
            return res.status(400).json({ error: 'Can only rate completed projects' });
        }
        
        // Check if user is project manager for this project
        if (project.project_manager_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only project managers can rate contractors' });
        }
        
        // Check if rating already exists
        const existingRating = await RatingModel.getByProjectAndRater(project_id, req.user.id);
        if (existingRating) {
            return res.status(409).json({ error: 'You have already rated this contractor for this project' });
        }
        
        // Verify rated user was involved in the project
        const ratedUser = await UserModel.getById(rated_user_id);
        if (!ratedUser) {
            return res.status(404).json({ error: 'Rated user not found' });
        }
        
        if (project.awarded_to !== rated_user_id) {
            return res.status(400).json({ error: 'Can only rate the contractor who was awarded the project' });
        }
        
        // Create rating
        const ratingId = await RatingModel.create({
            project_id,
            rated_user_id,
            rated_by_user_id: req.user.id,
            price,
            speed,
            quality,
            responsiveness,
            customer_satisfaction,
            comments
        });
        
        const rating = await RatingModel.getById(ratingId);
        
        // Calculate overall rating
        const overallRating = (price + speed + quality + responsiveness + customer_satisfaction) / 5;
        
        // Notify the rated user
        await NotificationService.notifyUser(
            rated_user_id,
            'New Rating Received',
            `You received a ${overallRating.toFixed(1)}/5 rating for project "${project.title}"`,
            'rating',
            { projectId: project_id, ratingId }
        );
        
        logger.info(`Rating submitted for user ${rated_user_id} on project ${project_id}`);
        
        res.status(201).json(rating);
    } catch (error) {
        logger.error('Error submitting rating:', error);
        res.status(500).json({ error: 'Failed to submit rating' });
    }
});

// Get rating summary for a user
router.get('/user/:userId/summary', [
    authenticateToken,
    requireRole(['admin', 'project_manager']),
    param('userId').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const averageRatings = await RatingModel.getAverageRatings(req.params.userId);
        
        if (!averageRatings || averageRatings.count === 0) {
            return res.json({
                hasRatings: false,
                count: 0,
                overall: 0,
                breakdown: {
                    price: 0,
                    speed: 0,
                    quality: 0,
                    responsiveness: 0,
                    customer_satisfaction: 0
                }
            });
        }
        
        const overall = (
            averageRatings.avg_price +
            averageRatings.avg_speed +
            averageRatings.avg_quality +
            averageRatings.avg_responsiveness +
            averageRatings.avg_customer_satisfaction
        ) / 5;
        
        res.json({
            hasRatings: true,
            count: averageRatings.count,
            overall: overall.toFixed(2),
            breakdown: {
                price: averageRatings.avg_price.toFixed(2),
                speed: averageRatings.avg_speed.toFixed(2),
                quality: averageRatings.avg_quality.toFixed(2),
                responsiveness: averageRatings.avg_responsiveness.toFixed(2),
                customer_satisfaction: averageRatings.avg_customer_satisfaction.toFixed(2)
            }
        });
    } catch (error) {
        logger.error('Error fetching rating summary:', error);
        res.status(500).json({ error: 'Failed to fetch rating summary' });
    }
});

// Delete a rating (admin only)
router.delete('/:id', [
    authenticateToken,
    requireRole('admin'),
    param('id').isInt().withMessage('Valid rating ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const rating = await RatingModel.getById(req.params.id);
        
        if (!rating) {
            return res.status(404).json({ error: 'Rating not found' });
        }
        
        await RatingModel.delete(req.params.id);
        
        logger.info(`Rating ${req.params.id} deleted by admin ${req.user.username}`);
        
        res.json({ message: 'Rating deleted successfully' });
    } catch (error) {
        logger.error('Error deleting rating:', error);
        res.status(500).json({ error: 'Failed to delete rating' });
    }
});

module.exports = router;