const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const FileModel = require('../models/file');
const logger = require('../utils/logger');

class FileService {
    static getUploadPath(type = 'general') {
        // Use environment variable for upload directory, with fallback
        const baseDir = process.env.UPLOAD_DIR || '/opt/capital-choice/uploads';
        const typeDir = path.join(baseDir, type);
        return typeDir;
    }
    
    static generateFileName(originalName) {
        const ext = path.extname(originalName);
        const hash = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        return `${timestamp}-${hash}${ext}`;
    }
    
    static async ensureUploadDirectories() {
        const dirs = [
            'uploads',
            'uploads/projects',
            'uploads/bids',
            'uploads/avatars',
            'uploads/temp'
        ];
        
        for (const dir of dirs) {
            const dirPath = path.join(process.cwd(), dir);
            try {
                await fs.mkdir(dirPath, { recursive: true });
                logger.info(`Upload directory ensured: ${dir}`);
            } catch (error) {
                logger.error(`Error creating directory ${dir}:`, error);
            }
        }
    }
    
    static async saveFile(file, type = 'general') {
        try {
            const uploadPath = this.getUploadPath(type);
            const fileName = this.generateFileName(file.originalname);
            const absolutePath = path.join(uploadPath, fileName);
            
            // Ensure directory exists
            await fs.mkdir(uploadPath, { recursive: true });
            
            // Save the actual file
            if (file.buffer) {
                await fs.writeFile(absolutePath, file.buffer);
            } else if (file.path) {
                await fs.rename(file.path, absolutePath);
            }
            
            // Store RELATIVE path in database (e.g., "bids/filename.pdf")
            const relativePath = path.join(type, fileName);
            
            return {
                original_name: file.originalname,
                file_name: fileName,
                file_path: relativePath,  // Store relative path, not absolute
                file_size: file.size,
                mime_type: file.mimetype
            };
        } catch (error) {
            logger.error('Error saving file:', error);
            throw error;
        }
    }
    
    static async deleteFile(filePath) {
        try {
            // If it's a relative path, convert to absolute
            const uploadDir = process.env.UPLOAD_DIR || '/opt/capital-choice/uploads';
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(uploadDir, filePath);
                
            await fs.unlink(absolutePath);
            logger.info(`File deleted: ${absolutePath}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.warn(`File not found for deletion: ${absolutePath}`);
                return false;
            }
            logger.error(`Error deleting file:`, error);
            throw error;
        }
    }
    
    static async deleteProjectFiles(projectId) {
        try {
            const files = await FileModel.getByProject(projectId);
            
            for (const file of files) {
                await this.deleteFile(file.file_path);
            }
            
            await FileModel.deleteByProject(projectId);
            logger.info(`Deleted ${files.length} files for project ${projectId}`);
            
            return true;
        } catch (error) {
            logger.error(`Error deleting project files:`, error);
            return false;
        }
    }
    
    static async deleteBidFiles(bidId) {
        try {
            const files = await FileModel.getByBid(bidId);
            
            for (const file of files) {
                await this.deleteFile(file.file_path);
            }
            
            await FileModel.deleteByBid(bidId);
            logger.info(`Deleted ${files.length} files for bid ${bidId}`);
            
            return true;
        } catch (error) {
            logger.error(`Error deleting bid files:`, error);
            return false;
        }
    }
    
    static async getFileStats(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
            };
        } catch (error) {
            logger.error(`Error getting file stats for ${filePath}:`, error);
            return null;
        }
    }
    
    static async cleanupTempFiles(maxAge = 86400000) { // 24 hours default
        try {
            const tempDir = path.join(process.cwd(), 'uploads', 'temp');
            const files = await fs.readdir(tempDir);
            const now = Date.now();
            let deletedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtimeMs > maxAge) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }
            
            logger.info(`Cleaned up ${deletedCount} temp files`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up temp files:', error);
            return 0;
        }
    }
    
    static async validateFile(file, options = {}) {
        const errors = [];
        
        // Check file size
        const maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
        if (file.size > maxSize) {
            errors.push(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
        }
        
        // Check file type
        if (options.allowedTypes) {
            const fileExt = path.extname(file.originalname).toLowerCase();
            if (!options.allowedTypes.includes(fileExt)) {
                errors.push(`File type ${fileExt} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`);
            }
        }
        
        // Check mime type
        if (options.allowedMimeTypes) {
            if (!options.allowedMimeTypes.includes(file.mimetype)) {
                errors.push(`MIME type ${file.mimetype} is not allowed`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = FileService;