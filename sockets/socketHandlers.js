const logger = require('../utils/logger');
const NotificationModel = require('../models/notification');
const UserModel = require('../models/user');
const ProjectModel = require('../models/project');

class SocketHandlers {
    constructor(io) {
        this.io = io;
        this.connectedUsers = new Map(); // Track connected users
        this.userSockets = new Map(); // Map user IDs to socket IDs
    }
    
    initialize() {
        this.io.on('connection', (socket) => {
            logger.info(`New socket connection: ${socket.id} from ${socket.handshake.address}`);
            
            // Handle authentication
            socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
            
            // Handle user room joins
            socket.on('join_user_room', (userId) => this.handleJoinUserRoom(socket, userId));
            socket.on('join_project_room', (projectId) => this.handleJoinProjectRoom(socket, projectId));
            socket.on('leave_project_room', (projectId) => this.handleLeaveProjectRoom(socket, projectId));
            
            // Handle messaging
            socket.on('send_message', (data) => this.handleSendMessage(socket, data));
            socket.on('typing', (data) => this.handleTyping(socket, data));
            socket.on('stop_typing', (data) => this.handleStopTyping(socket, data));
            
            // Handle notifications
            socket.on('mark_notification_read', (data) => this.handleMarkNotificationRead(socket, data));
            socket.on('get_unread_count', () => this.handleGetUnreadCount(socket));
            
            // Handle real-time updates
            socket.on('project_update', (data) => this.handleProjectUpdate(socket, data));
            socket.on('bid_update', (data) => this.handleBidUpdate(socket, data));
            
            // Handle presence
            socket.on('get_online_users', () => this.handleGetOnlineUsers(socket));
            
            // Handle ping for connection health
            socket.on('ping', () => this.handlePing(socket));
            
            // Handle disconnection
            socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
            
            // Handle errors
            socket.on('error', (error) => this.handleError(socket, error));
        });
        
        // Periodic cleanup of stale connections
        setInterval(() => this.cleanupStaleConnections(), 60000); // Every minute
    }
    
    handleAuthentication(socket, data) {
        try {
            const { userId, token } = data;
            
            // In production, verify the token here
            // For now, we'll just track the authenticated user
            
            if (userId) {
                this.connectedUsers.set(socket.id, {
                    userId,
                    socketId: socket.id,
                    connectedAt: new Date(),
                    lastActivity: new Date()
                });
                
                // Track user's socket IDs (user might have multiple connections)
                if (!this.userSockets.has(userId)) {
                    this.userSockets.set(userId, new Set());
                }
                this.userSockets.get(userId).add(socket.id);
                
                // Join user's personal room
                socket.join(`user_${userId}`);
                
                // Send authentication success
                socket.emit('authenticated', {
                    success: true,
                    userId,
                    message: 'Authentication successful'
                });
                
                // Notify others that user is online
                this.broadcastUserStatus(userId, 'online');
                
                logger.info(`User ${userId} authenticated with socket ${socket.id}`);
            } else {
                socket.emit('authenticated', {
                    success: false,
                    message: 'Invalid authentication data'
                });
            }
        } catch (error) {
            logger.error('Authentication error:', error);
            socket.emit('authenticated', {
                success: false,
                message: 'Authentication failed'
            });
        }
    }
    
    handleJoinUserRoom(socket, userId) {
        if (userId) {
            socket.join(`user_${userId}`);
            socket.emit('room_joined', {
                room: `user_${userId}`,
                type: 'user'
            });
            logger.info(`Socket ${socket.id} joined user room: user_${userId}`);
        }
    }
    
    handleJoinProjectRoom(socket, projectId) {
        if (projectId) {
            const room = `project_${projectId}`;
            socket.join(room);
            
            // Get user info from socket
            const userInfo = this.connectedUsers.get(socket.id);
            
            // Notify others in the project room
            socket.to(room).emit('user_joined_project', {
                userId: userInfo?.userId,
                projectId,
                socketId: socket.id,
                timestamp: new Date()
            });
            
            // Send confirmation to the user
            socket.emit('room_joined', {
                room,
                type: 'project',
                projectId
            });
            
            // Get and send current users in the room
            const usersInRoom = this.getUsersInRoom(room);
            socket.emit('project_room_users', {
                projectId,
                users: usersInRoom
            });
            
            logger.info(`Socket ${socket.id} joined project room: ${room}`);
        }
    }
    
