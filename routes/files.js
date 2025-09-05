const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { param, body } = require('express-validator');
const FileModel = require('../models/file');
const ProjectModel = require('../models/project');
const BidModel = require('../models/bid');
const fileService = require('../services/fileService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const fsSync = require('fs');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedTypes = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx',
            '.jpg', '.jpeg', '.png', '.gif',
            '.txt', '.csv', '.zip'
        ];
        
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not allowed`));
        }
    }
});

// Generic file upload endpoint
router.post('/upload', [
    authenticateToken,
    upload.single('file'),
    body('project_id').optional().isInt(),
    body('bid_id').optional().isInt(),
    handleValidationErrors
], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { project_id, bid_id } = req.body;
        
        // Validate that either project_id or bid_id is provided
        if (!project_id && !bid_id) {
            return res.status(400).json({ error: 'Either project_id or bid_id must be provided' });
        }
        
        // Validate access for project files
        if (project_id) {
            const project = await ProjectModel.getById(project_id);
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            // Check permissions
            if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
                if (req.user.role !== 'admin') {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
            
            // Save file
            const fileData = await fileService.saveFile(req.file, 'projects');
            
            // Create database record
            const fileId = await FileModel.create({
                ...fileData,
                uploaded_by: req.user.id,
                project_id: project_id
            });
            
            const file = await FileModel.getById(fileId);
            
            logger.info(`File uploaded for project ${project_id}: ${file.original_name}`);
            
            return res.status(201).json(file);
        }
        
        // Validate access for bid files
        if (bid_id) {
            const bid = await BidModel.getById(bid_id);
            if (!bid) {
                return res.status(404).json({ error: 'Bid not found' });
            }
            
            // Check ownership
            if (bid.user_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Save file
            const fileData = await fileService.saveFile(req.file, 'bids');
            
            // Create database record
            const fileId = await FileModel.create({
                ...fileData,
                uploaded_by: req.user.id,
                bid_id: bid_id
            });
            
            const file = await FileModel.getById(fileId);
            
            logger.info(`File uploaded for bid ${bid_id}: ${file.original_name}`);
            
            return res.status(201).json(file);
        }
        
    } catch (error) {
        logger.error('Error uploading file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Upload file for project
router.post('/project/:projectId', [
    authenticateToken,
    upload.single('file'),
    param('projectId').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const project = await ProjectModel.getById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        // Check access rights
        if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Save file
        const fileData = await fileService.saveFile(req.file, 'projects');
        
        // Create database record
        const fileId = await FileModel.create({
            ...fileData,
            uploaded_by: req.user.id,
            project_id: project.id
        });
        
        const file = await FileModel.getById(fileId);
        
        logger.info(`File uploaded for project ${project.id}: ${file.original_name}`);
        
        res.status(201).json(file);
    } catch (error) {
        logger.error('Error uploading project file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Upload file for bid
router.post('/bid/:bidId', [
    authenticateToken,
    upload.single('file'),
    param('bidId').isInt().withMessage('Valid bid ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const bid = await BidModel.getById(req.params.bidId);
        
        if (!bid) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        // Check ownership
        if (bid.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Save file
        const fileData = await fileService.saveFile(req.file, 'bids');
        
        // Create database record
        const fileId = await FileModel.create({
            ...fileData,
            uploaded_by: req.user.id,
            bid_id: bid.id
        });
        
        const file = await FileModel.getById(fileId);
        
        logger.info(`File uploaded for bid ${bid.id}: ${file.original_name}`);
        
        res.status(201).json(file);
    } catch (error) {
        logger.error('Error uploading bid file:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Upload multiple files
router.post('/multiple', [
    authenticateToken,
    upload.array('files', 10), // Max 10 files at once
    body('project_id').optional().isInt(),
    body('bid_id').optional().isInt(),
    handleValidationErrors
], async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const { project_id, bid_id } = req.body;
        
        // Validate access if project_id or bid_id provided
        if (project_id) {
            const project = await ProjectModel.getById(project_id);
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            if (req.user.role === 'project_manager' && project.project_manager_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        if (bid_id) {
            const bid = await BidModel.getById(bid_id);
            if (!bid) {
                return res.status(404).json({ error: 'Bid not found' });
            }
            if (bid.user_id !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        const uploadedFiles = [];
        
        for (const file of req.files) {
            try {
                const fileData = await fileService.saveFile(
                    file, 
                    project_id ? 'projects' : bid_id ? 'bids' : 'general'
                );
                
                const fileId = await FileModel.create({
                    ...fileData,
                    uploaded_by: req.user.id,
                    project_id: project_id || null,
                    bid_id: bid_id || null
                });
                
                const savedFile = await FileModel.getById(fileId);
                uploadedFiles.push(savedFile);
            } catch (error) {
                logger.error(`Error uploading file ${file.originalname}:`, error);
            }
        }
        
        logger.info(`${uploadedFiles.length} files uploaded by user ${req.user.id}`);
        
        res.status(201).json({
            message: `${uploadedFiles.length} files uploaded successfully`,
            files: uploadedFiles
        });
    } catch (error) {
        logger.error('Error uploading multiple files:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// Get file info
router.get('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid file ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const file = await FileModel.getById(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Check access rights
        let hasAccess = false;
        
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (file.uploaded_by === req.user.id) {
            hasAccess = true;
        } else if (file.project_id) {
            const project = await ProjectModel.getById(file.project_id);
            if (project && project.project_manager_id === req.user.id) {
                hasAccess = true;
            }
        } else if (file.bid_id) {
            const bid = await BidModel.getById(file.bid_id);
            if (bid && bid.user_id === req.user.id) {
                hasAccess = true;
            }
        }
        
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(file);
    } catch (error) {
        logger.error('Error fetching file info:', error);
        res.status(500).json({ error: 'Failed to fetch file info' });
    }
});

// Download file
router.get('/:id/download', [
    authenticateToken,
    param('id').isInt().withMessage('Valid file ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const file = await FileModel.getById(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'File not found in database' });
        }
        
        // Check access rights (keeping your existing logic)
        let hasAccess = false;
        
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (file.uploaded_by === req.user.id) {
            hasAccess = true;
        } else if (file.project_id) {
            hasAccess = true;
        } else if (file.bid_id) {
            const bid = await BidModel.getById(file.bid_id);
            if (bid) {
                const project = await ProjectModel.getById(bid.project_id);
                if (bid.user_id === req.user.id || (project && project.project_manager_id === req.user.id)) {
                    hasAccess = true;
                }
            }
        }
        
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get the absolute file path
        const absolutePath = await fileService.getFilePath(file.file_path);
        
        // Enhanced error checking with detailed logging
        try {
            // Check if file exists
            await fs.access(absolutePath, fs.constants.F_OK);
            logger.info(`File exists: ${absolutePath}`);
            
            // Check if file is readable
            await fs.access(absolutePath, fs.constants.R_OK);
            logger.info(`File is readable: ${absolutePath}`);
            
            // Get file stats for additional verification
            const stats = await fs.stat(absolutePath);
            logger.info(`File stats - Size: ${stats.size}, Mode: ${stats.mode.toString(8)}`);
            
        } catch (err) {
            // Detailed error logging
            logger.error(`File access error for path: ${absolutePath}`);
            logger.error(`Error code: ${err.code}`);
            logger.error(`Error message: ${err.message}`);
            
            // Check what's wrong
            if (err.code === 'ENOENT') {
                logger.error('File does not exist on filesystem');
                return res.status(404).json({ 
                    error: 'File not found on server',
                    details: 'The file exists in database but not on filesystem',
                    path: file.file_path // Don't expose absolute path to client
                });
            } else if (err.code === 'EACCES') {
                logger.error('Permission denied to access file');
                
                // Log current process info for debugging
                logger.error(`Process UID: ${process.getuid()}, GID: ${process.getgid()}`);
                logger.error(`Process user: ${process.env.USER || 'unknown'}`);
                
                // Try to get file permissions for debugging
                try {
                    const stats = await fs.stat(absolutePath);
                    logger.error(`File permissions: ${(stats.mode & parseInt('777', 8)).toString(8)}`);
                    logger.error(`File owner UID: ${stats.uid}, GID: ${stats.gid}`);
                } catch (statErr) {
                    logger.error('Could not stat file for debugging');
                }
                
                return res.status(500).json({ 
                    error: 'Server configuration error',
                    details: 'File exists but cannot be accessed. Please contact administrator.'
                });
            } else {
                logger.error(`Unknown file access error: ${err.code}`);
                return res.status(500).json({ 
                    error: 'Failed to access file',
                    details: 'An unexpected error occurred'
                });
            }
        }
        
        // Use streaming for better performance and error handling
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`);
        res.setHeader('Content-Length', file.file_size);
        
        // Create read stream and pipe to response
        const readStream = fsSync.createReadStream(absolutePath);
        
        readStream.on('error', (err) => {
            logger.error('Error streaming file:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });
        
        readStream.on('open', () => {
            logger.info(`Streaming file: ${file.original_name} to user ${req.user.id}`);
        });
        
        readStream.on('end', () => {
            logger.info(`File download completed: ${file.original_name}`);
        });
        
        readStream.pipe(res);
        
    } catch (error) {
        logger.error('Unexpected error in download endpoint:', error);
        res.status(500).json({ error: 'Failed to process download request' });
    }
});

