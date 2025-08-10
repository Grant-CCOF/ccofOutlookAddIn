// Capital Choice Platform - Bid Modals

const BidModals = {
    // Show create bid modal
    async showCreateModal(projectId) {
        try {
            // Get project details
            const project = await API.projects.getById(projectId);
            
            const content = this.getBidForm(project);
            const modal = this.createModal('Submit Bid', content, {
                confirmText: 'Submit Bid',
                project
            });
            
            // Initialize form
            this.initializeBidForm('createBidForm', project);
            
            // Handle submit
            DOM.on('createBidForm', 'submit', async (e) => {
                e.preventDefault();
                await this.handleCreateBid(project);
            });
            
        } catch (error) {
            App.showError('Failed to load project details');
        }
    },
    
    // Show edit bid modal
    showEditModal(bid) {
        const content = this.getBidForm(bid.project, bid);
        const modal = this.createModal('Edit Bid', content, {
            confirmText: 'Update Bid',
            bid
        });
        
        // Initialize form
        this.initializeBidForm('editBidForm', bid.project, bid);
        
        // Handle submit
        DOM.on('editBidForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleEditBid(bid.id);
        });
    },
    
    // Get bid form
    getBidForm(project, bid = null) {
        const isEdit = bid !== null;
        const formId = isEdit ? 'editBidForm' : 'createBidForm';
        
        return `
            <form id="${formId}">
                <div class="project-summary mb-3">
                    <h6>Project: ${project.title}</h6>
                    <div class="project-details">
                        <span><i class="fas fa-map-marker-alt"></i> ${project.zip_code}</span>
                        <span><i class="fas fa-calendar"></i> Delivery: ${Formatter.date(project.delivery_date)}</span>
                        ${project.show_max_bid && project.max_bid ? 
                            `<span><i class="fas fa-dollar-sign"></i> Max: ${Formatter.currency(project.max_bid)}</span>` : 
                            ''}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Bid Amount <span class="required">*</span></label>
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
                    ${project.max_bid ? 
                        `<small class="form-text text-muted">Maximum bid: ${Formatter.currency(project.max_bid)}</small>` : 
                        ''}
                </div>
                
                <div class="form-group">
                    <label>Delivery Date</label>
                    <input type="date" 
                           class="form-control" 
                           name="delivery_date" 
                           value="${bid?.delivery_date || project.delivery_date}"
                           min="${new Date().toISOString().split('T')[0]}">
                    <small class="form-text text-muted">
                        Leave unchanged to use project delivery date: ${Formatter.date(project.delivery_date)}
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Comments</label>
                    <textarea class="form-control" 
                              name="comments" 
                              rows="4" 
                              placeholder="Add any additional information or special conditions...">${bid?.comments || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label>Attachments</label>
                    <div id="bidAttachments">
                        ${bid?.attachments ? this.renderExistingAttachments(bid.attachments) : ''}
                    </div>
                    <input type="file" 
                           class="form-control-file" 
                           name="attachments" 
                           multiple 
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png">
                    <small class="form-text text-muted">
                        You can attach proposals, specifications, or other relevant documents
                    </small>
                </div>
                
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    <strong>Important:</strong> By submitting this bid, you agree to complete the project 
                    according to the specifications by the delivery date if your bid is accepted.
                </div>
            </form>
        `;
    },
    
    // Initialize bid form
    initializeBidForm(formId, project, bid = null) {
        const form = DOM.get(formId);
        if (!form) return;
        
        // Add amount validation
        const amountInput = form.querySelector('[name="amount"]');
        if (amountInput && project.max_bid) {
            amountInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (value > project.max_bid) {
                    e.target.setCustomValidity(`Bid cannot exceed ${Formatter.currency(project.max_bid)}`);
                } else {
                    e.target.setCustomValidity('');
                }
            });
        }
        
        // Handle file selection
        const fileInput = form.querySelector('[name="attachments"]');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }
    },
    
    // Handle create bid
    async handleCreateBid(project) {
        try {
            const form = DOM.get('createBidForm');
            const formData = new FormData(form);
            
            // Process form data
            const data = {
                project_id: project.id,
                amount: parseFloat(formData.get('amount')),
                delivery_date: formData.get('delivery_date') || project.delivery_date,
                comments: formData.get('comments')
            };
            
            // Validate
            const validation = this.validateBidData(data, project);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            App.showLoading(true);
            
            // Submit bid
            const response = await API.bids.submit(data);
            
            // Upload attachments if any
            const files = formData.getAll('attachments');
            if (files.length > 0) {
                await this.uploadAttachments(response.id, files);
            }
            
            App.showSuccess('Bid submitted successfully');
            this.closeModal();
            
            // Refresh bids or projects
            if (window.BidsComponent) {
                BidsComponent.refreshBids();
            }
            
        } catch (error) {
            App.showError('Failed to submit bid');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Handle edit bid
    async handleEditBid(bidId) {
        try {
            const form = DOM.get('editBidForm');
            const formData = new FormData(form);
            
            // Process form data
            const data = {
                amount: parseFloat(formData.get('amount')),
                delivery_date: formData.get('delivery_date'),
                comments: formData.get('comments')
            };
            
            App.showLoading(true);
            
            // Update bid
            await API.bids.update(bidId, data);
            
            // Handle new attachments
            const files = formData.getAll('attachments');
            if (files.length > 0) {
                await this.uploadAttachments(bidId, files);
            }
            
            App.showSuccess('Bid updated successfully');
            this.closeModal();
            
            // Refresh bids
            if (window.BidsComponent) {
                BidsComponent.refreshBids();
            }
            
        } catch (error) {
            App.showError('Failed to update bid');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Validate bid data
    validateBidData(data, project) {
        if (!data.amount || data.amount <= 0) {
            return { valid: false, message: 'Bid amount must be greater than 0' };
        }
        
        if (project.max_bid && data.amount > project.max_bid) {
            return { valid: false, message: `Bid cannot exceed ${Formatter.currency(project.max_bid)}` };
        }
        
        const deliveryDate = new Date(data.delivery_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deliveryDate < today) {
            return { valid: false, message: 'Delivery date cannot be in the past' };
        }
        
        return { valid: true };
    },
    
    // Handle file selection
    handleFileSelection(files) {
        const container = DOM.get('bidAttachments');
        if (!container) return;
        
        const fileList = Array.from(files).map(file => `
            <div class="attachment-item">
                <i class="fas ${FileUpload.getFileIcon(file.name)}"></i>
                <span>${file.name}</span>
                <small>(${Formatter.fileSize(file.size)})</small>
            </div>
        `).join('');
        
        container.innerHTML = fileList;
    },
    
    // Render existing attachments
    renderExistingAttachments(attachments) {
        return attachments.map(file => `
            <div class="attachment-item">
                <i class="fas ${FileUpload.getFileIcon(file.name)}"></i>
                <a href="${API.files.download(file.id)}" target="_blank">${file.name}</a>
                <small>(${Formatter.fileSize(file.size)})</small>
            </div>
        `).join('');
    },
    
    // Upload attachments
    async uploadAttachments(bidId, files) {
        for (const file of files) {
            if (file.size > 0) {
                await API.files.upload(file, { 
                    bid_id: bidId,
                    type: 'bid_attachment'
                });
            }
        }
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
        
        // Remove modal-open class if no more modals
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
    }
};

// Register globally
window.BidModals = BidModals;