    handleLeaveProjectRoom(socket, projectId) {
        if (projectId) {
            const room = `project_${projectId}`;
            socket.leave(room);
            
            const userInfo = this.connectedUsers.get(socket.id);
            
            // Notify others in the project room
            socket.to(room).emit('user_left_project', {
                userId: userInfo?.userId,
                projectId,
                socketId: socket.id,
                timestamp: new Date()
            });
            
            socket.emit('room_left', {
                room,
                type: 'project',
                projectId
            });
            
            logger.info(`Socket ${socket.id} left project room: ${room}`);
        }
    }
    
    handleSendMessage(socket, data) {
        try {
            const { to, message, type = 'direct' } = data;
            const userInfo = this.connectedUsers.get(socket.id);
            
            if (!userInfo) {
                socket.emit('message_error', {
                    error: 'Not authenticated'
                });
                return;
            }
            
            const messageData = {
                from: userInfo.userId,
                message,
                timestamp: new Date(),
                type
            };
            
            if (type === 'direct') {
                // Direct message to a user
                this.io.to(`user_${to}`).emit('new_message', messageData);
            } else if (type === 'project') {
                // Message to a project room
                this.io.to(`project_${to}`).emit('new_message', {
                    ...messageData,
                    projectId: to
                });
            } else if (type === 'broadcast' && userInfo.role === 'admin') {
                // Admin broadcast
                this.io.emit('broadcast_message', messageData);
            }
            
            // Send confirmation to sender
            socket.emit('message_sent', {
                success: true,
                timestamp: messageData.timestamp
            });
            
        } catch (error) {
            logger.error('Error sending message:', error);
            socket.emit('message_error', {
                error: 'Failed to send message'
            });
        }
    }
    
    handleTyping(socket, data) {
        const { room, projectId } = data;
        const userInfo = this.connectedUsers.get(socket.id);
        
        if (userInfo) {
            const typingData = {
                userId: userInfo.userId,
                socketId: socket.id,
                timestamp: new Date()
            };
            
            if (projectId) {
                socket.to(`project_${projectId}`).emit('user_typing', {
                    ...typingData,
                    projectId
                });
            } else if (room) {
                socket.to(room).emit('user_typing', typingData);
            }
        }
    }
    
    handleStopTyping(socket, data) {
        const { room, projectId } = data;
        const userInfo = this.connectedUsers.get(socket.id);
        
        if (userInfo) {
            const typingData = {
                userId: userInfo.userId,
                socketId: socket.id,
                timestamp: new Date()
            };
            
            if (projectId) {
                socket.to(`project_${projectId}`).emit('user_stop_typing', {
                    ...typingData,
                    projectId
                });
            } else if (room) {
                socket.to(room).emit('user_stop_typing', typingData);
            }
        }
    }
    
    async handleMarkNotificationRead(socket, data) {
        try {
            const { notificationId } = data;
            const userInfo = this.connectedUsers.get(socket.id);
            
            if (userInfo) {
                await NotificationModel.markAsRead(notificationId);
                
                socket.emit('notification_marked_read', {
                    notificationId,
                    success: true
                });
                
                // Update unread count
                const unreadCount = await NotificationModel.getUnreadCount(userInfo.userId);
                socket.emit('unread_count_updated', { count: unreadCount });
            }
        } catch (error) {
            logger.error('Error marking notification as read:', error);
            socket.emit('notification_error', {
                error: 'Failed to mark notification as read'
            });
        }
    }
    
    async handleGetUnreadCount(socket) {
        try {
            const userInfo = this.connectedUsers.get(socket.id);
            
            if (userInfo) {
                const unreadCount = await NotificationModel.getUnreadCount(userInfo.userId);
                socket.emit('unread_count', { count: unreadCount });
            }
        } catch (error) {
            logger.error('Error getting unread count:', error);
            socket.emit('notification_error', {
                error: 'Failed to get unread count'
            });
        }
    }
    
    handleProjectUpdate(socket, data) {
        const { projectId, update } = data;
        const userInfo = this.connectedUsers.get(socket.id);
        
        if (userInfo) {
            // Broadcast project update to all users in the project room
            this.io.to(`project_${projectId}`).emit('project_updated', {
                projectId,
                update,
                updatedBy: userInfo.userId,
                timestamp: new Date()
            });
            
            logger.info(`Project ${projectId} updated by user ${userInfo.userId}`);
        }
    }
    
