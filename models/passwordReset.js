const db = require('./database');
const logger = require('../utils/logger');

class PasswordResetModel {
    static async create(resetData) {
        const sql = `
            INSERT INTO password_reset_tokens (
                user_id, token_hash, verification_code, 
                expires_at, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry
        
        const params = [
            resetData.user_id,
            resetData.token_hash,
            resetData.verification_code,
            expiresAt.toISOString(),
            resetData.ip_address || null,
            resetData.user_agent || null
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating password reset token:', error);
            throw error;
        }
    }
    
    static async findByTokenHash(tokenHash) {
        const sql = `
            SELECT prt.*, u.email, u.username, u.name 
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token_hash = ? 
            AND prt.expires_at > datetime('now')
            AND prt.used_at IS NULL
        `;
        
        try {
            return await db.get(sql, [tokenHash]);
        } catch (error) {
            logger.error('Error finding reset token:', error);
            throw error;
        }
    }
    
    static async verifyCode(tokenHash, code) {
        const sql = `
            SELECT * FROM password_reset_tokens
            WHERE token_hash = ?
            AND verification_code = ?
            AND expires_at > datetime('now')
            AND used_at IS NULL
            AND attempts < 5
        `;
        
        try {
            const token = await db.get(sql, [tokenHash, code]);
            
            if (!token) {
                // Increment attempts
                await db.run(
                    `UPDATE password_reset_tokens 
                     SET attempts = attempts + 1 
                     WHERE token_hash = ? AND used_at IS NULL`,
                    [tokenHash]
                );
                return null;
            }
            
            return token;
        } catch (error) {
            logger.error('Error verifying code:', error);
            throw error;
        }
    }
    
    static async setTempToken(tokenId, tempToken) {
        const sql = `
            UPDATE password_reset_tokens
            SET temp_token = ?,
                temp_token_expires_at = datetime('now', '+15 minutes')
            WHERE id = ?
        `;
        
        try {
            await db.run(sql, [tempToken, tokenId]);
        } catch (error) {
            logger.error('Error setting temp token:', error);
            throw error;
        }
    }
    
    static async findByTempToken(tempToken) {
        const sql = `
            SELECT prt.*, u.id as user_id, u.username 
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.temp_token = ?
            AND prt.temp_token_expires_at > datetime('now')
            AND prt.used_at IS NULL
        `;
        
        try {
            return await db.get(sql, [tempToken]);
        } catch (error) {
            logger.error('Error finding temp token:', error);
            throw error;
        }
    }
    
    static async markAsUsed(tokenId) {
        const sql = `
            UPDATE password_reset_tokens
            SET used_at = CURRENT_TIMESTAMP,
                temp_token = NULL
            WHERE id = ?
        `;
        
        try {
            await db.run(sql, [tokenId]);
        } catch (error) {
            logger.error('Error marking token as used:', error);
            throw error;
        }
    }
    
    static async invalidateAllUserTokens(userId) {
        const sql = `
            UPDATE password_reset_tokens
            SET used_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND used_at IS NULL
        `;
        
        try {
            await db.run(sql, [userId]);
        } catch (error) {
            logger.error('Error invalidating user tokens:', error);
            throw error;
        }
    }
    
    static async cleanupExpired() {
        const sql = `
            DELETE FROM password_reset_tokens
            WHERE expires_at < datetime('now', '-24 hours')
            OR (used_at IS NOT NULL AND used_at < datetime('now', '-7 days'))
        `;
        
        try {
            const result = await db.run(sql);
            if (result.changes > 0) {
                logger.info(`Cleaned up ${result.changes} expired password reset tokens`);
            }
        } catch (error) {
            logger.error('Error cleaning up expired tokens:', error);
        }
    }
    
    static async getRecentAttempts(userId, hours = 1) {
        const sql = `
            SELECT COUNT(*) as count
            FROM password_reset_tokens
            WHERE user_id = ?
            AND created_at > datetime('now', '-' || ? || ' hours')
        `;
        
        try {
            const result = await db.get(sql, [userId, hours]);
            return result.count;
        } catch (error) {
            logger.error('Error counting recent attempts:', error);
            return 0;
        }
    }
}

module.exports = PasswordResetModel;