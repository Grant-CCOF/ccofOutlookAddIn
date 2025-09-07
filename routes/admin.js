const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const schedulerService = require('../services/scheduler');

// Get scheduler status
router.get('/scheduler/status', [
    authenticateToken,
    requireRole('admin')
], async (req, res) => {
    try {
        const status = {
            active: schedulerService.jobs.size > 0,
            jobs: Array.from(schedulerService.jobs.keys()),
            checkInterval: schedulerService.checkInterval
        };
        res.json(status);
    } catch (error) {
        logger.error('Error getting scheduler status:', error);
        res.status(500).json({ error: 'Failed to get scheduler status' });
    }
});

// Restart scheduler
router.post('/scheduler/restart', [
    authenticateToken,
    requireRole('admin')
], async (req, res) => {
    try {
        await schedulerService.restart();
        res.json({ message: 'Scheduler restarted successfully' });
    } catch (error) {
        logger.error('Error restarting scheduler:', error);
        res.status(500).json({ error: 'Failed to restart scheduler' });
    }
});

// Manual check for expired bidding
router.post('/scheduler/check-now', [
    authenticateToken,
    requireRole('admin')
], async (req, res) => {
    try {
        await schedulerService.checkAndCloseBidding();
        res.json({ message: 'Manual check completed' });
    } catch (error) {
        logger.error('Error running manual check:', error);
        res.status(500).json({ error: 'Failed to run manual check' });
    }
});

module.exports = router;