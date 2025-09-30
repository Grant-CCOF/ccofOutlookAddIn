const db = require('./database');
const logger = require('../utils/logger');

class UserModel {
    // Modified create method with re-registration support
    static async create(userData) {
        try {
            // First check if email exists (including soft-deleted)
            const existingByEmail = await this.getByEmailIncludingDeleted(userData.email);
            
            // If email exists and is NOT soft-deleted, it's a conflict
            if (existingByEmail && !existingByEmail.deleted_at) {
                logger.error(`Email already in use by active user: ${userData.email}`);
                throw new Error('Email already registered');
            }
            
            // If email exists and IS soft-deleted, we'll reactivate
            if (existingByEmail && existingByEmail.deleted_at) {
                logger.info(`Found soft-deleted user with email: ${userData.email}, attempting reactivation`);
                
                // Check if the requested username is available
                const usernameCheck = await this.getByUsernameIncludingDeleted(userData.username);
                
                // Username conflict scenarios:
                // 1. Username belongs to a different active user -> conflict
                // 2. Username belongs to a different soft-deleted user -> conflict
                // 3. Username belongs to this same soft-deleted user -> OK to reuse
                // 4. Username doesn't exist -> OK to use
                
                if (usernameCheck && !usernameCheck.deleted_at && usernameCheck.id !== existingByEmail.id) {
                    // Username is in use by another active user
                    logger.error(`Username ${userData.username} already in use by active user`);
                    throw new Error('Username already exists');
                }
                
                if (usernameCheck && usernameCheck.deleted_at && usernameCheck.id !== existingByEmail.id) {
                    // Username belongs to a different soft-deleted user
                    logger.error(`Username ${userData.username} already in use by another user`);
                    throw new Error('Username already exists');
                }
                
                // If we get here, username is either:
                // - Available (doesn't exist)
                // - Belongs to the same soft-deleted user we're reactivating
                
                // Reactivate with new data
                return await this.reactivate(existingByEmail.id, userData);
            }
            
            // No email conflict, check username for new user creation
            const existingByUsername = await this.getByUsernameIncludingDeleted(userData.username);
            
            if (existingByUsername && !existingByUsername.deleted_at) {
                logger.error(`Username already in use: ${userData.username}`);
                throw new Error('Username already exists');
            }
            
            // All clear - create new user
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
            
            const result = await db.run(sql, params);
            logger.info(`New user created: ${userData.username} (${userData.email})`);
            return result.id;
            
        } catch (error) {
            logger.error('Error creating/reactivating user:', error);
            logger.error('Stack trace:', error.stack);
            throw error;
        }
    }

    // Check if a user exists (including soft-deleted)
    static async getByEmailIncludingDeleted(email) {
        const sql = `SELECT * FROM users WHERE email = ?`;
        return db.get(sql, [email]);
    }
    
    static async getByUsernameIncludingDeleted(username) {
        const sql = `SELECT * FROM users WHERE username = ?`;
        return db.get(sql, [username]);
    }

    // Generate a unique username variant if the original is taken
    static async generateUniqueUsername(baseUsername) {
        let username = baseUsername;
        let counter = 1;
        
        while (true) {
            const existing = await this.getByUsernameIncludingDeleted(username);
            if (!existing || existing.deleted_at) {
                // Username is available or belongs to a deleted user
                return username;
            }
            counter++;
            username = `${baseUsername}${counter}`;
        }
    }
    
    // Reactivate a soft-deleted user with new data
    static async reactivate(userId, userData) {
        const sql = `
            UPDATE users SET 
                username = ?,
                password = ?,
                name = ?,
                role = ?,
                company = ?,
                phone = ?,
                position = ?,
                approved = ?,
                suspended = ?,
                deleted_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const params = [
            userData.username,
            userData.password,
            userData.name,
            userData.role,
            userData.company || null,
            userData.phone || null,
            userData.position || null,
            userData.approved || 0,
            userData.suspended || 0,
            userId
        ];
        
        try {
            await db.run(sql, params);
            logger.info(`User reactivated: ID ${userId} with username ${userData.username}`);
            return userId;
        } catch (error) {
            logger.error('Error reactivating user:', error);
            throw error;
        }
    }

    static async getByIdIncludingDeleted(id) {
        const sql = `SELECT * FROM users WHERE id = ?`;
        return db.get(sql, [id]);
    }
    
    static async getById(userId) {
        try {
            const result = await db.get(
                `SELECT id, username, name, email, role, company, created_at, updated_at, approved, suspended
                FROM users 
                WHERE id = ?`,
                [userId]
            );
            
            return result || null;
        } catch (error) {
            logger.error('Error fetching user by ID:', error);
            throw error;
        }
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