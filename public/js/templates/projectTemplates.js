// Capital Choice Platform - Project Templates

const ProjectTemplates = {
    // Get project card template
    getProjectCard(project) {
        const user = State.getUser();
        const isManager = user.id === project.project_manager_id;
        const isContractor = ['installation_company', 'operations'].includes(user.role);
        const status = Formatter.status(project.status, 'project');
        
        // UPDATED: Determine which button to show for contractors
        const showBidButton = isContractor && project.status === 'bidding' && !project.has_bid;
        const showViewBidButton = isContractor && project.has_bid;
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-card-header">
                    <h5 class="project-title">${project.title}</h5>
                    ${status}
                </div>
                
                <div class="project-card-body">
                    <div class="project-meta">
                        <span><i class="fas fa-user"></i> ${project.project_manager_name || 'Unknown'}
                            ${project.project_manager_email ? ` • ${project.project_manager_email}` : ''}
                        </span>
                        <span><i class="fas fa-map-marker-alt"></i> ${project.zip_code}</span>
                        <span><i class="fas fa-calendar"></i> Due ${Formatter.datetime(project.bid_due_date)}</span>
                        <span><i class="fas fa-truck"></i> Delivery ${Formatter.datetime(project.delivery_date)}</span>
                    </div>
                    
                    ${project.description ? `
                        <p class="project-description">${project.description}</p>
                    ` : ''}
                    
                    ${project.show_max_bid && project.max_bid ? `
                        <div class="project-budget">
                            <strong>Max Budget:</strong> ${Formatter.currency(project.max_bid)}
                        </div>
                    ` : ''}
                    
                    ${isManager || user.role === 'admin' ? `
                        <div class="project-stats">
                            <span><i class="fas fa-gavel"></i> ${project.bid_count || 0} bids</span>
                            ${project.lowest_bid ? `
                                <span>Low: ${Formatter.currency(project.lowest_bid)}</span>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                
                ${(isManager || showBidButton || showViewBidButton) ? `
                    <div class="project-card-footer">
                        <div class="btn-group">
                            ${isManager && project.status === 'draft' ? `
                                <button class="btn btn-sm btn-outline" 
                                        onclick="ProjectsComponent.editProject(${project.id})">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                            ` : ''}
                            
                            ${showBidButton ? `
                                <button class="btn btn-sm btn-primary" 
                                        onclick="ProjectsComponent.showBidModal(${project.id})">
                                    <i class="fas fa-gavel"></i> Place Bid
                                </button>
                            ` : ''}
                            
                            ${showViewBidButton ? `
                                <button class="btn btn-sm btn-info" 
                                        onclick="ProjectsComponent.viewUserBid(${project.id})">
                                    <i class="fas fa-eye"></i> View ${project.user_bid_status === 'won' ? 'Winning' : 'Your'} Bid
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-sm btn-outline" 
                                    onclick="ProjectsComponent.viewProject(${project.id})">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get project stats template
    getProjectStats(project) {
        return `
            <div class="project-card-stats">
                <div class="project-stat">
                    <span class="project-stat-icon"><i class="fas fa-map-marker-alt"></i></span>
                    <span class="project-stat-value">${project.zip_code}</span>
                </div>
                <div class="project-stat">
                    <span class="project-stat-icon"><i class="fas fa-clock"></i></span>
                    <span class="project-stat-value">Due ${Formatter.datetime(project.bid_due_date)}</span>
                </div>
                <div class="project-stat">
                    <span class="project-stat-icon"><i class="fas fa-truck"></i></span>
                    <span class="project-stat-value">${Formatter.datetime(project.delivery_date)}</span>
                </div>
                <div class="project-stat">
                    <span class="project-stat-icon"><i class="fas fa-gavel"></i></span>
                    <span class="project-stat-value">${project.bid_count || 0} bids</span>
                </div>
            </div>
        `;
    },
    
    // Get project list item template
    getProjectListItem(project, options = {}) {
        const {
            showCheckbox = false,
            showActions = true
        } = options;
        
        const status = Formatter.status(project.status, 'project');
        
        return `
            <div class="project-list-item" data-project-id="${project.id}">
                ${showCheckbox ? `
                    <div class="project-checkbox">
                        <input type="checkbox" 
                               class="form-check-input" 
                               value="${project.id}">
                    </div>
                ` : ''}
                
                <div class="project-info">
                    <div class="project-title">
                        <a href="#/projects/${project.id}">${project.title}</a>
                        <span class="badge badge-${status.color} ml-2">
                            ${status.label}
                        </span>
                    </div>
                    <div class="project-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${project.zip_code}</span>
                        <span><i class="fas fa-calendar"></i> Due ${Formatter.datetime(project.bid_due_date)}</span>
                        <span><i class="fas fa-gavel"></i> ${project.bid_count || 0} bids</span>
                        ${project.show_max_bid && project.max_bid ? 
                            `<span><i class="fas fa-dollar-sign"></i> Max: ${Formatter.currency(project.max_bid)}</span>` 
                            : ''}
                    </div>
                </div>
                
                ${showActions ? `
                    <div class="project-actions">
                        <button class="btn btn-sm btn-outline" 
                                onclick="ProjectsComponent.viewProject(${project.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get project timeline template
    getProjectTimeline(events) {
        if (!events || events.length === 0) {
            return '<p class="text-muted">No timeline events yet</p>';
        }
        
        return `
            <div class="project-timeline">
                ${events.map(event => this.getTimelineEvent(event)).join('')}
            </div>
        `;
    },
    
    // Get timeline event template
    getTimelineEvent(event) {
        const icon = this.getEventIcon(event.type);
        const color = this.getEventColor(event.type);
        
        return `
            <div class="timeline-item">
                <div class="timeline-marker ${color}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="timeline-date">${Formatter.datetime(event.created_at)}</span>
                        ${event.user_name ? 
                            `<span class="timeline-user">by ${event.user_name}</span>` 
                            : ''}
                    </div>
                    <div class="timeline-body">
                        <strong>${event.title}</strong>
                        ${event.description ? `<p>${event.description}</p>` : ''}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get event icon
    getEventIcon(type) {
        const icons = {
            created: 'fa-plus-circle',
            updated: 'fa-edit',
            status_changed: 'fa-exchange-alt',
            bid_received: 'fa-gavel',
            bid_accepted: 'fa-check-circle',
            bid_rejected: 'fa-times-circle',
            awarded: 'fa-trophy',
            completed: 'fa-flag-checkered',
            comment: 'fa-comment',
            file_uploaded: 'fa-paperclip'
        };
        
        return icons[type] || 'fa-circle';
    },
    
    // Get event color
    getEventColor(type) {
        const colors = {
            created: 'primary',
            updated: 'info',
            status_changed: 'warning',
            bid_received: 'info',
            bid_accepted: 'success',
            bid_rejected: 'danger',
            awarded: 'success',
            completed: 'success',
            comment: 'secondary',
            file_uploaded: 'secondary'
        };
        
        return colors[type] || 'secondary';
    },
    
    // Get project detail header template
    getProjectDetailHeader(project) {
        const status = Formatter.status(project.status, 'project');
        
        return `
            <div class="project-detail-header">
                <div class="project-detail-title">
                    <h2>${project.title}</h2>
                    <div class="project-badges">
                        <span class="badge badge-${status.color} badge-lg">
                            <i class="fas ${status.icon}"></i> ${status.label}
                        </span>
                        ${project.priority ? `
                            <span class="badge badge-danger badge-lg">
                                <i class="fas fa-exclamation-triangle"></i> High Priority
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="project-detail-actions">
                    ${this.getProjectActions(project)}
                </div>
            </div>
        `;
    },
    
    // Get project actions based on status and role
    getProjectActions(project) {
        const user = State.getUser();
        const isManager = user.id === project.project_manager_id;
        const isContractor = ['installation_company', 'operations'].includes(user.role);
        const isAdmin = user.role === 'admin';
        const actions = [];
        
        if (isManager) {
            if (project.status === 'draft') {
                actions.push(`
                    <button class="btn btn-success" onclick="ProjectsComponent.startBidding(${project.id})">
                        <i class="fas fa-play"></i> Start Bidding
                    </button>
                `);
            }
            
            if (project.status === 'reviewing' && project.bids?.length > 0) {
                actions.push(`
                    <button class="btn btn-primary" onclick="ProjectsComponent.showAwardModal(${project.id})">
                        <i class="fas fa-trophy"></i> Award Project
                    </button>
                `);
            }
            
            if (project.status === 'awarded') {
                actions.push(`
                    <button class="btn btn-success" onclick="ProjectsComponent.markComplete(${project.id})">
                        <i class="fas fa-check"></i> Mark Complete
                    </button>
                `);
            }
            
            if (['draft', 'bidding'].includes(project.status)) {
                actions.push(`
                    <button class="btn btn-outline" onclick="ProjectsComponent.editProject(${project.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                `);
            }

            if ((isAdmin || isManager) && !['awarded', 'completed'].includes(project.status)) {
                actions.push(`
                    <button class="btn btn-danger" onclick="ProjectsComponent.showDeleteConfirmation(${project.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `);
            } else if ((isAdmin || isManager) && ['awarded', 'completed'].includes(project.status)) {
                // Show disabled delete button with tooltip
                actions.push(`
                    <button class="btn btn-danger" disabled 
                            data-bs-toggle="tooltip" 
                            data-bs-placement="top" 
                            title="Cannot delete ${project.status} projects">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                `);
            }
        }
        
        // UPDATED SECTION: Check if contractor has already placed a bid
        if (isContractor && project.status === 'bidding') {
            if (project.has_bid) {
                // Installer has already placed a bid - show View Bid button
                actions.push(`
                    <button class="btn btn-info" onclick="ProjectsComponent.viewUserBid(${project.id})">
                        <i class="fas fa-eye"></i> View Your Bid
                    </button>
                `);
            } else {
                // Installer hasn't placed a bid yet - show Place Bid button
                actions.push(`
                    <button class="btn btn-primary" onclick="ProjectsComponent.showBidModal(${project.id})">
                        <i class="fas fa-gavel"></i> Place Bid
                    </button>
                `);
            }
        }
        
        // Also show View Bid button for other statuses if the installer has a bid
        if (isContractor && project.has_bid && project.status !== 'bidding') {
            const statusLabel = project.user_bid_status === 'won' ? 'Winning' : 
                            project.user_bid_status === 'lost' ? 'Lost' : 'Your';
            actions.push(`
                <button class="btn btn-info" onclick="ProjectsComponent.viewUserBid(${project.id})">
                    <i class="fas fa-eye"></i> View ${statusLabel} Bid
                </button>
            `);
        }
        
        return actions.join(' ');
    },
    
    // Get project info box template
    getProjectInfoBox(project) {
        return `
            <div class="info-box">
                <h5 class="info-box-title">Project Information</h5>
                <dl class="info-list">
                    <dt>Project ID</dt>
                    <dd>#${project.id}</dd>
                    
                    <dt>Project Manager</dt>
                    <dd>${project.manager_name || 'Unknown'}</dd>
                    
                    <dt>Location</dt>
                    <dd>${project.zip_code}</dd>
                    
                    <dt>Created</dt>
                    <dd>${Formatter.datetime(project.created_at)}</dd>
                    
                    <dt>Bid Due Date</dt>
                    <dd>${Formatter.datetime(project.bid_due_date)}</dd>
                    
                    <dt>Delivery Date</dt>
                    <dd>${Formatter.datetime(project.delivery_date)}</dd>
                    
                    ${project.show_max_bid && project.max_bid ? `
                        <dt>Maximum Bid</dt>
                        <dd>${Formatter.currency(project.max_bid)}</dd>
                    ` : ''}
                    
                    ${project.awarded_amount ? `
                        <dt>Awarded Amount</dt>
                        <dd>${Formatter.currency(project.awarded_amount)}</dd>
                    ` : ''}
                    
                    ${project.awarded_to ? `
                        <dt>Awarded To</dt>
                        <dd>${project.awarded_to_name}</dd>
                    ` : ''}
                    
                    <dt>Total Bids</dt>
                    <dd>${project.bid_count || 0}</dd>
                </dl>
            </div>
        `;
    },
    
    // Get project files template
    getProjectFiles(files) {
        if (!files || files.length === 0) {
            return `
                <div class="empty-state-small">
                    <i class="fas fa-folder-open"></i>
                    <p>No files uploaded yet</p>
                </div>
            `;
        }
        
        return `
            <div class="file-list">
                ${files.map(file => this.getFileItem(file)).join('')}
            </div>
        `;
    },
    

    // Get file item template
    getFileItem(file) {
        const icon = FileUpload.getFileIcon(file.original_name || file.name);
        
        return `
            <div class="file-item" data-file-id="${file.id}">
                <div class="file-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="file-details">
                    <div class="file-name">
                        <a href="#" onclick="event.preventDefault(); ProjectsComponent.downloadFile(${file.id}, '${(file.original_name || file.name).replace(/'/g, "\\'")}'); return false;">
                            ${file.original_name || file.name}
                        </a>
                    </div>
                    <div class="file-meta">
                        <span>${Formatter.fileSize(file.size)}</span>
                        <span>•</span>
                        <span>${Formatter.timeAgo(file.created_at)}</span>
                        <span>•</span>
                        <span>by ${file.uploaded_by_name || 'Unknown'}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-icon" onclick="event.preventDefault(); ProjectsComponent.downloadFile(${file.id}, '${(file.original_name || file.name).replace(/'/g, "\\'")}'); return false;">
                        <i class="fas fa-download"></i>
                    </button>
                    ${State.getUserId() === file.uploaded_by ? `
                        <button class="btn-icon" onclick="FileUpload.deleteFile(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    // Get project bids table template
    getProjectBidsTable(bids) {
        if (!bids || bids.length === 0) {
            return `
                <div class="empty-state-small">
                    <i class="fas fa-gavel"></i>
                    <p>No bids received yet</p>
                </div>
            `;
        }
        
        return `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Bidder</th>
                            <th>Company</th>
                            <th>Amount</th>
                            <th>Delivery Date</th>
                            <th>Submitted</th>
                            <th>Status</th>
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
    
    // Get bid row template
    getBidRow(bid) {
        const status = Formatter.status(bid.status, 'bid');
        
        return `
            <tr data-bid-id="${bid.id}">
                <td>
                    <div class="user-info">
                        <img src="${bid.user_avatar || '/images/default-avatar.png'}" 
                             class="user-avatar-sm" 
                             alt="${bid.user_name}">
                        <span>${bid.user_name}</span>
                    </div>
                </td>
                <td>${bid.company || '-'}</td>
                <td class="font-weight-bold">${Formatter.currency(bid.amount)}</td>
                <td>${Formatter.datetime(bid.delivery_date)}</td>
                <td>${Formatter.timeAgo(bid.created_at)}</td>
                <td>
                    <span class="badge badge-${status.color}">
                        ${status.label}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline" 
                            onclick="BidsComponent.viewBid(${bid.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${bid.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" 
                                onclick="ProjectsComponent.acceptBid(${bid.id})">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    },
    
    // Get empty project template
    getEmptyProjectsTemplate(message = 'No projects found') {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-project-diagram"></i>
                </div>
                <h3 class="empty-state-title">${message}</h3>
                <p class="empty-state-description">
                    ${Auth.hasRole(['project_manager', 'admin']) 
                        ? 'Get started by creating your first project using the button above.'
                        : 'Check back later for new projects to bid on.'}
                </p>
            </div>
        `;
    },
    
    // Get project summary card
    getProjectSummaryCard(project) {
        return `
            <div class="summary-card">
                <div class="summary-card-header">
                    <h5>${project.title}</h5>
                    ${this.getStatusBadge(project.status)}
                </div>
                <div class="summary-card-body">
                    <div class="summary-stats">
                        <div class="summary-stat">
                            <span class="stat-label">Bids</span>
                            <span class="stat-value">${project.bid_count || 0}</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-label">Due</span>
                            <span class="stat-value">${Formatter.datetime(project.bid_due_date)}</span>
                        </div>
                        ${project.awarded_amount ? `
                            <div class="summary-stat">
                                <span class="stat-label">Awarded</span>
                                <span class="stat-value">${Formatter.currency(project.awarded_amount)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="summary-card-footer">
                    <a href="#/projects/${project.id}" class="btn btn-sm btn-outline">
                        View Details <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
        `;
    },
    
    // Get status badge
    getStatusBadge(status) {
        const config = Formatter.status(status, 'project');
        return `
            <span class="badge badge-${config.color}">
                <i class="fas ${config.icon}"></i> ${config.label}
            </span>
        `;
    }
};

// Register globally
window.ProjectTemplates = ProjectTemplates;