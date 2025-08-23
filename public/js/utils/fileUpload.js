// Capital Choice Platform - File Upload Utilities

const FileUpload = {
    // Active uploads
    activeUploads: new Map(),
    
    // Upload configuration
    config: {
        maxFileSize: Config.MAX_FILE_SIZE,
        allowedTypes: Config.ALLOWED_FILE_TYPES,
        chunkSize: 1024 * 1024, // 1MB chunks for large files
        maxConcurrent: 3
    },
    
    // Initialize file upload area
    initUploadArea(containerId, options = {}) {
        const container = DOM.get(containerId);
        if (!container) return;
        
        const {
            multiple = false,
            allowedTypes = [],
            maxSize = this.config.maxFileSize,
            onUpload = null,
            onProgress = null,
            onComplete = null,
            onError = null
        } = options;
        
        // Create file input
        const fileInput = DOM.create('input', {
            type: 'file',
            multiple,
            accept: allowedTypes.join(','),
            style: { display: 'none' }
        });
        
        // Create upload area
        const uploadArea = DOM.create('div', {
            className: 'file-upload-area',
            innerHTML: `
                <div class="file-upload-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <div class="file-upload-text">
                    Drag and drop files here or click to browse
                </div>
                <div class="file-upload-hint">
                    ${this.getUploadHint(allowedTypes, maxSize)}
                </div>
            `
        });
        
        // Handle click
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files, {
                allowedTypes,
                maxSize,
                onUpload,
                onProgress,
                onComplete,
                onError
            });
        });
        
        // Handle drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragging');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragging');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragging');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files, {
                allowedTypes,
                maxSize,
                onUpload,
                onProgress,
                onComplete,
                onError
            });
        });
        
        // Add to container
        container.appendChild(fileInput);
        container.appendChild(uploadArea);
        
        // Create file list container
        const fileList = DOM.create('div', {
            className: 'file-list',
            id: `${containerId}-file-list`
        });
        container.appendChild(fileList);
        
        return {
            fileInput,
            uploadArea,
            fileList
        };
    },
    
    // Get upload hint text
    getUploadHint(allowedTypes, maxSize) {
        const types = allowedTypes.length > 0 
            ? `Allowed: ${allowedTypes.join(', ')}` 
            : 'All file types allowed';
        
        const size = `Max size: ${Formatter.fileSize(maxSize)}`;
        
        return `${types} • ${size}`;
    },
    
    // Handle files
    async handleFiles(files, options) {
        const {
            allowedTypes = [],
            maxSize = this.config.maxFileSize,
            onUpload = null,
            onProgress = null,
            onComplete = null,
            onError = null
        } = options;
        
        for (const file of files) {
            // Validate file
            const validation = this.validateFile(file, { allowedTypes, maxSize });
            
            if (!validation.valid) {
                if (onError) {
                    onError(file, validation.message);
                } else {
                    App.showError(validation.message);
                }
                continue;
            }
            
            // Upload file
            await this.uploadFile(file, {
                onProgress,
                onComplete,
                onError
            });
            
            if (onUpload) {
                onUpload(file);
            }
        }
    },
    
    // Validate file
    validateFile(file, options = {}) {
        const {
            allowedTypes = [],
            maxSize = this.config.maxFileSize
        } = options;
        
        // Check file size
        if (file.size > maxSize) {
            return {
                valid: false,
                message: `File "${file.name}" exceeds maximum size of ${Formatter.fileSize(maxSize)}`
            };
        }
        
        // Check file type
        if (allowedTypes.length > 0) {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            const mimeType = file.type;
            
            const isAllowed = allowedTypes.some(type => {
                if (type.startsWith('.')) {
                    return extension === type;
                }
                return mimeType.startsWith(type);
            });
            
            if (!isAllowed) {
                return {
                    valid: false,
                    message: `File type "${extension}" is not allowed`
                };
            }
        }
        
        return { valid: true };
    },
    
    // Upload file
    async uploadFile(file, options = {}) {
        const {
            endpoint = '/files/upload',
            onProgress = null,
            onComplete = null,
            onError = null,
            additionalData = {}
        } = options;
        
        const uploadId = this.generateUploadId();
        
        // Create upload tracker
        const upload = {
            id: uploadId,
            file,
            progress: 0,
            status: 'uploading',
            cancelToken: null
        };
        
        this.activeUploads.set(uploadId, upload);
        
        // Show upload progress
        this.showUploadProgress(upload);
        
        try {
            // Create form data
            const formData = new FormData();
            formData.append('file', file);
            
            // Add additional data
            Object.entries(additionalData).forEach(([key, value]) => {
                formData.append(key, value);
            });
            
            // Create XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const progress = Math.round((e.loaded / e.total) * 100);
                    upload.progress = progress;
                    
                    this.updateUploadProgress(uploadId, progress);
                    
                    if (onProgress) {
                        onProgress(file, progress);
                    }
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const response = JSON.parse(xhr.responseText);
                    upload.status = 'completed';
                    
                    this.completeUpload(uploadId);
                    
                    if (onComplete) {
                        onComplete(file, response);
                    }
                } else {
                    throw new Error(`Upload failed with status ${xhr.status}`);
                }
            });
            
            // Handle error
            xhr.addEventListener('error', () => {
                upload.status = 'error';
                const error = new Error('Upload failed');
                
                this.failUpload(uploadId, error.message);
                
                if (onError) {
                    onError(file, error.message);
                }
            });
            
            // Store cancel token
            upload.cancelToken = () => xhr.abort();
            
            // Send request
            xhr.open('POST', Config.API_BASE_URL + endpoint);
            
            // Add auth header
            const token = Auth.getToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            
            xhr.send(formData);
            
        } catch (error) {
            upload.status = 'error';
            
            this.failUpload(uploadId, error.message);
            
            if (onError) {
                onError(file, error.message);
            } else {
                App.showError(`Failed to upload ${file.name}: ${error.message}`);
            }
        }
    },
    
    // Show upload progress
    showUploadProgress(upload) {
        const progressContainer = DOM.get('uploadProgress');
        const uploadList = DOM.get('uploadList');
        
        if (!progressContainer || !uploadList) return;
        
        // Show progress container
        DOM.show(progressContainer);
        
        // Create upload item
        const uploadItem = DOM.create('div', {
            className: 'upload-item',
            id: `upload-${upload.id}`,
            innerHTML: `
                <div class="upload-file-info">
                    <div class="upload-file-name">${upload.file.name}</div>
                    <div class="upload-file-size">${Formatter.fileSize(upload.file.size)}</div>
                </div>
                <div class="upload-progress-bar">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span class="upload-progress-text">0%</span>
                </div>
                <button class="upload-cancel btn-icon" data-upload-id="${upload.id}">
                    <i class="fas fa-times"></i>
                </button>
            `
        });
        
        // Add cancel handler
        uploadItem.querySelector('.upload-cancel').addEventListener('click', () => {
            this.cancelUpload(upload.id);
        });
        
        uploadList.appendChild(uploadItem);
    },
    
    // Update upload progress
    updateUploadProgress(uploadId, progress) {
        const uploadItem = DOM.get(`upload-${uploadId}`);
        if (!uploadItem) return;
        
        const progressFill = uploadItem.querySelector('.progress-fill');
        const progressText = uploadItem.querySelector('.upload-progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${progress}%`;
        }
    },
    
    // Complete upload
    completeUpload(uploadId) {
        const uploadItem = DOM.get(`upload-${uploadId}`);
        if (!uploadItem) return;
        
        uploadItem.classList.add('completed');
        
        const progressText = uploadItem.querySelector('.upload-progress-text');
        if (progressText) {
            progressText.innerHTML = '<i class="fas fa-check text-success"></i>';
        }
        
        // Remove after delay
        setTimeout(() => {
            this.removeUpload(uploadId);
        }, 3000);
    },
    
    // Fail upload
    failUpload(uploadId, error) {
        const uploadItem = DOM.get(`upload-${uploadId}`);
        if (!uploadItem) return;
        
        uploadItem.classList.add('error');
        
        const progressText = uploadItem.querySelector('.upload-progress-text');
        if (progressText) {
            progressText.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i>';
            progressText.title = error;
        }
    },
    
    // Cancel upload
    cancelUpload(uploadId) {
        const upload = this.activeUploads.get(uploadId);
        
        if (upload && upload.cancelToken) {
            upload.cancelToken();
            upload.status = 'cancelled';
        }
        
        this.removeUpload(uploadId);
    },
    
    // Remove upload
    removeUpload(uploadId) {
        const uploadItem = DOM.get(`upload-${uploadId}`);
        if (uploadItem) {
            uploadItem.remove();
        }
        
        this.activeUploads.delete(uploadId);
        
        // Hide progress container if no active uploads
        if (this.activeUploads.size === 0) {
            DOM.hide('uploadProgress');
        }
    },
    
    // Generate upload ID
    generateUploadId() {
        return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // Preview image
    previewImage(file, containerId) {
        if (!file.type.startsWith('image/')) return;
        
        const container = DOM.get(containerId);
        if (!container) return;
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = DOM.create('img', {
                src: e.target.result,
                className: 'file-preview-image',
                style: {
                    maxWidth: '200px',
                    maxHeight: '200px',
                    borderRadius: '8px'
                }
            });
            
            container.appendChild(img);
        };
        
        reader.readAsDataURL(file);
    },
    
    // Create file list
    createFileList(files, containerId, options = {}) {
        const {
            showDelete = true,
            showDownload = true,
            onDelete = null,
            onDownload = null
        } = options;
        
        const container = DOM.get(containerId);
        if (!container) return;
        
        container.innerHTML = files.map(file => `
            <div class="file-item" data-file-id="${file.id}">
                <div class="file-icon">
                    <i class="fas ${this.getFileIcon(file.name)}"></i>
                </div>
                <div class="file-details">
                    <div class="file-name">${file.original_name || file.name}</div>
                    <div class="file-info">
                        <span class="file-size">${Formatter.fileSize(file.size)}</span>
                        <span class="file-date">${Formatter.timeAgo(file.created_at)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    ${showDownload ? `
                        <button class="btn-icon file-download" data-file-id="${file.id}">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    ${showDelete ? `
                        <button class="btn-icon file-delete" data-file-id="${file.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Add event handlers
        if (showDownload) {
            container.querySelectorAll('.file-download').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fileId = e.currentTarget.dataset.fileId;
                    const file = files.find(f => f.id == fileId);
                    
                    if (onDownload) {
                        onDownload(file);
                    } else {
                        this.downloadFile(file);
                    }
                });
            });
        }
        
        if (showDelete) {
            container.querySelectorAll('.file-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fileId = e.currentTarget.dataset.fileId;
                    const file = files.find(f => f.id == fileId);
                    
                    if (onDelete) {
                        onDelete(file);
                    } else {
                        this.deleteFile(file);
                    }
                });
            });
        }
    },
    
    // Get file icon
    getFileIcon(filename) {
        // Handle undefined or null filename
        if (!filename) {
            return 'fa-file';
        }
        
        const extension = '.' + filename.split('.').pop().toLowerCase();
        
        const icons = {
            '.pdf': 'fa-file-pdf',
            '.doc': 'fa-file-word',
            '.docx': 'fa-file-word',
            '.xls': 'fa-file-excel',
            '.xlsx': 'fa-file-excel',
            '.ppt': 'fa-file-powerpoint',
            '.pptx': 'fa-file-powerpoint',
            '.txt': 'fa-file-alt',
            '.csv': 'fa-file-csv',
            '.zip': 'fa-file-archive',
            '.rar': 'fa-file-archive',
            '.7z': 'fa-file-archive',
            '.jpg': 'fa-file-image',
            '.jpeg': 'fa-file-image',
            '.png': 'fa-file-image',
            '.gif': 'fa-file-image',
            '.svg': 'fa-file-image',
            '.mp4': 'fa-file-video',
            '.avi': 'fa-file-video',
            '.mov': 'fa-file-video',
            '.mp3': 'fa-file-audio',
            '.wav': 'fa-file-audio'
        };
        
        return icons[extension] || 'fa-file';
    },
    
    // Download file
    downloadFile(file) {
        const downloadUrl = API.files.download(file.id);
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = file.original_name || file.name;
        link.click();
    },
    
    // Delete file
    async deleteFile(file) {
        if (!confirm(`Are you sure you want to delete "${file.original_name || file.name}"?`)) {
            return;
        }
        
        try {
            await API.files.delete(file.id);
            
            // Remove from UI
            const fileItem = document.querySelector(`[data-file-id="${file.id}"]`);
            if (fileItem) {
                fileItem.remove();
            }
            
            App.showSuccess('File deleted successfully');
        } catch (error) {
            App.showError('Failed to delete file');
        }
    }
};