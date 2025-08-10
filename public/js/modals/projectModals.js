// Capital Choice Platform - Project Modals

const ProjectModals = {
    // Show create project modal
    showCreateModal() {
        const modal = this.createModal('Create New Project', this.getProjectForm());
        
        // Initialize form
        this.initializeProjectForm('createProjectForm');
        
        // Handle submit
        DOM.on('createProjectForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleCreateProject();
        });
    },
    
    // Show edit project modal
    showEditModal(project) {
        const modal = this.createModal('Edit Project', this.getProjectForm(project));
        
        // Initialize form with project data
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
                                </div>
                                <div class="bid-amount">${Formatter.currency(bid.amount)}</div>
                                <div class="bid-date">
                                    Submitted ${Formatter.timeAgo(bid.created_at)}
                                </div>
                            </label>
                        </div>
                    `).join('')}
                </div>
                
                <div class="form-group mt-3">
                    <label>Award Message (Optional)</label>
                    <textarea class="form-control" 
                              id="awardMessage" 
                              rows="3" 
                              placeholder="Add a message for the winner..."></textarea>
                </div>
            </div>
        `;
        
        const modal = this.createModal('Award Project', content, {
            size: 'large',
            confirmText: 'Award Project',
            onConfirm: () => this.handleAwardProject(project.id)
        });
    },
    
    // Get project form
    getProjectForm(project = null) {
        const isEdit = project !== null;
        const formId = isEdit ? 'editProjectForm' : 'createProjectForm';
        
        return `
            <form id="${formId}">
                <div class="form-group">
                    <label>Project Title <span class="required">*</span></label>
                    <input type="text" 
                           class="form-control" 
                           name="title" 
                           value="${project?.title || ''}"
                           required>
                </div>
                
                <div class="form-group">
                    <label>Description <span class="required">*</span></label>
                    <textarea class="form-control" 
                              name="description" 
                              rows="4" 
                              required>${project?.description || ''}</textarea>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>ZIP Code <span class="required">*</span></label>
                            <input type="text" 
                                   class="form-control" 
                                   name="zip_code" 
                                   value="${project?.zip_code || ''}"
                                   pattern="^\\d{5}(-\\d{4})?$"
                                   placeholder="12345"
                                   required>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Max Bid Amount</label>
                            <div class="input-group">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">$</span>
                                </div>
                                <input type="number" 
                                       class="form-control" 
                                       name="max_bid" 
                                       value="${project?.max_bid || ''}"
                                       min="0" 
                                       step="0.01">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Bid Due Date <span class="required">*</span></label>
                            <input type="datetime-local" 
                                   class="form-control" 
                                   name="bid_due_date" 
                                   value="${project?.bid_due_date ? this.formatDateForInput(project.bid_due_date) : ''}"
                                   required>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Delivery Date <span class="required">*</span></label>
                            <input type="date" 
                                   class="form-control" 
                                   name="delivery_date" 
                                   value="${project?.delivery_date ? project.delivery_date.split('T')[0] : ''}"
                                   required>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <div class="custom-control custom-checkbox">
                        <input type="checkbox" 
                               class="custom-control-input" 
                               id="showMaxBid"
                               name="show_max_bid"
                               ${project?.show_max_bid ? 'checked' : ''}>
                        <label class="custom-control-label" for="showMaxBid">
                            Show maximum bid amount to contractors
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Site Conditions</label>
                    <div id="siteConditions">
                        ${project?.site_conditions ? 
                            project.site_conditions.map((condition, index) => `
                                <div class="input-group mb-2">
                                    <input type="text" 
                                           class="form-control" 
                                           name="site_conditions[]" 
                                           value="${condition}">
                                    <div class="input-group-append">
                                        <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.parentElement.remove()">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('') : 
                            '<div class="input-group mb-2"><input type="text" class="form-control" name="site_conditions[]" placeholder="Enter site condition"></div>'
                        }
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-primary" onclick="ProjectModals.addSiteCondition()">
                        <i class="fas fa-plus"></i> Add Condition
                    </button>
                </div>
                
                ${!isEdit ? `
                    <div class="form-group">
                        <div class="custom-control custom-checkbox">
                            <input type="checkbox" 
                                   class="custom-control-input" 
                                   id="startBidding"
                                   name="start_bidding">
                            <label class="custom-control-label" for="startBidding">
                                Start bidding immediately after creation
                            </label>
                        </div>
                    </div>
                ` : ''}
            </form>
        `;
    },
    
    // Initialize project form
    initializeProjectForm(formId, project = null) {
        // Set minimum dates
        const form = DOM.get(formId);
        if (!form) return;
        
        const today = new Date().toISOString().split('T')[0];
        const bidDueDateInput = form.querySelector('[name="bid_due_date"]');
        const deliveryDateInput = form.querySelector('[name="delivery_date"]');
        
        if (bidDueDateInput) {
            bidDueDateInput.min = today;
        }
        
        if (deliveryDateInput) {
            deliveryDateInput.min = today;
        }
        
        // Add date validation
        bidDueDateInput?.addEventListener('change', () => {
            if (deliveryDateInput && bidDueDateInput.value) {
                const bidDate = new Date(bidDueDateInput.value);
                const minDelivery = new Date(bidDate);
                minDelivery.setDate(minDelivery.getDate() + 1);
                deliveryDateInput.min = minDelivery.toISOString().split('T')[0];
            }
        });
    },
    
    // Handle create project
    async handleCreateProject() {
        try {
            const form = DOM.get('createProjectForm');
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
            
            // Create project
            const response = await API.projects.create(data);
            
            // Start bidding if requested
            if (data.start_bidding) {
                await API.projects.startBidding(response.id);
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
    
    // Handle edit project
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
            
            App.showSuccess('Project updated successfully');
            this.closeModal();
            
            // Refresh project details or list
            if (window.ProjectsComponent) {
                if (Router.currentRoute.includes('/projects/')) {
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
        const selectedBid = document.querySelector('input[name="selectedBid"]:checked');
        
        if (!selectedBid) {
            App.showError('Please select a bid to award');
            return;
        }
        
        const bidId = selectedBid.value;
        const message = DOM.getValue('awardMessage');
        
        if (!confirm('Are you sure you want to award this project? This action cannot be undone.')) {
            return;
        }
        
        try {
            App.showLoading(true);
            
            await API.projects.award(projectId, { bidId, message });
            
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
        data.start_bidding = formData.has('start_bidding');
        
        // Handle site conditions array
        const conditions = formData.getAll('site_conditions[]').filter(c => c.trim());
        if (conditions.length > 0) {
            data.site_conditions = conditions;
        }
        
        // Remove empty max_bid
        if (!data.max_bid) {
            delete data.max_bid;
        }
        
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
    
    // Format date for input
    formatDateForInput(dateString) {
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