// Delete file
router.delete('/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid file ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const file = await FileModel.getById(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Check ownership or admin
        if (file.uploaded_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Delete physical file
        await fileService.deleteFile(file.file_path);
        
        // Delete database record
        await FileModel.delete(req.params.id);
        
        logger.info(`File deleted: ${file.original_name} by user ${req.user.id}`);
        
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        logger.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Get files for project
router.get('/project/:projectId/list', [
    authenticateToken,
    param('projectId').isInt().withMessage('Valid project ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const project = await ProjectModel.getById(req.params.projectId);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const files = await FileModel.getByProject(req.params.projectId);
        
        res.json(files);
    } catch (error) {
        logger.error('Error fetching project files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Get files for bid
router.get('/bid/:bidId/list', [
    authenticateToken,
    param('bidId').isInt().withMessage('Valid bid ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const bid = await BidModel.getById(req.params.bidId);
        
        if (!bid) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        // Check access rights
        let hasAccess = false;
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (bid.user_id === req.user.id) {
            hasAccess = true;
        } else {
            const project = await ProjectModel.getById(bid.project_id);
            if (project && project.project_manager_id === req.user.id) {
                hasAccess = true;
            }
        }
        
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const files = await FileModel.getByBid(req.params.bidId);
        
        res.json(files);
    } catch (error) {
        logger.error('Error fetching bid files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Upload certification for user profile
router.post('/certification', [
    authenticateToken,
    upload.single('file'),
    body('description').optional().isString(),
    handleValidationErrors
], async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { description } = req.body;
        
        // Validate file type (only allow certain types for certifications)
        const allowedCertTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        if (!allowedCertTypes.includes(ext)) {
            return res.status(400).json({ 
                error: 'Invalid file type. Certifications must be PDF, JPG, PNG, DOC, or DOCX' 
            });
        }
        
        // Save file
        const fileData = await fileService.saveFile(req.file, 'certifications');
        
        // Create database record
        const fileId = await FileModel.create({
            ...fileData,
            uploaded_by: req.user.id,
            user_id: req.user.id,
            file_type: 'certification',
            description: description || null
        });
        
        const file = await FileModel.getById(fileId);
        
        logger.info(`Certification uploaded for user ${req.user.id}: ${file.original_name}`);
        
        res.status(201).json(file);
    } catch (error) {
        logger.error('Error uploading certification:', error);
        res.status(500).json({ error: 'Failed to upload certification' });
    }
});

// Get user certifications
router.get('/user/:userId/certifications', [
    authenticateToken,
    param('userId').isInt().withMessage('Valid user ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const certifications = await FileModel.getUserCertifications(req.params.userId);
        
        res.json(certifications);
    } catch (error) {
        logger.error('Error fetching user certifications:', error);
        res.status(500).json({ error: 'Failed to fetch certifications' });
    }
});

// Delete certification
router.delete('/certification/:id', [
    authenticateToken,
    param('id').isInt().withMessage('Valid file ID required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const file = await FileModel.getById(req.params.id);
        
        if (!file) {
            return res.status(404).json({ error: 'Certification not found' });
        }
        
        // Check ownership (only owner or admin can delete)
        if (file.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Delete file from filesystem
        await fileService.deleteFile(file.file_path);
        
        // Delete from database
        await FileModel.delete(req.params.id);
        
        logger.info(`Certification deleted: ${file.original_name} by user ${req.user.id}`);
        
        res.json({ message: 'Certification deleted successfully' });
    } catch (error) {
        logger.error('Error deleting certification:', error);
        res.status(500).json({ error: 'Failed to delete certification' });
    }
});

module.exports = router;