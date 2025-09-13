const db = require('./database');
const logger = require('../utils/logger');

class RegistrationTokenModel {
    // Create new registration token
    static async create(data) {
        const query = `
            INSERT INTO registration_tokens (
                email, token_hash, verification_code, 
                expires_at, ip_address, user_agent, temp_data
            ) VALUES (?, ?, ?, datetime('now', '+1 hour'), ?, ?, ?)
        `;
        
        const result = await db.run(query, [
            data.email,
            data.token_hash,
            data.verification_code,
            data.ip_address || null,
            data.user_agent || null,
            data.temp_data || null
        ]);
        
        return result.lastID;
    }
    
    // Get token by hash
    static async getByTokenHash(tokenHash) {
        const query = `
            SELECT * FROM registration_tokens 
            WHERE token_hash = ? 
            AND expires_at > datetime('now')
            AND completed_at IS NULL
        `;
        
        return await db.get(query, [tokenHash]);
    }
    
    // Get token by ID
    static async getById(id) {
        return await db.get(
            'SELECT * FROM registration_tokens WHERE id = ?', 
            [id]
        );
    }
    
    // Verify code for token
    static async verifyCode(tokenHash, code) {
        const token = await this.getByTokenHash(tokenHash);
        
        if (!token) {
            return { valid: false, error: 'Invalid or expired token' };
        }
        
        // Check attempts
        if (token.attempts >= 5) {
            return { valid: false, error: 'Too many attempts. Please request a new registration link.' };
        }
        
        // Increment attempts
        await db.run(
            'UPDATE registration_tokens SET attempts = attempts + 1 WHERE id = ?',
            [token.id]
        );
        
        // Check code
        if (token.verification_code !== code) {
            return { valid: false, error: 'Invalid verification code' };
        }
        
        // Mark as verified
        await db.run(
            'UPDATE registration_tokens SET verified_at = datetime("now") WHERE id = ?',
            [token.id]
        );
        
        return { valid: true, token };
    }
    
    // Update temp data
    static async updateTempData(id, tempData) {
        await db.run(
            'UPDATE registration_tokens SET temp_data = ? WHERE id = ?',
            [JSON.stringify(tempData), id]
        );
    }
    
    // Mark as completed
    static async markAsCompleted(id) {
        await db.run(
            'UPDATE registration_tokens SET completed_at = datetime("now") WHERE id = ?',
            [id]
        );
    }
    
    // Get recent attempts count for email
    static async getRecentAttempts(email, hours = 1) {
        const query = `
            SELECT COUNT(*) as count 
            FROM registration_tokens 
            WHERE email = ? 
            AND created_at > datetime('now', '-${hours} hours')
        `;
        
        const result = await db.get(query, [email]);
        return result.count;
    }
    
    // Invalidate all tokens for email
    static async invalidateAllEmailTokens(email) {
        await db.run(
            'UPDATE registration_tokens SET expires_at = datetime("now") WHERE email = ? AND completed_at IS NULL',
            [email]
        );
    }
    
    // Clean up expired tokens
    static async cleanupExpired() {
        const query = `
            DELETE FROM registration_tokens 
            WHERE expires_at < datetime('now', '-24 hours') 
            OR completed_at < datetime('now', '-7 days')
        `;
        
        const result = await db.run(query);
        logger.info(`Cleaned up ${result.changes} expired registration tokens`);
        return result.changes;
    }
}

module.exports = RegistrationTokenModel;