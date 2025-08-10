const NotificationModel = require('../models/notification');
const logger = require('../utils/logger');

class NotificationService {
    static async notifyUser(userId, title, content, type = null, data = null) {
        try {
            const notificationId = await NotificationModel.create({
                user_id: userId,
                title,
                content,
                type,
                data
            });
            
            // Emit socket event if available
            const io = global.io;
            if (io) {
                io.to(`user_${userId}`).emit('notification', {
                    id: notificationId,
                    title,
                    content,
                    type,
                    data,
                    created_at: new Date().toISOString()
                });
                logger.info(`Socket notification sent to user ${userId}`);
            }
            
            return notificationId;
        } catch (error) {
            logger.error('Error sending notification:', error);
            throw error;
        }
    }
    
    static async notifyProjectUpdate(projectId, title, content, excludeUserId = null) {
        try {
            const io = global.io;
            if (io) {
                const eventData = {
                    projectId,
                    title,
                    content,
                    timestamp: new Date().toISOString(),
                    excludeUserId
                };
                
                io.to(`project_${projectId}`).emit('project_update', eventData);
                logger.info(`Project update sent to project ${projectId}`);
            }
        } catch (error) {
            logger.error('Error sending project update:', error);
        }
    }
    
    static async notifyNewBid(project, bid, bidder) {
        try {
            // Notify project manager
            await this.notifyUser(
                project.project_manager_id,
                'New Bid Received',
                `${bidder.company || bidder.name} submitted a bid of $${bid.amount.toLocaleString()} for ${project.title}`,
                'new_bid',
                { projectId: project.id, bidId: bid.id }
            );
            
            // Broadcast to project room
            const io = global.io;
            if (io) {
                io.to(`project_${project.id}`).emit('new_bid', {
                    projectId: project.id,
                    bidId: bid.id,
                    bidderName: bidder.company || bidder.name,
                    amount: bid.amount,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error('Error notifying new bid:', error);
        }
    }
    
    static async notifyBidStatusChange(bid, project, status) {
        try {
            const message = status === 'won' 
                ? `Congratulations! Your bid for ${project.title} has been accepted.`
                : `Your bid for ${project.title} was not selected.`;
            
            await this.notifyUser(
                bid.user_id,
                status === 'won' ? 'Bid Accepted!' : 'Bid Status Update',
                message,
                'bid_status',
                { projectId: project.id, bidId: bid.id, status }
            );
        } catch (error) {
            logger.error('Error notifying bid status change:', error);
        }
    }
    
    static async notifyProjectAwarded(project, winner) {
        try {
            // Notify all bidders
            const io = global.io;
            if (io) {
                io.to(`project_${project.id}`).emit('project_awarded', {
                    projectId: project.id,
                    winnerId: winner.id,
                    winnerName: winner.company || winner.name,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error('Error notifying project awarded:', error);
        }
    }
    
    static async broadcastToRole(role, title, content, data = null) {
        try {
            const io = global.io;
            if (io) {
                io.emit('role_notification', {
                    role,
                    title,
                    content,
                    data,
                    timestamp: new Date().toISOString()
                });
                logger.info(`Broadcast sent to role: ${role}`);
            }
        } catch (error) {
            logger.error('Error broadcasting to role:', error);
        }
    }
    
    static async broadcastSystemMessage(message, type = 'info') {
        try {
            const io = global.io;
            if (io) {
                io.emit('system_message', {
                    message,
                    type,
                    timestamp: new Date().toISOString()
                });
                logger.info('System message broadcast sent');
            }
        } catch (error) {
            logger.error('Error broadcasting system message:', error);
        }
    }
}

module.exports = NotificationService;