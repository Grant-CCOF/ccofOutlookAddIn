// Capital Choice Platform - Bid Templates
// This file contains all HTML templates for bid-related UI components

const BidTemplates = {
    // Get bid card template
    getBidCard(bid) {
        const statusColor = this.getBidStatusColor(bid.status);
        const project = bid.project || {};
        
        return `
            <div class="card bid-card" data-bid-id="${bid.id}">
                <div class="bid-header">
                    <div class="bid-info">
                        <h4 class="bid-title">${project.title || 'Project #' + bid.project_id}</h4>
                        <div class="bid-meta">
                            <span class="bid-company">
                                <i class="fas fa-building"></i> ${bid.company_name || 'Unknown Company'}
                            </span>
                            <span class="bid-date">
                                <i class="fas fa-clock"></i> ${Formatter.timeAgo(bid.created_at)}
                            </span>
                        </div>
                    </div>
                    <div class="bid-amount">
                        <span class="currency">$</span>
                        <span class="amount">${Number(bid.amount).toLocaleString()}</span>
                    </div>
                </div>
                
                <div class="bid-body">
                    <div class="bid-details-grid">
                        <div class="bid-detail">
                            <span class="detail-label">Status</span>
                            <span class="badge badge-${statusColor}">${bid.status}</span>
                        </div>
                        <div class="bid-detail">
                            <span class="detail-label">Delivery Date</span>
                            <span class="detail-value">
                                ${Formatter.date(bid.alternate_delivery_date || project.delivery_date)}
                            </span>
                        </div>
                        <div class="bid-detail">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${project.zip_code || 'N/A'}</span>
                        </div>
                        <div class="bid-detail">
                            <span class="detail-label">Project Status</span>
                            <span class="detail-value">${project.status || 'Unknown'}</span>
                        </div>
                    </div>
                    
                    ${bid.alternate_delivery_date ? `
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-calendar-alt"></i>
                            <strong>Alternate Delivery Date:</strong> ${Formatter.date(bid.alternate_delivery_date)}
                        </div>
                    ` : ''}
                    
                    ${bid.comments ? `
                        <div class="bid-comments">
                            <h5><i class="fas fa-comment"></i> Comments</h5>
                            <p>${bid.comments}</p>
                        </div>
                    ` : ''}
                    
                    ${bid.status === 'won' && bid.award_comment ? `
                        <div class="alert alert-success mt-3">
                            <h6><i class="fas fa-trophy"></i> Award Comment</h6>
                            <p class="mb-0">${bid.award_comment}</p>
                        </div>
                    ` : bid.status === 'won' ? `
                        <div class="alert alert-success">
                            <i class="fas fa-trophy"></i>
                            <strong>Congratulations!</strong> Your bid was accepted for this project.
                        </div>
                    ` : ''}
                </div>
                
                <div class="bid-footer">
                    <button class="btn btn-outline btn-sm" onclick="BidsComponent.viewBidDetails(${bid.id})">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${bid.status === 'pending' && Auth.hasRole(['installation_company', 'operations']) ? `
                        <button class="btn btn-primary btn-sm" onclick="BidsComponent.editBid(${bid.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="BidsComponent.withdrawBid(${bid.id})">
                            <i class="fas fa-times"></i> Withdraw
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Get bid status color
    getBidStatusColor(status) {
        const colors = {
            'pending': 'warning',
            'accepted': 'success',
            'won': 'success',
            'rejected': 'danger',
            'withdrawn': 'secondary',
            'expired': 'secondary'
        };
        return colors[status] || 'secondary';
    },
    
    // Get bid list table template
    getBidListTable(bids) {
        if (!bids || bids.length === 0) {
            return this.getEmptyBidsTemplate();
        }
        
        return `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Company</th>
                            <th>Amount</th>
                            <th>Delivery Date</th>
                            <th>Status</th>
                            <th>Submitted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bids.map(bid => this.getBidRow(bid)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    // Get bid row for table
    getBidRow(bid, project) {
        const deliveryDateDisplay = this.formatBidDeliveryDate(bid.alternate_delivery_date, project.delivery_date);
        
        return `
            <tr>
                <td>${bid.bidder_display || bid.user_name || bid.company || 'Unknown'}</td>
                <td>${Formatter.currency(bid.amount)}</td>
                <td>${deliveryDateDisplay}</td>
                <td>${bid.comments || '-'}</td>
                <td>
                    <span class="badge badge-${this.getStatusClass(bid.status)}">
                        ${bid.status}
                    </span>
                </td>
                <td>${Formatter.date(bid.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="BidsComponent.viewBidDetails(${bid.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${this.getBidActions(bid)}
                </td>
            </tr>
        `;
    },

    formatBidDeliveryDate(alternateDate, projectDate) {
        if (!alternateDate || alternateDate === null || alternateDate === '') {
            return '<span class="text-muted">No change</span>';
        }
        
        const altDate = new Date(alternateDate);
        const projDate = new Date(projectDate);
        
        if (altDate.getTime() === projDate.getTime()) {
            return '<span class="text-muted">No change</span>';
        }
        
        const daysDiff = Math.floor((altDate - projDate) / (1000 * 60 * 60 * 24));
        const earlier = daysDiff < 0;
        
        return `
            <span class="text-${earlier ? 'success' : 'warning'}">
                ${Formatter.date(alternateDate)}
                <br>
                <small>(${Math.abs(daysDiff)} days ${earlier ? 'earlier' : 'later'})</small>
            </span>
        `;
    },
    
    // Get empty bids template
    getEmptyBidsTemplate(message = 'No bids found') {
        const userRole = Auth.getUserRole();
        const isContractor = ['installation_company', 'operations'].includes(userRole);
        
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-gavel"></i>
                </div>
                <h3 class="empty-state-title">${message}</h3>
                <p class="empty-state-description">
                    ${isContractor 
                        ? 'Start bidding on available projects to see them here.'
                        : 'No bids have been submitted yet.'}
                </p>
                ${isContractor ? `
                    <a href="#/projects" class="btn btn-primary">
                        <i class="fas fa-search"></i> Browse Projects
                    </a>
                ` : ''}
            </div>
        `;
    },
    
    // Get bid details template
    getBidDetailsTemplate(bid) {
        const project = bid.project || {};
        const statusColor = this.getBidStatusColor(bid.status);
        
        return `
            <div class="bid-details">
                <div class="bid-details-header">
                    <h3>${project.title || 'Project #' + bid.project_id}</h3>
                    <span class="badge badge-${statusColor} badge-lg">${bid.status}</span>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="detail-group">
                            <h5>Bid Information</h5>
                            <dl class="detail-list">
                                <dt>Amount</dt>
                                <dd class="text-primary font-weight-bold">${Formatter.currency(bid.amount)}</dd>
                                
                                <dt>Submitted By</dt>
                                <dd>${bid.user_name || 'Unknown'}</dd>
                                
                                <dt>Company</dt>
                                <dd>${bid.company_name || 'N/A'}</dd>
                                
                                <dt>Submitted Date</dt>
                                <dd>${Formatter.datetime(bid.created_at)}</dd>
                                
                                ${bid.alternate_delivery_date ? `
                                    <dt>Proposed Delivery Date</dt>
                                    <dd>${Formatter.date(bid.alternate_delivery_date)}</dd>
                                ` : ''}
                            </dl>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="detail-group">
                            <h5>Project Information</h5>
                            <dl class="detail-list">
                                <dt>Project Title</dt>
                                <dd>${project.title || 'N/A'}</dd>
                                
                                <dt>Location</dt>
                                <dd>${project.zip_code || 'N/A'}</dd>
                                
                                <dt>Original Delivery Date</dt>
                                <dd>${Formatter.date(project.delivery_date)}</dd>
                                
                                <dt>Project Status</dt>
                                <dd>${project.status || 'Unknown'}</dd>
                                
                                <dt>Project Manager</dt>
                                <dd>${project.project_manager_name || 'N/A'}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
                
                ${bid.comments ? `
                    <div class="detail-group">
                        <h5>Comments</h5>
                        <div class="comments-box">
                            ${bid.comments}
                        </div>
                    </div>
                ` : ''}
                
                ${bid.files && bid.files.length > 0 ? `
                    <div class="detail-group">
                        <h5>Attached Files</h5>
                        <div class="file-list">
                            ${bid.files.map(file => this.getFileTemplate(file)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get file template
    getFileTemplate(file) {
        const icon = FileUpload.getFileIcon(file.filename);
        
        return `
            <div class="file-item">
                <div class="file-info">
                    <i class="${icon}"></i>
                    <span class="file-name">${file.original_name || file.filename}</span>
                    <span class="file-size">${Formatter.fileSize(file.size)}</span>
                </div>
                <a href="/api/files/download/${file.id}" 
                   class="btn btn-sm btn-outline"
                   target="_blank">
                    <i class="fas fa-download"></i> Download
                </a>
            </div>
        `;
    },
    
    // Get bid statistics card
    getBidStatsCard(stats) {
        return `
            <div class="stats-card">
                <div class="stats-header">
                    <h4>Bid Statistics</h4>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.total || 0}</div>
                        <div class="stat-label">Total Bids</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.pending || 0}</div>
                        <div class="stat-label">Pending</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.won || 0}</div>
                        <div class="stat-label">Won</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${Formatter.currency(stats.total_value || 0)}</div>
                        <div class="stat-label">Total Value</div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get quick bid form template
    getQuickBidForm(projectId) {
        return `
            <form id="quickBidForm" class="quick-bid-form">
                <input type="hidden" name="project_id" value="${projectId}">
                
                <div class="form-group">
                    <label>Bid Amount <span class="required">*</span></label>
                    <div class="input-group">
                        <div class="input-group-prepend">
                            <span class="input-group-text">$</span>
                        </div>
                        <input type="number" 
                               class="form-control" 
                               name="amount" 
                               required 
                               min="0" 
                               step="0.01"
                               placeholder="Enter your bid amount">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Alternate Delivery Date</label>
                    <input type="date" 
                           class="form-control" 
                           name="alternate_delivery_date">
                    <small class="form-text text-muted">
                        Leave blank to use project's default delivery date
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Comments</label>
                    <textarea class="form-control" 
                              name="comments" 
                              rows="3"
                              placeholder="Add any additional information or questions"></textarea>
                </div>
                
                <div class="form-group">
                    <label>Attachments</label>
                    <div class="file-upload-area" 
                         id="bidFileUpload"
                         onclick="BidsComponent.selectFiles()">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Click to upload files or drag and drop</p>
                        <small>PDF, DOC, DOCX, XLS, XLSX (Max 10MB each)</small>
                    </div>
                    <div id="fileList" class="file-list mt-2"></div>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-paper-plane"></i> Submit Bid
                    </button>
                    <button type="button" class="btn btn-outline" onclick="BidsComponent.cancelBid()">
                        Cancel
                    </button>
                </div>
            </form>
        `;
    }
};

// Register globally
window.BidTemplates = BidTemplates;