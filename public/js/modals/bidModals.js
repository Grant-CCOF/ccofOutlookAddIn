// Capital Choice Platform - Bid Modals

const BidModals = {
    // Store temp files and files to delete
    tempFiles: new Map(),
    filesToDelete: new Set(),
    
    // Show create bid modal
    async showCreateModal(projectId) {
        try {
            // Load project details
            const project = await API.projects.getById(projectId);
            
            if (!project) {
                App.showError('Project not found');
                return;
            }
            
            if (project.status !== 'bidding') {
                App.showError('This project is not open for bidding');
                return;
            }
            
            const modal = this.createModal('Submit Bid', this.getBidForm(project));
            
            // Initialize file upload
            this.initializeFileUpload('createBidForm');
            
            // Handle submit
            DOM.on('createBidForm', 'submit', async (e) => {
                e.preventDefault();
                await this.handleCreateBid(project.id);
            });
        } catch (error) {
            App.showError('Failed to load project details');
        }
    },
    
    // Show edit bid modal
    async showEditModal(bid) {
        try {
            // Load project details
            const project = await API.projects.getById(bid.project_id);
            
            // Load bid attachments if not already loaded
            if (!bid.attachments) {
                try {
                    bid.attachments = await API.files.getBidFiles(bid.id);
                } catch (error) {
                    console.error('Failed to load bid files:', error);
                    bid.attachments = [];
                }
            }
            
            const modal = this.createModal('Edit Bid', this.getBidForm(project, bid));
            
            // Initialize file upload with existing files
            this.initializeFileUpload('editBidForm', bid.attachments);
            
            // Handle submit
            DOM.on('editBidForm', 'submit', async (e) => {
                e.preventDefault();
                await this.handleEditBid(bid.id);
            });
        } catch (error) {
            App.showError('Failed to load bid details');
        }
    },
    
    // Get bid form with file upload
    getBidForm(project, bid = null) {
        const isEdit = bid !== null;
        const formId = isEdit ? 'editBidForm' : 'createBidForm';
        
        return `
            <form id="${formId}" class="bid-form">
                <div class="project-info mb-3">
                    <h6>Project: ${project.title}</h6>
                    <p class="text-muted">${project.description}</p>
                    <div class="project-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${project.zip_code}</span>
                        <span><i class="fas fa-calendar"></i> Due: ${Formatter.date(project.bid_due_date)}</span>
                        ${project.show_max_bid && project.max_bid ? `
                            <span><i class="fas fa-dollar-sign"></i> Max: ${Formatter.currency(project.max_bid)}</span>
                        ` : ''}
                    </div>
                </div>
                
                <hr>
                
                <div class="form-group">
                    <label>Bid Amount <span class="text-danger">*</span></label>
                    <div class="input-group">
                        <div class="input-group-prepend">
                            <span class="input-group-text">$</span>
                        </div>
                        <input type="number" 
                               class="form-control" 
                               name="amount" 
                               value="${bid?.amount || ''}"
                               min="0"
                               step="0.01"
                               ${project.max_bid ? `max="${project.max_bid}"` : ''}
                               required>
                    </div>
                    ${project.max_bid ? `
                        <small class="form-text text-muted">
                            Maximum bid amount: ${Formatter.currency(project.max_bid)}
                        </small>
                    ` : ''}
                </div>
                
                <div class="form-group">
                    <label>Alternate Delivery Date</label>
                    <input type="date" 
                           class="form-control" 
                           name="alternate_delivery_date"
                           value="${bid?.alternate_delivery_date?.split('T')[0] || ''}"
                           min="${new Date().toISOString().split('T')[0]}">
                    <small class="form-text text-muted">
                        Leave blank to use project's delivery date: ${Formatter.date(project.delivery_date)}
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Comments</label>
                    <textarea class="form-control" 
                              name="comments" 
                              rows="3"
                              placeholder="Add any additional information or questions">${bid?.comments || ''}</textarea>
                </div>
                
                <!-- File Upload Section -->
                <div class="form-group">
                    <label>Attachments</label>
                    <div class="file-upload-area" id="${formId}FileUpload">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Click to upload files or drag and drop</p>
                        <small>PDF, DOC, DOCX, XLS, XLSX, TXT (Max 10MB each)</small>
                    </div>
                    <input type="file" 
                           id="${formId}FileInput" 
                           multiple 
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                           style="display: none;">
                    
                    <!-- Files List -->
                    <div id="${formId}FileList" class="file-list mt-3">
                        ${isEdit && bid?.attachments ? this.renderExistingBidFiles(bid.attachments) : ''}
                    </div>
                    
                    <!-- Temporary files for upload -->
                    <div id="${formId}TempFiles" class="temp-files-list mt-2"></div>
                </div>
            </form>
        `;
    },
    
    // Render existing bid files
    renderExistingBidFiles(files) {
        if (!files || files.length === 0) return '';
        
        return `
            <div class="existing-files">
                <h6>Current Attachments:</h6>
                ${files.map(file => `
                    <div class="file-item existing-file" data-file-id="${file.id}">
                        <div class="file-info">
                            <i class="fas ${FileUpload.getFileIcon(file.original_name || file.file_name)}"></i>
                            <span class="file-name">${file.original_name || file.file_name}</span>
                            <span class="file-size">(${Formatter.fileSize(file.file_size || file.size)})</span>
                        </div>
                        <button type="button" 
                                class="btn-icon btn-danger" 
                                onclick="BidModals.removeExistingFile(${file.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Initialize file upload for bid form
    initializeFileUpload(formId, existingFiles = []) {
        const uploadArea = DOM.get(`${formId}FileUpload`);
        const fileInput = DOM.get(`${formId}FileInput`);
        
        if (!uploadArea || !fileInput) return;
        
        // Reset temp files and delete list
        this.tempFiles = new Map();
        this.filesToDelete = new Set();
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleNewFiles(files, formId);
            // Clear the input so the same file can be selected again
            e.target.value = '';
        });
        
        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragging');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragging');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragging');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleNewFiles(files, formId);
        });
    },
    
    // Handle new files
    handleNewFiles(files, formId) {
        const tempFilesList = DOM.get(`${formId}TempFiles`);
        
        files.forEach(file => {
            // Validate file
            const validation = FileUpload.validateFile(file, {
                maxSize: 10 * 1024 * 1024, // 10MB
                allowedTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt']
            });
            
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            // Generate unique ID for temp file
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.tempFiles.set(tempId, file);
            
            // Add to UI
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item temp-file';
            fileItem.dataset.tempId = tempId;
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas ${FileUpload.getFileIcon(file.name)}"></i>
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${Formatter.fileSize(file.size)})</span>
                    <span class="badge badge-info ml-2">New</span>
                </div>
                <button type="button" 
                        class="btn-icon btn-danger" 
                        onclick="BidModals.removeTempFile('${tempId}')">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            tempFilesList.appendChild(fileItem);
        });
    },
    
    // Remove temporary file
    removeTempFile(tempId) {
        this.tempFiles.delete(tempId);
        const fileItem = document.querySelector(`[data-temp-id="${tempId}"]`);
        if (fileItem) {
            fileItem.remove();
        }
    },
    
    // Remove existing file (mark for deletion)
    removeExistingFile(fileId) {
        if (!confirm('Are you sure you want to remove this file?')) {
            return;
        }
        
        this.filesToDelete.add(fileId);
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            fileItem.style.opacity = '0.5';
            fileItem.style.textDecoration = 'line-through';
            const deleteBtn = fileItem.querySelector('.btn-danger');
            if (deleteBtn) {
                deleteBtn.innerHTML = '<i class="fas fa-undo"></i>';
                deleteBtn.onclick = () => this.undoRemoveFile(fileId);
            }
        }
    },
    
    // Undo file removal
    undoRemoveFile(fileId) {
        this.filesToDelete.delete(fileId);
        const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (fileItem) {
            fileItem.style.opacity = '1';
            fileItem.style.textDecoration = 'none';
            const undoBtn = fileItem.querySelector('.btn-danger');
            if (undoBtn) {
                undoBtn.innerHTML = '<i class="fas fa-trash"></i>';
                undoBtn.onclick = () => this.removeExistingFile(fileId);
            }
        }
    },
    
    // Handle create bid with file upload
   async handleCreateBid(projectId) {
        try {
            const form = DOM.get('createBidForm');
            const formData = new FormData(form);
            
            const data = {
                project_id: projectId,
                amount: parseFloat(formData.get('amount')),
                comments: formData.get('comments'),
                alternate_delivery_date: formData.get('alternate_delivery_date')
            };
            
            // Check if amount is valid
            if (isNaN(data.amount)) {
                App.showError('Invalid bid amount');
                return;
            }
            
            // Clean up the alternate_delivery_date - send empty string instead of null if not set
            if (!data.alternate_delivery_date || data.alternate_delivery_date === '') {
                delete data.alternate_delivery_date;  // Remove from object if empty
            }
            
            // Validate
            const validation = this.validateBidData(data);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            App.showLoading(true);
            
            // Submit bid
            const bid = await API.bids.submit(data);
            
            // Upload files if any
            if (this.tempFiles && this.tempFiles.size > 0) {
                const uploadPromises = [];
                for (const [tempId, file] of this.tempFiles) {
                    uploadPromises.push(
                        API.files.upload(file, { bid_id: bid.id })
                    );
                }
                
                try {
                    await Promise.all(uploadPromises);
                } catch (uploadError) {
                    console.error('Some files failed to upload:', uploadError);
                    App.showWarning('Bid submitted, but some files failed to upload');
                }
            }
            
            App.showSuccess('Bid submitted successfully');
            this.closeModal();
            
            // IMPORTANT FIX: Refresh the appropriate component based on current page
            const currentHash = window.location.hash;
            
            // Always refresh bids component if available
            if (window.BidsComponent) {
                await BidsComponent.refreshBids();
            }
            
            // Check if we're on a project-related page
            if (currentHash.includes('/projects')) {
                if (currentHash.includes(`/projects/${projectId}`)) {
                    // On project detail page - refresh the detail view
                    if (window.ProjectsComponent) {
                        await ProjectsComponent.renderDetail(projectId);
                    }
                } else {
                    // On projects list page - refresh the entire list
                    // This is the KEY FIX - refresh the projects list so has_bid gets updated
                    if (window.ProjectsComponent) {
                        await ProjectsComponent.loadProjects();
                    }
                }
            }
            
            // Also refresh available projects in the bids component if visible
            if (window.BidsComponent && currentHash.includes('/bids')) {
                await BidsComponent.loadAvailableProjects();
            }
            
        } catch (error) {
            App.showError('Failed to submit bid: ' + (error.message || 'Unknown error'));
        } finally {
            App.showLoading(false);
        }
    },
    
    // Handle edit bid with file management
    async handleEditBid(bidId) {
        try {
            const form = DOM.get('editBidForm');
            const formData = new FormData(form);
            
            // Process form data
            const data = {
                amount: parseFloat(formData.get('amount'))
            };
            
            // Only include comments if it has a value (not null or empty string)
            const comments = formData.get('comments');
            if (comments && comments.trim() !== '') {
                data.comments = comments.trim();
            }
            
            // Only include alternate_delivery_date if it has a value
            const alternateDate = formData.get('alternate_delivery_date');
            if (alternateDate && alternateDate.trim() !== '') {
                // Ensure it's in ISO8601 format
                data.alternate_delivery_date = new Date(alternateDate).toISOString();
            }
            
            // Validate
            const validation = this.validateBidData(data);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            App.showLoading(true);
            
            // Update bid
            await API.bids.update(bidId, data);
            
            // Handle file deletions
            if (this.filesToDelete && this.filesToDelete.size > 0) {
                const deletePromises = [];
                for (const fileId of this.filesToDelete) {
                    deletePromises.push(API.files.delete(fileId));
                }
                
                try {
                    await Promise.all(deletePromises);
                } catch (deleteError) {
                    console.error('Some files failed to delete:', deleteError);
                }
            }
            
            // Upload new files
            if (this.tempFiles && this.tempFiles.size > 0) {
                const uploadPromises = [];
                for (const [tempId, file] of this.tempFiles) {
                    uploadPromises.push(
                        API.files.upload(file, { bid_id: bidId })
                    );
                }
                
                try {
                    await Promise.all(uploadPromises);
                } catch (uploadError) {
                    console.error('Some files failed to upload:', uploadError);
                    App.showWarning('Bid updated, but some files failed to upload');
                }
            }
            
            App.showSuccess('Bid updated successfully');
            this.closeModal();
            
            // Refresh bids
            if (window.BidsComponent) {
                BidsComponent.refreshBids();
            }
            
        } catch (error) {
            console.error('Error updating bid:', error);
            
            // Check for validation errors from the backend
            if (error.message && error.message.includes('400')) {
                App.showError('Invalid bid data. Please check your inputs.');
            } else {
                App.showError(error.message || 'Failed to update bid');
            }
        } finally {
            App.showLoading(false);
        }
    },
    
    // Validate bid data
    validateBidData(data) {
        if (!data.amount || data.amount <= 0) {
            return { valid: false, message: 'Please enter a valid bid amount' };
        }
        
        if (data.alternate_delivery_date) {
            const deliveryDate = new Date(data.alternate_delivery_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (deliveryDate < today) {
                return { valid: false, message: 'Delivery date cannot be in the past' };
            }
        }
        
        return { valid: true };
    },
    
    // Create modal helper
    createModal(title, content, options = {}) {
        const {
            size = 'medium',
            confirmText = 'Save',
            cancelText = 'Cancel'
        } = options;
        
        const modalId = `modal-${Date.now()}`;
        
        const modalHTML = `
            <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-${size}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="close" onclick="BidModals.closeModal('${modalId}')">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            <button type="submit" form="${content.match(/id="([^"]+)"/)?.[1]}" class="btn btn-primary">
                                ${confirmText}
                            </button>
                            <button type="button" class="btn btn-outline" onclick="BidModals.closeModal('${modalId}')">
                                ${cancelText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show" id="${modalId}-backdrop"></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.classList.add('modal-open');
        
        return modalId;
    },
    
    // Close modal
    closeModal(modalId) {
        const modal = modalId ? DOM.get(modalId) : document.querySelector('.modal.show');
        const backdrop = modalId ? DOM.get(`${modalId}-backdrop`) : document.querySelector('.modal-backdrop');
        
        if (modal) {
            modal.remove();
        }
        if (backdrop) {
            backdrop.remove();
        }
        
        // Check if there are other modals open
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
        
        // Clear temp files
        this.tempFiles = new Map();
        this.filesToDelete = new Set();
    }
};

// Register component
window.BidModals = BidModals;