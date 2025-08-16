const db = require('./database');
const logger = require('../utils/logger');

class BidModel {
    static async create(bidData) {
        const sql = `
            INSERT INTO bids (project_id, user_id, amount, comments, alternate_delivery_date, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            bidData.project_id,
            bidData.user_id,
            bidData.amount,
            bidData.comments || null,
            bidData.alternate_delivery_date || null,
            bidData.status || 'pending'
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating bid:', error);
            throw error;
        }
    }
    
    static async getById(id) {
        const sql = `
            SELECT b.*, p.title as project_title, u.name as company_name, u.email as user_email
            FROM bids b
            LEFT JOIN projects p ON b.project_id = p.id
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.id = ?
        `;
        return db.get(sql, [id]);
    }
    
    static async getUserBids(userId) {
        const sql = `
            SELECT b.*, p.title as project_title, p.status as project_status,
                   p.delivery_date, p.zip_code
            FROM bids b
            LEFT JOIN projects p ON b.project_id = p.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `;
        return db.all(sql, [userId]);
    }
    
    static async getProjectBids(projectId) {
        const sql = `
            SELECT b.*, u.name as company_name, u.email as user_email, u.phone as user_phone,
                   AVG((r.price + r.speed + r.quality + r.responsiveness + r.customer_satisfaction) / 5.0) as avg_rating
            FROM bids b
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN ratings r ON u.id = r.rated_user_id
            WHERE b.project_id = ?
            GROUP BY b.id
            ORDER BY b.amount ASC
        `;
        return db.all(sql, [projectId]);
    }
    
    static async getUserBidForProject(userId, projectId) {
        const sql = `SELECT * FROM bids WHERE user_id = ? AND project_id = ?`;
        return db.get(sql, [userId, projectId]);
    }
    
    static async updateStatus(id, status) {
        const sql = `UPDATE bids SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, [status, id]);
    }
    
    static async updateProjectBidsStatus(projectId, winnerId) {
        await db.run(
            `UPDATE bids SET status = 'won', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [winnerId]
        );
        
        await db.run(
            `UPDATE bids SET status = 'lost', updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND id != ?`,
            [projectId, winnerId]
        );
    }

    static async getCountByUserAndStatus(userId, status) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM bids 
            WHERE user_id = ? AND status = ?
        `;
        try {
            const result = await db.get(sql, [userId, status]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error getting bid count by user and status:', error);
            return 0;
        }
    }

    static async getCountForManagerProjects(managerId) {
        const sql = `
            SELECT COUNT(b.id) as count
            FROM bids b
            INNER JOIN projects p ON b.project_id = p.id
            WHERE p.project_manager_id = ?
        `;
        try {
            const result = await db.get(sql, [managerId]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error getting bid count for manager projects:', error);
            return 0;
        }
    }

    static async getAverageAmountByUser(userId) {
        const sql = `
            SELECT AVG(amount) as average 
            FROM bids 
            WHERE user_id = ?
        `;
        try {
            const result = await db.get(sql, [userId]);
            return result ? (result.average || 0) : 0;
        } catch (error) {
            logger.error('Error getting average bid amount:', error);
            return 0;
        }
    }

    static async getCountByPeriod(days) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM bids 
            WHERE created_at >= datetime('now', '-' || ? || ' days')
        `;
        try {
            const result = await db.get(sql, [days]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error getting bid count by period:', error);
            return 0;
        }
    }

    static async getAll() {
        const sql = `
            SELECT b.*, p.title as project_title, u.name as user_name, u.company
            FROM bids b
            LEFT JOIN projects p ON b.project_id = p.id
            LEFT JOIN users u ON b.user_id = u.id
            ORDER BY b.created_at DESC
        `;
        try {
            return await db.all(sql);
        } catch (error) {
            logger.error('Error getting all bids:', error);
            return [];
        }
    }

    static async getRecent(limit = 5) {
        const sql = `
            SELECT b.*, p.title as project_title, u.name as user_name
            FROM bids b
            LEFT JOIN projects p ON b.project_id = p.id
            LEFT JOIN users u ON b.user_id = u.id
            ORDER BY b.created_at DESC
            LIMIT ?
        `;
        try {
            return await db.all(sql, [limit]);
        } catch (error) {
            logger.error('Error getting recent bids:', error);
            return [];
        }
    }

    static async getRecentByUser(userId, limit = 10) {
        const sql = `
            SELECT b.*, p.title as project_title, p.status as project_status
            FROM bids b
            LEFT JOIN projects p ON b.project_id = p.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
            LIMIT ?
        `;
        try {
            return await db.all(sql, [userId, limit]);
        } catch (error) {
            logger.error('Error getting recent bids by user:', error);
            return [];
        }
    }

    static async getRecentForManagerProjects(managerId, limit = 10) {
        const sql = `
            SELECT b.*, p.title as project_title, u.name as user_name, u.company
            FROM bids b
            INNER JOIN projects p ON b.project_id = p.id
            LEFT JOIN users u ON b.user_id = u.id
            WHERE p.project_manager_id = ?
            ORDER BY b.created_at DESC
            LIMIT ?
        `;
        try {
            return await db.all(sql, [managerId, limit]);
        } catch (error) {
            logger.error('Error getting recent bids for manager projects:', error);
            return [];
        }
    }
    
    static async delete(id) {
        const sql = `DELETE FROM bids WHERE id = ?`;
        return db.run(sql, [id]);
    }
    
    static async getCount() {
        const sql = `SELECT COUNT(*) as count FROM bids`;
        const result = await db.get(sql);
        return result.count;
    }
    
    static async getCountByUser(userId) {
        const sql = `SELECT COUNT(*) as count FROM bids WHERE user_id = ?`;
        const result = await db.get(sql, [userId]);
        return result.count;
    }
    
    static async getWinRate(userId) {
        const sql = `
            SELECT 
                COUNT(CASE WHEN status = 'won' THEN 1 END) * 100.0 / COUNT(*) as rate
            FROM bids 
            WHERE user_id = ?
        `;
        const result = await db.get(sql, [userId]);
        return result.rate || 0;
    }
}

module.exports = BidModel;