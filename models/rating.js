const db = require('./database');
const logger = require('../utils/logger');

class RatingModel {
    static async create(ratingData) {
        const sql = `
            INSERT INTO ratings (
                project_id, rated_user_id, rated_by_user_id,
                price, speed, quality, responsiveness, customer_satisfaction, comments
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            ratingData.project_id,
            ratingData.rated_user_id,
            ratingData.rated_by_user_id,
            ratingData.price,
            ratingData.speed,
            ratingData.quality,
            ratingData.responsiveness,
            ratingData.customer_satisfaction,
            ratingData.comments || null
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating rating:', error);
            throw error;
        }
    }
    
    static async getById(id) {
        const sql = `
            SELECT r.*, p.title as project_title,
                   u1.name as rated_user_name, u2.name as rated_by_name
            FROM ratings r
            LEFT JOIN projects p ON r.project_id = p.id
            LEFT JOIN users u1 ON r.rated_user_id = u1.id
            LEFT JOIN users u2 ON r.rated_by_user_id = u2.id
            WHERE r.id = ?
        `;
        return db.get(sql, [id]);
    }
    
    static async getByProject(projectId) {
        const sql = `
            SELECT r.*, u1.name as rated_user_name, u2.name as rated_by_name
            FROM ratings r
            LEFT JOIN users u1 ON r.rated_user_id = u1.id
            LEFT JOIN users u2 ON r.rated_by_user_id = u2.id
            WHERE r.project_id = ?
        `;
        return db.all(sql, [projectId]);
    }
    
    static async getByUser(userId) {
        const sql = `
            SELECT r.*, p.title as project_title, p.delivery_date,
                   u.name as rated_by_name, u.company as rated_by_company
            FROM ratings r
            LEFT JOIN projects p ON r.project_id = p.id
            LEFT JOIN users u ON r.rated_by_user_id = u.id
            WHERE r.rated_user_id = ?
            ORDER BY r.created_at DESC
        `;
        return db.all(sql, [userId]);
    }
    
    static async getByProjectAndRater(projectId, raterId) {
        const sql = `
            SELECT * FROM ratings 
            WHERE project_id = ? AND rated_by_user_id = ?
        `;
        return db.get(sql, [projectId, raterId]);
    }
    
    static async getAverageRatings(userId) {
        const sql = `
            SELECT 
                AVG(price) as avg_price,
                AVG(speed) as avg_speed,
                AVG(quality) as avg_quality,
                AVG(responsiveness) as avg_responsiveness,
                AVG(customer_satisfaction) as avg_customer_satisfaction,
                COUNT(*) as count
            FROM ratings
            WHERE rated_user_id = ?
        `;
        return db.get(sql, [userId]);
    }
    
    static async delete(id) {
        const sql = `DELETE FROM ratings WHERE id = ?`;
        return db.run(sql, [id]);
    }
}

module.exports = RatingModel;