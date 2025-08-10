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
            SELECT p.*, u.name as project_manager_name, u.email as project_manager_email,
                   aw.name as awarded_to_name, aw.company as awarded_to_company
            FROM projects p
            LEFT JOIN users u ON p.project_manager_id = u.id
            LEFT JOIN users aw ON p.awarded_to = aw.id
            WHERE p.id = ?
        `;
        const project = await db.get(sql, [id]);
        
        if (project) {
            if (project.site_conditions) project.site_conditions = JSON.parse(project.site_conditions);
            if (project.custom_fields) project.custom_fields = JSON.parse(project.custom_fields);
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
            SELECT p.*, COUNT(DISTINCT b.id) as bid_count
            FROM projects p
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
    
    static async delete(id) {
        const sql = `DELETE FROM projects WHERE id = ?`;
        return db.run(sql, [id]);
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
}

module.exports = ProjectModel;