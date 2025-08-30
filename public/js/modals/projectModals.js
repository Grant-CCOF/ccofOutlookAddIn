// Capital Choice Platform - Project Modals

const ProjectModals = {
    // Show create project modal
    async showCreateModal() {
        const modal = this.createModal('Create New Project', this.getProjectForm());
        
        // Initialize form and file upload
        this.initializeProjectForm('createProjectForm');
        
        // Handle submit
        DOM.on('createProjectForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleCreateProject();
        });
    },
    
    // Show edit project modal
    async showEditModal(project) {
        // Load project files if not already loaded
        if (!project.files) {
            try {
                project.files = await API.files.getProjectFiles(project.id);
            } catch (error) {
                console.error('Failed to load project files:', error);
                project.files = [];
            }
        }
        
        const modal = this.createModal('Edit Project', this.getProjectForm(project));
        
        // Initialize form and file upload
        this.initializeProjectForm('editProjectForm', project);
        
        // Handle submit
        DOM.on('editProjectForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleEditProject(project.id);
        });
    },
    
    // Show award project modal
    showAwardModal(project) {
        if (!project.bids || project.bids.length === 0) {
            App.showError('No bids available to award');
            return;
        }
        
        const content = `
            <div class="award-modal">
                <div class="mb-3">
                    <p>Select the winning bid for <strong>${project.title}</strong>:</p>
                </div>
                
                <div class="bids-list">
                    ${project.bids.map(bid => `
                        <div class="bid-option">
                            <input type="radio" 
                                name="selectedBid" 
                                id="bid-${bid.id}" 
                                value="${bid.id}">
                            <label for="bid-${bid.id}" class="bid-label">
                                <div class="bid-info">
                                    <div class="bidder-name">${bid.user_name}</div>
                                    <div class="bidder-company">${bid.company}</div>
                                    <div class="bid-amount">${Formatter.currency(bid.amount)}</div>
                                    <div class="bid-date">
                                        Submitted ${Formatter.timeAgo(bid.created_at)}
                                    </div>
                                </div>
                            </label>
                        </div>
                    `).join('')}
                </div>
                
                <div class="form-group mt-3">
                    <label>Award Comment (Optional)</label>
                    <textarea class="form-control" 
                            id="awardComment" 
                            rows="3" 
                            placeholder="Add a comment for the winning bidder (e.g., congratulations, next steps, etc.)"></textarea>
                </div>
            </div>
        `;
        
        const modal = this.createModal('Award Project', content, {
            size: 'large',
            confirmText: 'Award Project',
            onConfirm: `ProjectModals.handleAwardProject(${project.id})`
        });
    },
    
    // Get project form with file upload
    getProjectForm(project = null) {
        const isEdit = project !== null;
        const formId = isEdit ? 'editProjectForm' : 'createProjectForm';
        
        return `
            <form id="${formId}" class="project-form">
                <div class="form-group">
                    <label>Project Title <span class="text-danger">*</span></label>
                    <input type="text" 
                        class="form-control" 
                        name="title" 
                        value="${project?.title || ''}"
                        required>
                </div>
                
                <div class="form-group">
                    <label>Description <span class="text-danger">*</span></label>
                    <textarea class="form-control" 
                            name="description" 
                            rows="4"
                            required>${project?.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label>ZIP Code <span class="text-danger">*</span></label>
                    <input type="text" 
                        class="form-control" 
                        name="zip_code" 
                        value="${project?.zip_code || ''}"
                        pattern="[0-9]{5}"
                        placeholder="12345"
                        required>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Bid Due Date <span class="text-danger">*</span></label>
                            <input type="datetime-local" 
                                class="form-control" 
                                name="bid_due_date" 
                                id="bidDueDate"
                                value="${project ? this.formatDateForInput(project.bid_due_date) : ''}"
                                required>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Delivery Date <span class="text-danger">*</span></label>
                            <input type="date" 
                                class="form-control" 
                                name="delivery_date" 
                                id="deliveryDate"
                                value="${project ? this.formatDateForInput(project.delivery_date, true) : ''}"
                                required>
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Maximum Bid (Optional)</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">$</span>
                                </div>
                                <input type="number" 
                                    class="form-control" 
                                    name="max_bid" 
                                    value="${project?.max_bid || ''}"
                                    min="0"
                                    step="0.01"
                                    placeholder="Leave blank for no limit">
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>&nbsp;</label>
                            <div class="custom-control custom-checkbox mt-2">
                                <input type="checkbox" 
                                    class="custom-control-input" 
                                    id="showMaxBid"
                                    name="show_max_bid"
                                    ${project?.show_max_bid !== false ? 'checked' : ''}>
                                <label class="custom-control-label" for="showMaxBid">
                                    Display maximum bid to contractors
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- File Upload Section -->
                <div class="form-group">
                    <label>Project Files</label>
                    <div class="file-upload-area" id="${formId}FileUpload">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Click to upload files or drag and drop</p>
                        <small>PDF, DOC, DOCX, XLS, XLSX, TXT, Images (Max 10MB each)</small>
                    </div>
                    <input type="file" 
                        id="${formId}FileInput" 
                        multiple 
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                        style="display: none;">
                    
                    <!-- Files List -->
                    <div id="${formId}FileList" class="file-list mt-3">
                        ${isEdit && project.files ? this.renderExistingFiles(project.files) : ''}
                    </div>
                    
                    <!-- Temporary files for upload -->
                    <div id="${formId}TempFiles" class="temp-files-list mt-2"></div>
                </div>
                
                ${!isEdit ? `
                    <div class="form-group">
                        <div class="custom-control custom-checkbox">
                            <input type="checkbox" 
                                class="custom-control-input" 
                                id="startBidding"
                                name="start_bidding">
                            <label class="custom-control-label" for="startBidding">
                                Immediately open for bidding after creation
                            </label>
                        </div>
                    </div>
                ` : ''}
            </form>
        `;
    },

    // Render existing files for editing
    renderExistingFiles(files) {
        if (!files || files.length === 0) return '';
        
        return `
            <div class="existing-files">
                <h6>Current Files:</h6>
                ${files.map(file => `
                    <div class="file-item existing-file" data-file-id="${file.id}">
                        <div class="file-info">
                            <i class="fas ${FileUpload.getFileIcon(file.original_name || file.file_name)}"></i>
                            <span class="file-name">${file.original_name || file.file_name}</span>
                            <span class="file-size">(${Formatter.fileSize(file.file_size || file.size)})</span>
                        </div>
                        <button type="button" 
                                class="btn-icon btn-danger" 
                                onclick="ProjectModals.removeExistingFile(${file.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Initialize project form with file upload
    initializeProjectForm(formId, project = null) {
        // Set minimum dates
        const bidDueDateInput = DOM.get('bidDueDate');
        const deliveryDateInput = DOM.get('deliveryDate');
        
        if (bidDueDateInput) {
            const minDate = new Date();
            minDate.setHours(minDate.getHours() + 1);
            bidDueDateInput.min = minDate.toISOString().slice(0, 16);
            
            bidDueDateInput.addEventListener('change', (e) => {
                const bidDue = new Date(e.target.value);
                const minDelivery = new Date(bidDue);
                minDelivery.setDate(minDelivery.getDate() + 1);
                deliveryDateInput.min = minDelivery.toISOString().split('T')[0];
            });
        }
        
        // Initialize file upload
        this.initializeFileUpload(formId, project?.files);
    },

    // Initialize file upload for project form
    initializeFileUpload(formId, existingFiles = []) {
        const uploadArea = DOM.get(`${formId}FileUpload`);
        const fileInput = DOM.get(`${formId}FileInput`);
        const tempFilesList = DOM.get(`${formId}TempFiles`);
        
        if (!uploadArea || !fileInput) return;
        
        // Store temp files for upload
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
                allowedTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.jpg', '.jpeg', '.png']
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
                        onclick="ProjectModals.removeTempFile('${tempId}')">
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
    
    // Handle create project with file upload
    async handleCreateProject() {
        try {
            const form = DOM.get('createProjectForm');
            const formData = new FormData(form);
            
            // Process form data
            const data = this.processProjectFormData(formData);
            
            // Store start_bidding flag before it's removed
            const shouldStartBidding = formData.has('start_bidding');
            
            // Validate
            const validation = this.validateProjectData(data);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            App.showLoading(true);
            
            // Create project
            const project = await API.projects.create(data);
            
            // Upload files if any
            if (this.tempFiles && this.tempFiles.size > 0) {
                const uploadPromises = [];
                for (const [tempId, file] of this.tempFiles) {
                    uploadPromises.push(
                        API.files.upload(file, { project_id: project.id })
                    );
                }
                await Promise.all(uploadPromises);
            }
            
            // Start bidding if requested
            if (shouldStartBidding) {
                await API.projects.startBidding(project.id);
            }
            
            App.showSuccess('Project created successfully');
            this.closeModal();
            
            // Refresh projects list
            if (window.ProjectsComponent) {
                ProjectsComponent.refreshProjects();
            }
            
        } catch (error) {
            App.showError('Failed to create project');
        } finally {
            App.showLoading(false);
        }
    },

    // Handle edit project with file management
    async handleEditProject(projectId) {
        try {
            const form = DOM.get('editProjectForm');
            const formData = new FormData(form);
            
            // Process form data
            const data = this.processProjectFormData(formData);
            
            // Validate
            const validation = this.validateProjectData(data);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            App.showLoading(true);
            
            // Update project
            await API.projects.update(projectId, data);
            
            // Handle file deletions
            if (this.filesToDelete && this.filesToDelete.size > 0) {
                const deletePromises = [];
                for (const fileId of this.filesToDelete) {
                    deletePromises.push(API.files.delete(fileId));
                }
                await Promise.all(deletePromises);
            }
            
            // Upload new files
            if (this.tempFiles && this.tempFiles.size > 0) {
                const uploadPromises = [];
                for (const [tempId, file] of this.tempFiles) {
                    uploadPromises.push(
                        API.files.upload(file, { project_id: projectId })
                    );
                }
                await Promise.all(uploadPromises);
            }
            
            App.showSuccess('Project updated successfully');
            this.closeModal();
            
            // Refresh project details or list
            if (window.ProjectsComponent) {
                if (window.location.hash.includes(`/projects/${projectId}`)) {
                    ProjectsComponent.renderDetail(projectId);
                } else {
                    ProjectsComponent.refreshProjects();
                }
            }
            
        } catch (error) {
            App.showError('Failed to update project');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Handle award project
    async handleAwardProject(projectId) {
        const selectedBidEl = document.querySelector('input[name="selectedBid"]:checked');
        const commentEl = DOM.get('awardComment');
        
        if (!selectedBidEl) {
            App.showError('Please select a bid to award');
            return;
        }
        
        const bidId = parseInt(selectedBidEl.value);
        const comment = commentEl ? commentEl.value.trim() : '';
        
        if (!confirm('Are you sure you want to award this project? This action cannot be undone.')) {
            return;
        }
        
        try {
            App.showLoading(true);
            
            await API.projects.award(projectId, { bidId, comment });
            
            App.showSuccess('Project awarded successfully');
            this.closeModal();
            
            // Refresh project
            if (window.ProjectsComponent) {
                ProjectsComponent.renderDetail(projectId);
            }
            
        } catch (error) {
            App.showError('Failed to award project');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Process project form data
    processProjectFormData(formData) {
        const data = Object.fromEntries(formData.entries());
        
        // Handle checkboxes
        data.show_max_bid = formData.has('show_max_bid');
        
        // Handle site conditions array
        const conditions = formData.getAll('site_conditions[]').filter(c => c.trim());
        if (conditions.length > 0) {
            data.site_conditions = conditions;
        }
        
        // Remove empty max_bid
        if (!data.max_bid) {
            delete data.max_bid;
        }
        
        // Remove fields that don't exist in the database
        delete data.budget_range;
        delete data.start_bidding;
        
        return data;
    },
    
    // Validate project data
    validateProjectData(data) {
        if (!data.title || data.title.trim().length < 3) {
            return { valid: false, message: 'Project title must be at least 3 characters' };
        }
        
        if (!data.description || data.description.trim().length < 10) {
            return { valid: false, message: 'Project description must be at least 10 characters' };
        }
        
        if (!data.zip_code || !/^\d{5}(-\d{4})?$/.test(data.zip_code)) {
            return { valid: false, message: 'Please enter a valid ZIP code' };
        }
        
        const bidDueDate = new Date(data.bid_due_date);
        const deliveryDate = new Date(data.delivery_date);
        
        if (bidDueDate >= deliveryDate) {
            return { valid: false, message: 'Delivery date must be after bid due date' };
        }
        
        if (data.max_bid && parseFloat(data.max_bid) <= 0) {
            return { valid: false, message: 'Maximum bid must be greater than 0' };
        }
        
        return { valid: true };
    },
    
    // Add site condition
    addSiteCondition() {
        const container = DOM.get('siteConditions');
        if (!container) return;
        
        const conditionHTML = `
            <div class="input-group mb-2">
                <input type="text" 
                       class="form-control" 
                       name="site_conditions[]" 
                       placeholder="Enter site condition">
                <div class="input-group-append">
                    <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', conditionHTML);
    },
    
    // Format date for date input (yyyy-MM-dd)
    formatDateOnly(dateString) {
        if (!dateString) return '';
        
        // Handle if it's already just a date (yyyy-MM-dd)
        if (dateString.length === 10 && dateString.indexOf('T') === -1) {
            return dateString;
        }
        
        // Extract just the date part
        return dateString.split('T')[0];
    },

    // Format date for datetime-local input (yyyy-MM-ddTHH:mm)
    formatDateForInput(dateString, dateOnly = false) {
        if (!dateString) return '';
        
        if (dateOnly) {
            return this.formatDateOnly(dateString);
        }
        
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    },
    
    // Create modal helper
    createModal(title, content, options = {}) {
        const {
            size = 'medium',
            confirmText = 'Save',
            cancelText = 'Cancel',
            onConfirm = null,
            onCancel = null
        } = options;
        
        const modalId = `modal-${Date.now()}`;
        
        const modalHTML = `
            <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-${size}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="close" onclick="ProjectModals.closeModal('${modalId}')">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            ${onConfirm ? `
                                <button type="button" class="btn btn-primary" onclick="${onConfirm}">
                                    ${confirmText}
                                </button>
                            ` : `
                                <button type="submit" form="${content.match(/id="([^"]+)"/)?.[1]}" class="btn btn-primary">
                                    ${confirmText}
                                </button>
                            `}
                            <button type="button" class="btn btn-outline" onclick="ProjectModals.closeModal('${modalId}')">
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
        
        // Remove modal-open class if no more modals
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
    }
};

// Register globally
window.ProjectModals = ProjectModals;