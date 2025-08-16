const db = require('./database');
const logger = require('../utils/logger');

class UserModel {
    static async create(userData) {
        const sql = `
            INSERT INTO users (username, password, name, email, role, company, phone, position, approved, suspended)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            userData.username,
            userData.password,
            userData.name,
            userData.email,
            userData.role,
            userData.company || null,
            userData.phone || null,
            userData.position || null,
            userData.approved || 0,
            userData.suspended || 0
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating user:', error);
            throw error;
        }
    }
    
    static async getById(id) {
        const sql = `SELECT * FROM users WHERE id = ? AND deleted_at IS NULL`;
        return db.get(sql, [id]);
    }

    static async getByIdWithStats(id) {
        const sql = `
            SELECT u.*, 
                COUNT(DISTINCT p.id) as projects_count,
                COUNT(DISTINCT b.id) as bids_count,
                AVG((r.price + r.speed + r.quality + r.responsiveness + r.customer_satisfaction) / 5.0) as avg_rating,
                COUNT(DISTINCT r.id) as ratings_count
            FROM users u
            LEFT JOIN projects p ON u.id = p.project_manager_id
            LEFT JOIN bids b ON u.id = b.user_id
            LEFT JOIN ratings r ON u.id = r.rated_user_id
            WHERE u.id = ? AND u.deleted_at IS NULL
            GROUP BY u.id
        `;
        
        try {
            const user = await db.get(sql, [id]);
            return user;
        } catch (error) {
            logger.error('Error fetching user with stats:', error);
            throw error;
        }
    }

    static async getAverageRating(userId) {
        const sql = `
            SELECT AVG((price + speed + quality + responsiveness + customer_satisfaction) / 5.0) as average
            FROM ratings 
            WHERE rated_user_id = ?
        `;
        
        try {
            const result = await db.get(sql, [userId]);
            return result ? result.average : 0;
        } catch (error) {
            logger.error('Error fetching average rating:', error);
            return 0;
        }
    }

    static async getRatingCount(userId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM ratings 
            WHERE rated_user_id = ?
        `;
        
        try {
            const result = await db.get(sql, [userId]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error fetching rating count:', error);
            return 0;
        }
    }

    static async getGrowthByPeriod(days) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM users 
            WHERE deleted_at IS NULL 
            AND created_at >= datetime('now', '-' || ? || ' days')
        `;
        
        try {
            const result = await db.get(sql, [days]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error fetching user growth:', error);
            return 0;
        }
    }
    
    static async getByUsername(username) {
        const sql = `SELECT * FROM users WHERE username = ? AND deleted_at IS NULL`;
        return db.get(sql, [username]);
    }
    
    static async getByEmail(email) {
        const sql = `SELECT * FROM users WHERE email = ? AND deleted_at IS NULL`;
        return db.get(sql, [email]);
    }
    
    static async getAll() {
        const sql = `SELECT id, username, name, email, role, company, approved, suspended, created_at 
                     FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`;
        return db.all(sql);
    }
    
    static async getAllWithStats() {
        const sql = `
            SELECT u.*, 
                   COUNT(DISTINCT p.id) as projects_count,
                   COUNT(DISTINCT b.id) as bids_count,
                   AVG(r.price + r.speed + r.quality + r.responsiveness + r.customer_satisfaction) / 5 as avg_rating,
                   COUNT(DISTINCT r.id) as ratings_count
            FROM users u
            LEFT JOIN projects p ON u.id = p.project_manager_id
            LEFT JOIN bids b ON u.id = b.user_id
            LEFT JOIN ratings r ON u.id = r.rated_user_id
            WHERE u.deleted_at IS NULL
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `;
        return db.all(sql);
    }
    
    static async getRecent(limit = 5) {
        const sql = `
            SELECT id, username, name, email, role, company, approved, suspended, created_at 
            FROM users 
            WHERE deleted_at IS NULL 
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        try {
            return await db.all(sql, [limit]);
        } catch (error) {
            logger.error('Error getting recent users:', error);
            return [];
        }
    }

    // Also ensure these methods exist from the previous fix:
    static async getByIdWithStats(id) {
        const sql = `
            SELECT u.*, 
                COUNT(DISTINCT p.id) as projects_count,
                COUNT(DISTINCT b.id) as bids_count,
                AVG((r.price + r.speed + r.quality + r.responsiveness + r.customer_satisfaction) / 5.0) as avg_rating,
                COUNT(DISTINCT r.id) as ratings_count
            FROM users u
            LEFT JOIN projects p ON u.id = p.project_manager_id
            LEFT JOIN bids b ON u.id = b.user_id
            LEFT JOIN ratings r ON u.id = r.rated_user_id
            WHERE u.id = ? AND u.deleted_at IS NULL
            GROUP BY u.id
        `;
        
        try {
            const user = await db.get(sql, [id]);
            return user;
        } catch (error) {
            logger.error('Error fetching user with stats:', error);
            throw error;
        }
    }

    static async getAverageRating(userId) {
        const sql = `
            SELECT AVG((price + speed + quality + responsiveness + customer_satisfaction) / 5.0) as average
            FROM ratings 
            WHERE rated_user_id = ?
        `;
        
        try {
            const result = await db.get(sql, [userId]);
            return result ? result.average : 0;
        } catch (error) {
            logger.error('Error fetching average rating:', error);
            return 0;
        }
    }

    static async getRatingCount(userId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM ratings 
            WHERE rated_user_id = ?
        `;
        
        try {
            const result = await db.get(sql, [userId]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error fetching rating count:', error);
            return 0;
        }
    }

    static async getGrowthByPeriod(days) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM users 
            WHERE deleted_at IS NULL 
            AND created_at >= datetime('now', '-' || ? || ' days')
        `;
        
        try {
            const result = await db.get(sql, [days]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error fetching user growth:', error);
            return 0;
        }
    }

    static async update(id, updates) {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);
        
        const sql = `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, values);
    }
    
    static async updatePassword(id, hashedPassword) {
        const sql = `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, [hashedPassword, id]);
    }
    
    static async delete(id) {
        const sql = `UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, [id]);
    }
    
    static async getCount() {
        const sql = `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL`;
        const result = await db.get(sql);
        return result.count;
    }
    
    static async getCountPending() {
        const sql = `SELECT COUNT(*) as count FROM users WHERE approved = 0 AND deleted_at IS NULL`;
        const result = await db.get(sql);
        return result.count;
    }
    
    static async getCountByRole(role) {
        const sql = `SELECT COUNT(*) as count FROM users WHERE role = ? AND deleted_at IS NULL`;
        const result = await db.get(sql, [role]);
        return result.count;
    }
}

module.exports = UserModel;