const db = require('./database');
const logger = require('../utils/logger');

class NotificationModel {
    static async create(notificationData) {
        const sql = `
            INSERT INTO notifications (user_id, title, content, type, data, read)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            notificationData.user_id,
            notificationData.title,
            notificationData.content || null,
            notificationData.type || null,
            JSON.stringify(notificationData.data || {}),
            0
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating notification:', error);
            throw error;
        }
    }
    
    static async getById(id) {
        const sql = `SELECT * FROM notifications WHERE id = ?`;
        const notification = await db.get(sql, [id]);
        
        if (notification && notification.data) {
            notification.data = JSON.parse(notification.data);
        }
        
        return notification;
    }
    
    static async getUserNotifications(userId, unreadOnly = false, limit = 50, offset = 0) {
        let sql = `
            SELECT * FROM notifications 
            WHERE user_id = ?
        `;
        
        if (unreadOnly) {
            sql += ` AND read = 0`;
        }
        
        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        
        const notifications = await db.all(sql, [userId, limit, offset]);
        
        return notifications.map(n => {
            if (n.data) {
                n.data = JSON.parse(n.data);
            }
            return n;
        });
    }
    
    static async markAsRead(id) {
        const sql = `UPDATE notifications SET read = 1 WHERE id = ?`;
        return db.run(sql, [id]);
    }
    
    static async markAllAsRead(userId) {
        const sql = `UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0`;
        return db.run(sql, [userId]);
    }
    
    static async delete(id) {
        const sql = `DELETE FROM notifications WHERE id = ?`;
        return db.run(sql, [id]);
    }
    
    static async clearAll(userId) {
        const sql = `DELETE FROM notifications WHERE user_id = ?`;
        return db.run(sql, [userId]);
    }
    
    static async getUnreadCount(userId) {
        const sql = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0`;
        const result = await db.get(sql, [userId]);
        return result.count;
    }
}

module.exports = NotificationModel;