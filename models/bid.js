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