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
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Check access rights (same as above)
        let hasAccess = false;
        
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (file.uploaded_by === req.user.id) {
            hasAccess = true;
        } else if (file.project_id) {
            const project = await ProjectModel.getById(file.project_id);
            if (project && (project.project_manager_id === req.user.id || project.awarded_to === req.user.id)) {
                hasAccess = true;
            }
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
        
        // Send file
        res.download(file.file_path, file.original_name, (err) => {
            if (err) {
                logger.error('Error downloading file:', err);
                res.status(500).json({ error: 'Failed to download file' });
            }
        });
    } catch (error) {
        logger.error('Error downloading file:', error);
        res.status(500).json({ error: 'Failed to download file' });
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
        
        // Check access rights
        let hasAccess = false;
        if (req.user.role === 'admin') {
            hasAccess = true;
        } else if (project.project_manager_id === req.user.id) {
            hasAccess = true;
        } else if (project.awarded_to === req.user.id) {
            hasAccess = true;
        }
        
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
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

module.exports = router;