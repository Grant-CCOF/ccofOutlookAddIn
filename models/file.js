const db = require('./database');
const logger = require('../utils/logger');

class FileModel {
    static async create(fileData) {
        const sql = `
            INSERT INTO files (
                original_name, file_name, file_path, file_size, mime_type,
                uploaded_by, project_id, bid_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            fileData.original_name,
            fileData.file_name,
            fileData.file_path,
            fileData.file_size,
            fileData.mime_type,
            fileData.uploaded_by,
            fileData.project_id || null,
            fileData.bid_id || null
        ];
        
        try {
            const result = await db.run(sql, params);
            return result.id;
        } catch (error) {
            logger.error('Error creating file record:', error);
            throw error;
        }
    }
    
    static async getById(id) {
        const sql = `
            SELECT f.*, u.name as uploaded_by_name
            FROM files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            WHERE f.id = ?
        `;
        return db.get(sql, [id]);
    }
    
    static async getByProject(projectId) {
        const sql = `
            SELECT f.*, u.name as uploaded_by_name
            FROM files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            WHERE f.project_id = ?
            ORDER BY f.created_at DESC
        `;
        return db.all(sql, [projectId]);
    }
    
    static async getByBid(bidId) {
        const sql = `
            SELECT f.*, u.name as uploaded_by_name
            FROM files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            WHERE f.bid_id = ?
            ORDER BY f.created_at DESC
        `;
        return db.all(sql, [bidId]);
    }

    static async getProjectFiles(projectId) {
        const sql = `
            SELECT f.*, 
                u.name as uploaded_by_name,
                u.username as uploaded_by_username
            FROM files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            WHERE f.project_id = ?
            ORDER BY f.created_at DESC
        `;
        
        const files = await db.all(sql, [projectId]);
        
        return files.map(file => ({
            ...file,
            uploader_display: file.uploaded_by_name || file.uploaded_by_username || 'Unknown'
        }));
    }

    static async getBidFiles(bidId) {
        const sql = `
            SELECT f.*, 
                u.name as uploaded_by_name,
                u.username as uploaded_by_username
            FROM files f
            LEFT JOIN users u ON f.uploaded_by = u.id
            WHERE f.bid_id = ?
            ORDER BY f.created_at DESC
        `;
        
        const files = await db.all(sql, [bidId]);
        
        return files.map(file => ({
            ...file,
            uploader_display: file.uploaded_by_name || file.uploaded_by_username || 'Unknown'
        }));
    }
    
    static async delete(id) {
        const sql = `DELETE FROM files WHERE id = ?`;
        return db.run(sql, [id]);
    }
    
    static async deleteByProject(projectId) {
        const sql = `DELETE FROM files WHERE project_id = ?`;
        return db.run(sql, [projectId]);
    }
    
    static async deleteByBid(bidId) {
        const sql = `DELETE FROM files WHERE bid_id = ?`;
        return db.run(sql, [bidId]);
    }
}

module.exports = FileModel;