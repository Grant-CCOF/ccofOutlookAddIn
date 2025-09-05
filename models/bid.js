const db = require('./database');
const logger = require('../utils/logger');

class BidModel {
    static async create(bidData) {
        // For admin test bids, find the next bid number
        let bidNumber = 1;
        let isTestBid = 0;
        
        if (bidData.user_role === 'admin') {
            isTestBid = 1;
            // Get the highest bid number for this user/project combination
            const existingBids = await db.get(
                'SELECT MAX(bid_number) as max_num FROM bids WHERE user_id = ? AND project_id = ?',
                [bidData.user_id, bidData.project_id]
            );
            
            if (existingBids && existingBids.max_num) {
                bidNumber = existingBids.max_num + 1;
            }
        }
        
        const sql = `
            INSERT INTO bids (project_id, user_id, amount, comments, alternate_delivery_date, status, bid_number, is_test_bid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            bidData.project_id,
            bidData.user_id,
            bidData.amount,
            bidData.comments || null,
            bidData.alternate_delivery_date || null,
            bidData.status || 'pending',
            bidNumber,
            isTestBid
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating bid:', error);
            throw error;
        }
    }

    // Get a specific user's bid for a project
    static async getUserBidForProject(userId, projectId, includeTestBids = false) {
        let sql = `
            SELECT * FROM bids 
            WHERE user_id = ? AND project_id = ?
        `;
        
        if (!includeTestBids) {
            sql += ' AND is_test_bid = 0';
        }
        
        sql += ' ORDER BY bid_number DESC LIMIT 1';
        
        return db.get(sql, [userId, projectId]);
    }
    
    static async getById(id) {
        const sql = `
            SELECT b.*, 
                u.name as user_name, 
                u.username as username,
                u.company as company
            FROM bids b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.id = ?
        `;
        
        const bid = await db.get(sql, [id]);
        
        if (bid) {
            bid.bidder_display = bid.user_name || bid.username || bid.company || 'Unknown Bidder';
        }
        
        return bid;
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
            SELECT b.*, 
                u.name as user_name, 
                u.username as username,
                u.company as company, 
                u.email as user_email
            FROM bids b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.project_id = ?
            ORDER BY b.amount ASC
        `;
        
        const bids = await db.all(sql, [projectId]);
        
        // Format bidder display name for each bid
        return bids.map(bid => ({
            ...bid,
            bidder_display: bid.user_name || bid.username || bid.company || 'Unknown Bidder'
        }));
    }

    static async getProjectBidStats(projectId) {
        const sql = `
            SELECT 
                COUNT(*) as count,
                MIN(amount) as min_amount,
                MAX(amount) as max_amount,
                AVG(amount) as avg_amount
            FROM bids 
            WHERE project_id = ?
        `;
        
        try {
            const result = await db.get(sql, [projectId]);
            return {
                count: result.count || 0,
                min_amount: result.min_amount || null,
                max_amount: result.max_amount || null,
                avg_amount: result.avg_amount || null
            };
        } catch (error) {
            logger.error('Error getting project bid stats:', error);
            return {
                count: 0,
                min_amount: null,
                max_amount: null,
                avg_amount: null
            };
        }
    }
    
    static async getUserBidForProject(userId, projectId) {
        const sql = `SELECT * FROM bids WHERE user_id = ? AND project_id = ?`;
        return db.get(sql, [userId, projectId]);
    }
    
    static async updateStatus(id, status) {
        const sql = `UPDATE bids SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, [status, id]);
    }
    
    static async updateProjectBidsStatus(projectId, winnerId, awardComment = null) {
        // Update winning bid with award comment
        await db.run(
            `UPDATE bids SET status = 'won', award_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [awardComment, winnerId]
        );
        
        // Update losing bids
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

    static async deleteByProject(projectId) {
        const sql = `DELETE FROM bids WHERE project_id = ?`;
        
        try {
            const result = await db.run(sql, [projectId]);
            return result.changes;
        } catch (error) {
            logger.error('Error deleting bids by project:', error);
            throw error;
        }
    }

    static async getByProject(projectId) {
        const sql = `
            SELECT b.*, 
                u.name as user_name, 
                u.company as user_company
            FROM bids b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.project_id = ?
            ORDER BY b.created_at DESC
        `;
        
        try {
            return await db.all(sql, [projectId]);
        } catch (error) {
            logger.error('Error getting bids by project:', error);
            throw error;
        }
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