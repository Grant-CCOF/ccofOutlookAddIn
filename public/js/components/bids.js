// Capital Choice Platform - Bids Component

const BidsComponent = {
    // Component state
    state: {
        bids: [],
        filters: {
            status: '',
            projectId: '',
            sortBy: 'created_at',
            sortOrder: 'desc'
        },
        currentPage: 1,
        totalPages: 1,
        selectedBid: null
    },
    
    // Render bids list
    async render() {
        try {
            App.showLoading(true);
            
            const user = State.getUser();
            const content = this.getLayoutForRole(user.role);
            
            DOM.setHTML('pageContent', content);
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Load bids
            await this.loadBids();
            
        } catch (error) {
            Config.error('Failed to render bids:', error);
            App.showError('Failed to load bids');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Get layout based on user role
    getLayoutForRole(role) {
        if (role === 'admin' || role === 'project_manager') {
            return this.getManagerLayout();
        }
        
        return this.getContractorLayout();
    },
    
    // Get manager layout
    getManagerLayout() {
        return `
            <div class="bids-container">
                <!-- Filters -->
                <div class="filter-bar mb-3">
                    <div class="filter-group">
                        <label class="filter-label">Project:</label>
                        <select id="projectFilter" class="form-control filter-select">
                            <option value="">All Projects</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label class="filter-label">Status:</label>
                        <select id="statusFilter" class="form-control filter-select">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                </div>
                
                <!-- Bids Table -->
                <div class="card">
                    <div class="card-body">
                        <div class="table-wrapper">
                            <table class="table" id="bidsTable">
                                <thead>
                                    <tr>
                                        <th>Project</th>
                                        <th>Bidder</th>
                                        <th>Amount</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="bidsTableBody">
                                    <!-- Bids will be loaded here -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get contractor layout
    getContractorLayout() {
        return `
            <div class="bids-container">
                <!-- Tabs -->
                <div class="card">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs">
                            <li class="nav-item">
                                <a class="nav-link active" data-tab="active">Active Bids</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="won">Won Bids</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="lost">Lost Bids</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="all">All Bids</a>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="card-body">
                        <div id="bidsList" class="bid-list">
                            <!-- Bids will be loaded here -->
                        </div>
                    </div>
                </div>
                
                <!-- Available Projects -->
                <div class="card mt-4">
                    <div class="card-header">
                        <h3 class="card-title">Available Projects for Bidding</h3>
                        <a href="#/projects" class="btn btn-sm btn-outline">View All</a>
                    </div>
                    <div class="card-body">
                        <div id="availableProjects" class="project-list">
                            <!-- Available projects will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Initialize event listeners
    initializeEventListeners() {
        // Tab switching for contractors
        document.querySelectorAll('.nav-link[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // Filters
        const projectFilter = DOM.get('projectFilter');
        if (projectFilter) {
            projectFilter.addEventListener('change', () => {
                this.state.filters.projectId = projectFilter.value;
                this.loadBids();
            });
        }
        
        const statusFilter = DOM.get('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.state.filters.status = statusFilter.value;
                this.loadBids();
            });
        }
    },
    
    // Load bids
    async loadBids() {
        try {
            const user = State.getUser();
            let bids;
            
            if (user.role === 'admin' || user.role === 'project_manager') {
                // Load all bids for projects managed by this user
                bids = await this.loadManagerBids();
            } else {
                // Load user's own bids
                bids = await API.bids.getMyBids(this.state.filters);
            }
            
            this.state.bids = bids;
            this.renderBids();
            
            // Load available projects for contractors
            if (['installation_company', 'operations'].includes(user.role)) {
                await this.loadAvailableProjects();
            }
            
        } catch (error) {
            Config.error('Failed to load bids:', error);
            this.renderEmptyState();
        }
    },
    
    // Load manager bids
    async loadManagerBids() {
        const user = State.getUser();
        
        // Get all projects for this manager
        const projects = await API.projects.getAll({ 
            manager_id: user.role === 'admin' ? undefined : user.id 
        });
        
        // Load project filter options
        const projectFilter = DOM.get('projectFilter');
        if (projectFilter && projects.length > 0) {
            projectFilter.innerHTML = '<option value="">All Projects</option>' +
                projects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
        }
        
        // Get bids for selected project or all projects
        let allBids = [];
        
        if (this.state.filters.projectId) {
            const projectBids = await API.bids.getProjectBids(this.state.filters.projectId);
            allBids = projectBids;
        } else {
            // Get bids for all projects
            for (const project of projects) {
                const projectBids = await API.bids.getProjectBids(project.id);
                allBids = allBids.concat(projectBids.map(bid => ({
                    ...bid,
                    project_title: project.title,
                    project_status: project.status
                })));
            }
        }
        
        // Apply status filter
        if (this.state.filters.status) {
            allBids = allBids.filter(bid => bid.status === this.state.filters.status);
        }
        
        return allBids;
    },
    
    // Render bids
    renderBids() {
        const user = State.getUser();
        
        if (user.role === 'admin' || user.role === 'project_manager') {
            this.renderManagerBids();
        } else {
            this.renderContractorBids();
        }
    },
    
    // Render manager bids table
    renderManagerBids() {
        const tbody = DOM.get('bidsTableBody');
        
        if (!tbody) return;
        
        if (this.state.bids.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No bids found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.state.bids.map(bid => `
            <tr>
                <td>${bid.project_title || 'Project #' + bid.project_id}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <img src="${bid.user_avatar || '/images/default-avatar.png'}" 
                             class="user-avatar-sm mr-2" alt="">
                        <div>
                            <div>${bid.user_name || 'Unknown'}</div>
                            <small class="text-muted">${bid.company || ''}</small>
                        </div>
                    </div>
                </td>
                <td><strong>${Formatter.currency(bid.amount)}</strong></td>
                <td>${Formatter.date(bid.created_at)}</td>
                <td>
                    <span class="badge badge-${this.getBidStatusColor(bid.status)}">
                        ${bid.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline" 
                            onclick="BidsComponent.viewBid(${bid.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${bid.status === 'pending' ? `
                        <button class="btn btn-sm btn-success" 
                                onclick="BidsComponent.acceptBid(${bid.id})">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },
    
    // Render contractor bids
    renderContractorBids() {
        const container = DOM.get('bidsList');
        
        if (!container) return;
        
        if (this.state.bids.length === 0) {
            container.innerHTML = this.getEmptyBidsMessage();
            return;
        }
        
        container.innerHTML = this.state.bids.map(bid => 
            this.renderBidCard(bid)
        ).join('');
    },
    
    // Render bid card
    renderBidCard(bid) {
        const statusColor = this.getBidStatusColor(bid.status);
        const project = bid.project || {};
        
        return `
            <div class="bid-item" data-bid-id="${bid.id}">
                <div class="bid-header">
                    <div class="bid-info">
                        <div class="bid-company">${project.title || 'Project #' + bid.project_id}</div>
                        <div class="bid-date">
                            Submitted ${Formatter.timeAgo(bid.created_at)}
                        </div>
                    </div>
                    <div class="bid-amount">${Formatter.currency(bid.amount)}</div>
                </div>
                
                <div class="bid-details">
                    <div class="bid-detail">
                        <span class="bid-detail-label">Status</span>
                        <span class="badge badge-${statusColor}">${bid.status}</span>
                    </div>
                    <div class="bid-detail">
                        <span class="bid-detail-label">Delivery</span>
                        <span class="bid-detail-value">
                            ${Formatter.date(bid.alternate_delivery_date || project.delivery_date)}
                        </span>
                    </div>
                    <div class="bid-detail">
                        <span class="bid-detail-label">Location</span>
                        <span class="bid-detail-value">${project.zip_code || 'N/A'}</span>
                    </div>
                </div>
                
                ${bid.comments ? `
                    <div class="bid-comments">
                        <small class="text-muted">Comments:</small>
                        <p>${bid.comments}</p>
                    </div>
                ` : ''}
                
                <div class="bid-actions">
                    <button class="btn btn-sm btn-outline" 
                            onclick="BidsComponent.viewBid(${bid.id})">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    ${bid.status === 'pending' ? `
                        <button class="btn btn-sm btn-outline" 
                                onclick="BidsComponent.editBid(${bid.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" 
                                onclick="BidsComponent.withdrawBid(${bid.id})">
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
            pending: 'warning',
            won: 'success',
            lost: 'danger',
            withdrawn: 'secondary'
        };
        
        return colors[status] || 'secondary';
    },
    
    // Get empty bids message
    getEmptyBidsMessage() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-gavel"></i>
                </div>
                <h3 class="empty-state-title">No Bids Found</h3>
                <p class="empty-state-description">
                    You haven't submitted any bids yet. Check out available projects to get started.
                </p>
                <a href="#/projects" class="btn btn-primary">
                    Browse Projects
                </a>
            </div>
        `;
    },
    
    // Load available projects
    async loadAvailableProjects() {
        try {
            const projects = await API.projects.getAll({ status: 'bidding' });
            const container = DOM.get('availableProjects');
            
            if (!container) return;
            
            if (projects.length === 0) {
                container.innerHTML = '<p class="text-muted">No projects available for bidding at this time.</p>';
                return;
            }
            
            container.innerHTML = projects.slice(0, 5).map(project => `
                <div class="project-list-item">
                    <div class="project-info">
                        <h5>${project.title}</h5>
                        <div class="project-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${project.zip_code}</span>
                            <span><i class="fas fa-calendar"></i> Due ${Formatter.date(project.bid_due_date)}</span>
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm" 
                            onclick="ProjectsComponent.showBidModal(${project.id})">
                        Place Bid
                    </button>
                </div>
            `).join('');
            
        } catch (error) {
            Config.error('Failed to load available projects:', error);
        }
    },
    
    // Switch tab
    switchTab(tab) {
        // Update nav
        document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
            link.classList.toggle('active', link.dataset.tab === tab);
        });
        
        // Filter bids
        let filteredBids = [...this.state.bids];
        
        switch (tab) {
            case 'active':
                filteredBids = filteredBids.filter(b => b.status === 'pending');
                break;
            case 'won':
                filteredBids = filteredBids.filter(b => b.status === 'won');
                break;
            case 'lost':
                filteredBids = filteredBids.filter(b => b.status === 'lost');
                break;
            // 'all' shows everything
        }
        
        // Render filtered bids
        const container = DOM.get('bidsList');
        if (container) {
            if (filteredBids.length === 0) {
                container.innerHTML = this.getEmptyBidsMessage();
            } else {
                container.innerHTML = filteredBids.map(bid => 
                    this.renderBidCard(bid)
                ).join('');
            }
        }
    },
    
    // View bid details (from bids page)
    async viewBid(bidId) {
        BidDetailModal.showBidDetail(bidId);
    },

    // View bid details with additional options
    async viewBidDetails(bidId, options = {}) {
        BidDetailModal.showBidDetail(bidId, options);
    },
    
    // Edit bid
    async editBid(bidId) {
        const bid = this.state.bids.find(b => b.id === bidId);
        if (bid) {
            BidModals.showEditModal(bid);
        }
    },
    
    // Withdraw bid
    async withdrawBid(bidId) {
        if (!confirm('Are you sure you want to withdraw this bid?')) {
            return;
        }
        
        try {
            App.showLoading(true);
            await API.bids.withdraw(bidId);
            App.showSuccess('Bid withdrawn successfully');
            
            // Remove the bid from the current state immediately
            this.state.bids = this.state.bids.filter(b => b.id !== bidId);
            
            // Re-render the view
            this.renderContractorBids();
            
            // Also reload from server to ensure consistency
            await this.loadBids();
            
        } catch (error) {
            App.showError('Failed to withdraw bid');
            // Reload on error to ensure UI is in sync
            await this.loadBids();
        } finally {
            App.showLoading(false);
        }
    },
    
    // Accept bid (for managers)
    async acceptBid(bidId) {
        const bid = this.state.bids.find(b => b.id === bidId);
        if (!bid) {
            App.showError('Bid not found');
            await this.loadBids(); // Refresh if bid doesn't exist
            return;
        }
        
        if (!confirm(`Accept bid of ${Formatter.currency(bid.amount)} from ${bid.user_name}?`)) {
            return;
        }
        
        try {
            App.showLoading(true);
            await API.projects.award(bid.project_id, bidId);
            App.showSuccess('Bid accepted and project awarded');
            
            // Refresh the bids list
            await this.loadBids();
            
            // If we're in a project view, refresh that too
            const currentHash = window.location.hash;
            if (currentHash.includes('/projects/') && window.ProjectsComponent) {
                const projectId = currentHash.split('/projects/')[1];
                if (projectId) {
                    await ProjectsComponent.renderDetail(projectId);
                }
            }
            
        } catch (error) {
            App.showError('Failed to accept bid');
            await this.loadBids(); // Refresh on error
        } finally {
            App.showLoading(false);
        }
    },
    
    // Render bid detail
    async renderDetail(bidId) {
        try {
            App.showLoading(true);
            
            // Load bid details
            // Implementation for bid detail view
            
            App.showError('Bid detail view not implemented');
            Router.navigate('/bids');
            
        } catch (error) {
            Config.error('Failed to load bid details:', error);
            Router.navigate('/bids');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Refresh bids
    async refreshBids() {
        await this.loadBids();
    },

    // ADD this method to render bid details with files:
    renderBidWithFiles(bid) {
        const hasFiles = bid.files && bid.files.length > 0;
        const bidId = bid.id;
        
        return `
            <div class="bid-card card mb-3">
                <div class="card-body">
                    <!-- Main bid information -->
                    <div class="row">
                        <div class="col-md-8">
                            <h5>${bid.project_title || 'Project #' + bid.project_id}</h5>
                            <p class="mb-2">
                                <strong>Bid Amount:</strong> ${Formatter.currency(bid.amount)}<br>
                                <strong>Status:</strong> <span class="badge badge-${this.getStatusBadgeClass(bid.status)}">${bid.status}</span><br>
                                <strong>Submitted:</strong> ${Formatter.date(bid.created_at)}<br>
                                <strong>Delivery Date:</strong> ${this.formatDeliveryDate(bid.alternate_delivery_date, bid.project_delivery_date)}
                            </p>
                            ${bid.comments ? `
                                <p class="mb-2"><strong>Comments:</strong> ${bid.comments}</p>
                            ` : ''}
                        </div>
                        <div class="col-md-4 text-right">
                            <button class="btn btn-primary btn-sm" onclick="BidsComponent.viewBidDetails(${bidId})">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                            ${bid.status === 'pending' ? `
                                <button class="btn btn-warning btn-sm ml-2" onclick="BidsComponent.editBid(${bidId})">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-danger btn-sm ml-2" onclick="BidsComponent.withdrawBid(${bidId})">
                                    <i class="fas fa-times"></i> Withdraw
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Files dropdown section -->
                    ${hasFiles ? `
                        <div class="bid-files-section mt-3">
                            <button class="btn btn-outline-secondary btn-sm" 
                                    type="button" 
                                    data-toggle="collapse" 
                                    data-target="#bidFiles${bidId}"
                                    onclick="this.querySelector('i').classList.toggle('fa-chevron-down'); this.querySelector('i').classList.toggle('fa-chevron-up');">
                                <i class="fas fa-chevron-down"></i> 
                                Attachments (${bid.files.length})
                            </button>
                            <div class="collapse mt-2" id="bidFiles${bidId}">
                                <div class="card card-body">
                                    ${this.renderBidFiles(bid.files)}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="bid-files-section mt-3">
                            <p class="text-muted mb-0">
                                <i class="fas fa-paperclip"></i> No files uploaded with this bid
                            </p>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    // ADD method to format delivery date:
    formatDeliveryDate(alternateDate, projectDate) {
        if (!alternateDate || alternateDate === null || alternateDate === '') {
            return `<span class="text-muted">No change (${Formatter.date(projectDate)})</span>`;
        }
        return `<span class="text-warning"><i class="fas fa-exclamation-triangle"></i> ${Formatter.date(alternateDate)} (Alternate)</span>`;
    },

    // ADD method to render bid files:
    renderBidFiles(files) {
        if (!files || files.length === 0) {
            return '<p class="text-muted mb-0">No files attached</p>';
        }
        
        return `
            <div class="bid-files-list">
                ${files.map(file => `
                    <div class="bid-file-item d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <i class="fas ${this.getFileIcon(file.original_name || file.name)} mr-2"></i>
                            <span>${file.original_name || file.name}</span>
                            <small class="text-muted ml-2">(${this.formatFileSize(file.size || file.file_size)})</small>
                        </div>
                        <button class="btn btn-sm btn-primary" 
                                onclick="API.files.download(${file.id}, '${(file.original_name || file.name)}').catch(err => App.showError('Failed to download file'))">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf',
            'doc': 'fa-file-word',
            'docx': 'fa-file-word',
            'xls': 'fa-file-excel',
            'xlsx': 'fa-file-excel',
            'txt': 'fa-file-alt'
        };
        return iconMap[ext] || 'fa-file';
    },

    formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

// Register component
window.BidsComponent = BidsComponent;