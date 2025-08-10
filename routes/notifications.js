const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const NotificationModel = require('../models/notification');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');

// Get user's notifications
router.get('/', [
    authenticateToken,
    query('unread').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
    handleValidationErrors
], async (req, res) => {
    try {
        const { unread, limit = 50, offset = 0 } = req.query;
        
        const notifications = await NotificationModel.getUserNotifications(
            req.user.id,
            unread === 'true',
            parseInt(limit),
            parseInt(offset)
        );
        
        const unreadCount = await NotificationModel.getUnreadCount(req.user.id);
        
        res.json({
            notifications,
            unreadCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        logger.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Get single notification
router.get('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid notification ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const notification = await NotificationModel.getById(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        // Check ownership
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(notification);
    } catch (error) {
        logger.error('Error fetching notification:', error);
        res.status(500).json({ error: 'Failed to fetch notification' });
    }
});

// Mark notification as read
router.put('/:id/read', [
    authenticateToken,
    param('id').isInt().withMessage('Valid notification ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const notification = await NotificationModel.getById(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        // Check ownership
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (notification.read) {
            return res.json({ message: 'Notification already marked as read' });
        }
        
        await NotificationModel.markAsRead(req.params.id);
        
        // Emit socket event for real-time update
        const io = global.io;
        if (io) {
            io.to(`user_${req.user.id}`).emit('notification_read', {
                notificationId: req.params.id
            });
        }
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        logger.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await NotificationModel.markAllAsRead(req.user.id);
        
        // Emit socket event for real-time update
        const io = global.io;
        if (io) {
            io.to(`user_${req.user.id}`).emit('all_notifications_read');
        }
        
        logger.info(`All notifications marked as read for user ${req.user.id}`);
        
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        logger.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// Delete notification
router.delete('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid notification ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const notification = await NotificationModel.getById(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        // Check ownership
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await NotificationModel.delete(req.params.id);
        
        // Emit socket event for real-time update
        const io = global.io;
        if (io) {
            io.to(`user_${req.user.id}`).emit('notification_deleted', {
                notificationId: req.params.id
            });
        }
        
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        logger.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// Clear all notifications
router.delete('/clear-all', authenticateToken, async (req, res) => {
    try {
        await NotificationModel.clearAll(req.user.id);
        
        // Emit socket event for real-time update
        const io = global.io;
        if (io) {
            io.to(`user_${req.user.id}`).emit('all_notifications_cleared');
        }
        
        logger.info(`All notifications cleared for user ${req.user.id}`);
        
        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        logger.error('Error clearing notifications:', error);
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
});

// Get notification count
router.get('/count/unread', authenticateToken, async (req, res) => {
    try {
        const count = await NotificationModel.getUnreadCount(req.user.id);
        
        res.json({ count });
    } catch (error) {
        logger.error('Error getting notification count:', error);
        res.status(500).json({ error: 'Failed to get notification count' });
    }
});

// Subscribe to push notifications (placeholder for future implementation)
router.post('/subscribe', authenticateToken, async (req, res) => {
    try {
        // This would handle push notification subscription
        // For now, it's a placeholder
        
        logger.info(`Push notification subscription request from user ${req.user.id}`);
        
        res.json({ 
            message: 'Push notifications not yet implemented',
            supported: false 
        });
    } catch (error) {
        logger.error('Error subscribing to push notifications:', error);
        res.status(500).json({ error: 'Failed to subscribe to push notifications' });
    }
});

module.exports = router;