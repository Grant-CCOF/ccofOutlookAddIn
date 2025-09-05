const db = require('./database');
const logger = require('../utils/logger');

class ProjectModel {
    static async create(projectData) {
        const sql = `
            INSERT INTO projects (
                title, description, status, project_manager_id, zip_code,
                delivery_date, delivery_time, bid_due_date, max_bid, show_max_bid,
                site_conditions, custom_fields
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            projectData.title,
            projectData.description,
            projectData.status || 'draft',
            projectData.project_manager_id,
            projectData.zip_code,
            projectData.delivery_date,
            projectData.delivery_time || null,
            projectData.bid_due_date,
            projectData.max_bid || null,
            projectData.show_max_bid !== false ? 1 : 0,
            JSON.stringify(projectData.site_conditions || []),
            JSON.stringify(projectData.custom_fields || {})
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating project:', error);
            throw error;
        }
    }
    
    static async getById(id) {
        const sql = `
            SELECT p.*, 
                u.name as project_manager_name, 
                u.username as project_manager_username,
                u.email as project_manager_email,
                u.company as project_manager_company,
                aw.name as awarded_to_name, 
                aw.company as awarded_to_company
            FROM projects p
            LEFT JOIN users u ON p.project_manager_id = u.id
            LEFT JOIN users aw ON p.awarded_to = aw.id
            WHERE p.id = ?
        `;
        
        const project = await db.get(sql, [id]);
        
        if (project) {
            // Parse JSON fields
            if (project.site_conditions) {
                project.site_conditions = JSON.parse(project.site_conditions);
            }
            if (project.custom_fields) {
                project.custom_fields = JSON.parse(project.custom_fields);
            }
            
            // Format the submitter display name
            project.submitter_display = project.project_manager_name || 
                                    project.project_manager_username || 
                                    'Unknown';
        }
        
        return project;
    }
    
    static async getAll() {
        const sql = `
            SELECT p.*, u.name as project_manager_name, u.email as project_manager_email,
                   aw.name as awarded_to_name, aw.company as awarded_to_company,
                   COUNT(DISTINCT b.id) as bid_count
            FROM projects p
            LEFT JOIN users u ON p.project_manager_id = u.id
            LEFT JOIN users aw ON p.awarded_to = aw.id
            LEFT JOIN bids b ON p.id = b.project_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        const projects = await db.all(sql);
        
        return projects.map(project => {
            if (project.site_conditions) project.site_conditions = JSON.parse(project.site_conditions);
            if (project.custom_fields) project.custom_fields = JSON.parse(project.custom_fields);
            return project;
        });
    }
    
    static async getByManager(managerId) {
        const sql = `
            SELECT p.*, 
                u.name as project_manager_name,
                u.email as project_manager_email,
                COUNT(DISTINCT b.id) as bid_count
            FROM projects p
            LEFT JOIN users u ON p.project_manager_id = u.id
            LEFT JOIN bids b ON p.id = b.project_id
            WHERE p.project_manager_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `;
        return db.all(sql, [managerId]);
    }
    
    static async getByStatus(status) {
        const sql = `
            SELECT p.*, u.name as project_manager_name, u.email as project_manager_email
            FROM projects p
            LEFT JOIN users u ON p.project_manager_id = u.id
            WHERE p.status = ?
            ORDER BY p.created_at DESC
        `;
        return db.all(sql, [status]);
    }
    
    static async update(id, updates) {
        // Handle JSON fields
        if (updates.site_conditions !== undefined) {
            updates.site_conditions = JSON.stringify(updates.site_conditions || []);
        }
        if (updates.custom_fields !== undefined) {
            updates.custom_fields = JSON.stringify(updates.custom_fields || {});
        }
        
        // Handle boolean to integer conversion for SQLite
        if (updates.show_max_bid !== undefined) {
            updates.show_max_bid = updates.show_max_bid ? 1 : 0;
        }
        
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);
        
        const sql = `UPDATE projects SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, values);
    }
    
    static async updateStatus(id, status) {
        const sql = `UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, [status, id]);
    }
    
    static async awardProject(projectId, bidId, amount) {
        const sql = `
            UPDATE projects 
            SET status = 'awarded', 
                awarded_to = (SELECT user_id FROM bids WHERE id = ?),
                awarded_amount = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        return db.run(sql, [bidId, amount, projectId]);
    }

    static async getCountByManager(managerId) {
        const sql = `SELECT COUNT(*) as count FROM projects WHERE project_manager_id = ?`;
        try {
            const result = await db.get(sql, [managerId]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error getting project count by manager:', error);
            return 0;
        }
    }

    static async getCountByManagerAndStatus(managerId, status) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM projects 
            WHERE project_manager_id = ? AND status = ?
        `;
        try {
            const result = await db.get(sql, [managerId, status]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error getting project count by manager and status:', error);
            return 0;
        }
    }

    static async getCompletionRate(managerId) {
        const sql = `
            SELECT 
                COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / 
                NULLIF(COUNT(*), 0) as rate
            FROM projects 
            WHERE project_manager_id = ?
        `;
        try {
            const result = await db.get(sql, [managerId]);
            return result ? (result.rate || 0) : 0;
        } catch (error) {
            logger.error('Error getting completion rate:', error);
            return 0;
        }
    }

    static async getCountByPeriod(days) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM projects 
            WHERE created_at >= datetime('now', '-' || ? || ' days')
        `;
        try {
            const result = await db.get(sql, [days]);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Error getting project count by period:', error);
            return 0;
        }
    }

    static async getRecent(limit = 5) {
        const sql = `
            SELECT p.*, u.name as project_manager_name 
            FROM projects p
            LEFT JOIN users u ON p.project_manager_id = u.id
            ORDER BY p.created_at DESC 
            LIMIT ?
        `;
        try {
            return await db.all(sql, [limit]);
        } catch (error) {
            logger.error('Error getting recent projects:', error);
            return [];
        }
    }

    static async getRecentByManager(managerId, limit = 5) {
        const sql = `
            SELECT * FROM projects 
            WHERE project_manager_id = ?
            ORDER BY created_at DESC 
            LIMIT ?
        `;
        try {
            return await db.all(sql, [managerId, limit]);
        } catch (error) {
            logger.error('Error getting recent projects by manager:', error);
            return [];
        }
    }
    
    static async delete(id) {
        const sql = `DELETE FROM projects WHERE id = ?`;
        
        try {
            const result = await db.run(sql, [id]);
            return result.changes > 0;
        } catch (error) {
            logger.error('Error deleting project:', error);
            throw error;
        }
    }
    
    static async getCount() {
        const sql = `SELECT COUNT(*) as count FROM projects`;
        const result = await db.get(sql);
        return result.count;
    }
    
    static async getCountByStatus(status) {
        const sql = `SELECT COUNT(*) as count FROM projects WHERE status = ?`;
        const result = await db.get(sql, [status]);
        return result.count;
    }

    static async markCompleted(id) {
        const sql = `UPDATE projects SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return db.run(sql, [id]);
    }
}

module.exports = ProjectModel;