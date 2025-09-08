const cron = require('node-cron');
const db = require('../models/database');
const ProjectModel = require('../models/project');
const logger = require('../utils/logger');
const NotificationService = require('./notificationService');
const emailService = require('../services/microsoftEmailService');

class SchedulerService {
    constructor() {
        this.job = null;
        this.checkInterval = '*/5 * * * *'; // Check every 5 minutes
        this.isRunning = false;
    }

    /**
     * Initialize the scheduler
     */
    initialize() {
        logger.info('Initializing scheduler service...');
        
        // Create a single cron job that runs every 5 minutes
        this.job = cron.schedule(this.checkInterval, async () => {
            await this.checkAndCloseBidding();
        });
        
        this.isRunning = true;
        logger.info('Scheduler service initialized - checking every 5 minutes for expired bidding periods');
        
        // Run an immediate check on startup
        this.checkAndCloseBidding();
    }

    /**
     * Check for projects with expired bid due dates and close them
     */
    async checkAndCloseBidding() {
        // Prevent overlapping checks
        if (this.isChecking) {
            logger.info('Check already in progress, skipping...');
            return;
        }

        this.isChecking = true;

        try {
            // Find all projects that are still in bidding status but past their due date
            const sql = `
                SELECT id, title, bid_due_date, project_manager_id 
                FROM projects 
                WHERE status = 'bidding' 
                AND datetime(bid_due_date) <= datetime('now')
            `;

            const projects = await db.all(sql);
            
            if (projects.length === 0) {
                logger.debug('No projects need automatic closure');
                return { projectsClosed: 0 };
            }

            logger.info(`Found ${projects.length} project(s) with expired bidding periods`);
            let closedCount = 0;

            for (const project of projects) {
                const success = await this.closeProjectBidding(project);
                if (success) closedCount++;
            }

            logger.info(`Automatic closure complete: ${closedCount} project(s) closed`);
            return { projectsClosed: closedCount };

        } catch (error) {
            logger.error('Error checking for expired bidding periods:', error);
            return { projectsClosed: 0, error: error.message };
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Close bidding for a specific project
     */
    async closeProjectBidding(project) {
        try {
            // Double-check the project is still in bidding status (prevents race conditions)
            const currentProject = await ProjectModel.getById(project.id);
            if (!currentProject || currentProject.status !== 'bidding') {
                logger.info(`Project ${project.id} is not in bidding status, skipping`);
                return false;
            }

            // Update project status to 'reviewing'
            await ProjectModel.updateStatus(project.id, 'reviewing');
            
            logger.info(`✓ Auto-closed bidding for project: ${project.id} - "${project.title}"`);
            
            // Send notifications
            await this.sendClosureNotifications(project);

            // Get bid statistics
            const stats = await db.get(
                `SELECT COUNT(*) as total_bids,
                        MIN(amount) as min_bid,
                        MAX(amount) as max_bid,
                        AVG(amount) as avg_bid
                FROM bids WHERE project_id = ?`,
                [project.id]
            );
            
            // Send email to project owner
            await emailService.sendBidClosingEmail(project, stats);
            
            // Log the automatic closure
            this.logAutoClosure(project);
            
            return true;
            
        } catch (error) {
            logger.error(`Failed to auto-close bidding for project ${project.id}:`, error);
            return false;
        }
    }

    /**
     * Send all notifications related to bidding closure
     */
    async sendClosureNotifications(project) {
        try {
            // Notify project manager
            await NotificationService.create({
                user_id: project.project_manager_id,
                title: 'Bidding Period Closed',
                content: `The bidding period for "${project.title}" has automatically closed. Please review the submitted bids.`,
                type: 'bidding_closed',
                data: JSON.stringify({
                    project_id: project.id,
                    closed_at: new Date().toISOString(),
                    auto_closed: true
                })
            });

            // Notify all bidders
            const biddersSql = `
                SELECT DISTINCT b.user_id, p.title as project_title
                FROM bids b
                JOIN projects p ON b.project_id = p.id
                WHERE b.project_id = ? AND b.status = 'pending'
            `;

            const bidders = await db.all(biddersSql, [project.id]);
            
            for (const bidder of bidders) {
                await NotificationService.create({
                    user_id: bidder.user_id,
                    title: 'Bidding Period Ended',
                    content: `The bidding period for "${bidder.project_title}" has ended. The project is now under review.`,
                    type: 'bidding_closed',
                    data: JSON.stringify({
                        project_id: project.id,
                        closed_at: new Date().toISOString()
                    })
                });
            }

            logger.info(`Sent closure notifications for project ${project.id} to ${bidders.length + 1} users`);

        } catch (error) {
            logger.error(`Error sending notifications for project ${project.id}:`, error);
        }
    }

    /**
     * Log automatic closure for audit purposes
     */
    logAutoClosure(project) {
        const logEntry = {
            event: 'AUTO_BIDDING_CLOSURE',
            project_id: project.id,
            project_title: project.title,
            bid_due_date: project.bid_due_date,
            closed_at: new Date().toISOString(),
            closed_by: 'SYSTEM_SCHEDULER'
        };
        
        logger.info(JSON.stringify(logEntry));
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.job) {
            logger.info('Stopping scheduler service...');
            this.job.stop();
            this.job = null;
            this.isRunning = false;
            logger.info('Scheduler service stopped');
        }
    }

    /**
     * Restart the scheduler
     */
    restart() {
        this.stop();
        this.initialize();
        logger.info('Scheduler service restarted');
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            running: this.isRunning,
            checkInterval: this.checkInterval,
            checkIntervalMinutes: 5,
            isChecking: this.isChecking || false
        };
    }
}

module.exports = new SchedulerService();