    handleBidUpdate(socket, data) {
        const { bidId, projectId, update } = data;
        const userInfo = this.connectedUsers.get(socket.id);
        
        if (userInfo) {
            // Broadcast bid update to project room
            this.io.to(`project_${projectId}`).emit('bid_updated', {
                bidId,
                projectId,
                update,
                updatedBy: userInfo.userId,
                timestamp: new Date()
            });
            
            logger.info(`Bid ${bidId} updated for project ${projectId}`);
        }
    }
    
    handleGetOnlineUsers(socket) {
        const onlineUsers = Array.from(this.userSockets.keys());
        socket.emit('online_users', {
            users: onlineUsers,
            count: onlineUsers.length
        });
    }
    
    handlePing(socket) {
        const userInfo = this.connectedUsers.get(socket.id);
        if (userInfo) {
            userInfo.lastActivity = new Date();
        }
        socket.emit('pong', {
            timestamp: Date.now(),
            serverTime: new Date()
        });
    }
    
    handleDisconnect(socket, reason) {
        const userInfo = this.connectedUsers.get(socket.id);
        
        if (userInfo) {
            // Remove from user sockets tracking
            const userSocketSet = this.userSockets.get(userInfo.userId);
            if (userSocketSet) {
                userSocketSet.delete(socket.id);
                
                // If user has no more connections, mark as offline
                if (userSocketSet.size === 0) {
                    this.userSockets.delete(userInfo.userId);
                    this.broadcastUserStatus(userInfo.userId, 'offline');
                }
            }
            
            // Remove from connected users
            this.connectedUsers.delete(socket.id);
            
            logger.info(`User ${userInfo.userId} disconnected (socket: ${socket.id}, reason: ${reason})`);
        } else {
            logger.info(`Socket ${socket.id} disconnected (reason: ${reason})`);
        }
    }
    
    handleError(socket, error) {
        logger.error(`Socket error for ${socket.id}:`, error);
        socket.emit('error_occurred', {
            message: 'An error occurred',
            timestamp: new Date()
        });
    }
    
    // Helper methods
    
    broadcastUserStatus(userId, status) {
        this.io.emit('user_status_changed', {
            userId,
            status,
            timestamp: new Date()
        });
    }
    
    getUsersInRoom(room) {
        const users = [];
        const clients = this.io.sockets.adapter.rooms.get(room);
        
        if (clients) {
            for (const socketId of clients) {
                const userInfo = this.connectedUsers.get(socketId);
                if (userInfo) {
                    users.push({
                        userId: userInfo.userId,
                        socketId: userInfo.socketId,
                        connectedAt: userInfo.connectedAt
                    });
                }
            }
        }
        
        return users;
    }
    
    cleanupStaleConnections() {
        const now = new Date();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        
        for (const [socketId, userInfo] of this.connectedUsers.entries()) {
            const inactiveDuration = now - userInfo.lastActivity;
            
            if (inactiveDuration > staleThreshold) {
                // Check if socket is still connected
                const socket = this.io.sockets.sockets.get(socketId);
                
                if (!socket || !socket.connected) {
                    // Clean up stale connection
                    this.connectedUsers.delete(socketId);
                    
                    const userSocketSet = this.userSockets.get(userInfo.userId);
                    if (userSocketSet) {
                        userSocketSet.delete(socketId);
                        
                        if (userSocketSet.size === 0) {
                            this.userSockets.delete(userInfo.userId);
                        }
                    }
                    
                    logger.info(`Cleaned up stale connection for socket ${socketId}`);
                }
            }
        }
    }
    
    // Public methods for external use
    
    sendNotificationToUser(userId, notification) {
        this.io.to(`user_${userId}`).emit('notification', notification);
    }
    
    sendProjectUpdate(projectId, update) {
        this.io.to(`project_${projectId}`).emit('project_update', update);
    }
    
    broadcastSystemMessage(message) {
        this.io.emit('system_message', {
            message,
            timestamp: new Date()
        });
    }
    
    getOnlineUserCount() {
        return this.userSockets.size;
    }
    
    isUserOnline(userId) {
        return this.userSockets.has(userId);
    }
}

module.exports = SocketHandlers;