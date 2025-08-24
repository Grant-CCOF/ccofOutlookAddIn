// Capital Choice Platform - Projects Component

const ProjectsComponent = {
    // Component state
    state: {
        projects: [],
        filters: {
            status: '',
            search: '',
            sortBy: 'created_at',
            sortOrder: 'desc'
        },
        currentPage: 1,
        totalPages: 1,
        selectedProject: null
    },
    
    // Render projects list
    async render() {
        try {
            App.showLoading(true);
            
            const user = State.getUser();
            const isAdmin = user.role === 'admin';
            const canCreateProjects = ['project_manager', 'admin'].includes(user.role);
            
            // Set page actions - Always show Create Project button for authorized users
            if (canCreateProjects) {
                DOM.setHTML('pageActions', `
                    <button class="btn btn-primary" onclick="ProjectsComponent.showCreateModal()">
                        <i class="fas fa-plus"></i> New Project
                    </button>
                `);
            } else {
                DOM.setHTML('pageActions', `
                    <button class="btn btn-outline" onclick="ProjectsComponent.toggleView()">
                        <i class="fas fa-th"></i> View
                    </button>
                `);
            }
            
            // Render layout with always-visible create button in the search bar
            const content = `
                <div class="projects-container">
                    <!-- Search and Filters -->
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="row align-items-center">
                                <div class="col-md-4">
                                    <div class="search-box">
                                        <i class="fas fa-search search-icon"></i>
                                        <input type="text" 
                                            class="form-control search-input" 
                                            id="projectSearch"
                                            placeholder="Search projects...">
                                        <button class="clear-search" id="clearSearch" style="display: none;">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="col-md-6">
                                    <div class="d-flex gap-2">
                                        <select class="form-control" id="statusFilter">
                                            <option value="">All Status</option>
                                            <option value="draft">Draft</option>
                                            <option value="bidding">Open for Bidding</option>
                                            <option value="reviewing">Under Review</option>
                                            <option value="awarded">Awarded</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                        
                                        <select class="form-control" id="sortBy">
                                            <option value="created_at_desc">Newest First</option>
                                            <option value="created_at_asc">Oldest First</option>
                                            <option value="bid_due_date_asc">Due Date (Earliest)</option>
                                            <option value="bid_due_date_desc">Due Date (Latest)</option>
                                            <option value="title_asc">Title (A-Z)</option>
                                            <option value="title_desc">Title (Z-A)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="col-md-2 text-right">
                                    ${canCreateProjects ? `
                                        <button class="btn btn-primary btn-icon-text" onclick="ProjectsComponent.showCreateModal()">
                                            <i class="fas fa-plus-circle"></i>
                                            <span>Create Project</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Projects List -->
                    <div id="projectsList"></div>
                    
                    <!-- Pagination -->
                    <div class="pagination-container" id="projectsPagination"></div>
                </div>
            `;
            
            DOM.setHTML('pageContent', content);
            this.initializeEventListeners();
            await this.loadProjects();
            
        } catch (error) {
            Config.error('Failed to render projects:', error);
            App.showError('Failed to load projects');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Get page actions based on role
    getPageActions() {
        const user = State.getUser();
        
        if (!user) return '';
        
        if (user.role === 'project_manager' || user.role === 'admin') {
            return `
                <button class="btn btn-primary" onclick="ProjectsComponent.showCreateModal()">
                    <i class="fas fa-plus"></i> New Project
                </button>
            `;
        }
        
        return `
            <button class="btn btn-outline" onclick="ProjectsComponent.toggleView()">
                <i class="fas fa-th"></i> View
            </button>
        `;
    },
    
    // Initialize event listeners
    initializeEventListeners() {
        // Search
        const searchInput = DOM.get('projectSearch');
        if (searchInput) {
            searchInput.addEventListener('input', DOM.debounce((e) => {
                this.state.filters.search = e.target.value;
                this.loadProjects();
                
                // Show/hide clear button
                DOM.toggle('clearSearch');
            }, 300));
        }
        
        // Clear search
        DOM.on('clearSearch', 'click', () => {
            DOM.setValue('projectSearch', '');
            this.state.filters.search = '';
            this.loadProjects();
            DOM.hide('clearSearch');
        });
        
        // Status filter
        DOM.on('statusFilter', 'change', (e) => {
            this.state.filters.status = e.target.value;
            this.loadProjects();
        });
        
        // Sort
        DOM.on('sortBy', 'change', (e) => {
            this.state.filters.sortBy = e.target.value;
            this.loadProjects();
        });
        
        // Reset filters
        DOM.on('resetFilters', 'click', () => {
            this.resetFilters();
        });
    },
    
    // Load projects
    async loadProjects() {
        try {
            const params = {
                page: this.state.currentPage,
                limit: Config.DEFAULT_PAGE_SIZE,
                ...this.state.filters
            };
            
            const response = await API.projects.getAll(params);
            
            this.state.projects = response.data || response;
            this.state.totalPages = response.totalPages || 1;
            
            this.renderProjects();
            this.renderPagination();
            
        } catch (error) {
            Config.error('Failed to load projects:', error);
            this.renderEmptyState();
        }
    },
    
    // Render projects
    renderProjects() {
        const container = DOM.get('projectsList');
        
        if (!this.state.projects || this.state.projects.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        const user = State.getUser();
        const projectCards = this.state.projects.map(project => 
            this.renderProjectCard(project, user)
        ).join('');
        
        container.innerHTML = projectCards;
        
        // Add click handlers
        container.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn')) {
                    const projectId = card.dataset.projectId;
                    this.viewProject(projectId);
                }
            });
        });
    },
    
    // Render project card
    renderProjectCard(project, user) {
        const status = Formatter.status(project.status, 'project');
        const isManager = user.id === project.project_manager_id;
        const canBid = ['installation_company', 'operations'].includes(user.role) && 
                      project.status === 'bidding';
        
        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-card-header">
                    <h4 class="project-card-title">${project.title}</h4>
                    <span class="badge badge-${status.color}">
                        <i class="fas ${status.icon}"></i> ${status.label}
                    </span>
                </div>
                
                <div class="project-card-body">
                    <div class="project-card-description">
                        ${Formatter.truncate(project.description, 150)}
                    </div>
                    
                    <div class="project-card-stats">
                        <div class="project-stat">
                            <span class="project-stat-label">Location</span>
                            <span class="project-stat-value">${project.zip_code}</span>
                        </div>
                        <div class="project-stat">
                            <span class="project-stat-label">Bid Due</span>
                            <span class="project-stat-value">${Formatter.date(project.bid_due_date)}</span>
                        </div>
                        <div class="project-stat">
                            <span class="project-stat-label">Delivery</span>
                            <span class="project-stat-value">${Formatter.date(project.delivery_date)}</span>
                        </div>
                        <div class="project-stat">
                            <span class="project-stat-label">Bids</span>
                            <span class="project-stat-value">${project.bid_count || 0}</span>
                        </div>
                    </div>
                    
                    ${project.show_max_bid && project.max_bid ? `
                        <div class="project-max-bid">
                            Max Bid: <strong>${Formatter.currency(project.max_bid)}</strong>
                        </div>
                    ` : ''}
                </div>
                
                <div class="project-card-footer">
                    <div class="project-card-meta">
                        <i class="fas fa-user"></i> ${project.project_manager_name || 'Unknown'}
                    </div>
                    
                    <div class="project-card-actions">
                        ${isManager ? `
                            <button class="btn btn-sm btn-outline" 
                                    onclick="ProjectsComponent.editProject(${project.id})">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                        ` : ''}
                        
                        ${canBid ? `
                            <button class="btn btn-sm btn-primary" 
                                    onclick="ProjectsComponent.showBidModal(${project.id})">
                                <i class="fas fa-gavel"></i> Place Bid
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-outline" 
                                onclick="ProjectsComponent.viewProject(${project.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Render empty state
    renderEmptyState() {
        const container = DOM.get('projectsList');
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-project-diagram"></i>
                </div>
                <h2 class="empty-state-title">No Projects Found</h2>
                <p class="empty-state-description">
                    ${this.state.filters.search || this.state.filters.status 
                        ? 'Try adjusting your filters to find projects.' 
                        : 'There are no projects available at this time.'}
                </p>
                ${Auth.hasRole(['project_manager', 'admin']) ? `
                    <button class="btn btn-primary" onclick="ProjectsComponent.showCreateModal()">
                        <i class="fas fa-plus"></i> Create First Project
                    </button>
                ` : ''}
            </div>
        `;
    },
    
    // Render pagination
    renderPagination() {
        const container = DOM.get('projectsPagination');
        
        if (this.state.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="pagination-item ${this.state.currentPage === 1 ? 'disabled' : ''}"
                    onclick="ProjectsComponent.goToPage(${this.state.currentPage - 1})"
                    ${this.state.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= Math.min(this.state.totalPages, 5); i++) {
            paginationHTML += `
                <button class="pagination-item ${i === this.state.currentPage ? 'active' : ''}"
                        onclick="ProjectsComponent.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (this.state.totalPages > 5) {
            paginationHTML += '<span class="pagination-ellipsis">...</span>';
            paginationHTML += `
                <button class="pagination-item"
                        onclick="ProjectsComponent.goToPage(${this.state.totalPages})">
                    ${this.state.totalPages}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button class="pagination-item ${this.state.currentPage === this.state.totalPages ? 'disabled' : ''}"
                    onclick="ProjectsComponent.goToPage(${this.state.currentPage + 1})"
                    ${this.state.currentPage === this.state.totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        container.innerHTML = paginationHTML;
    },
    
    // Go to page
    goToPage(page) {
        if (page < 1 || page > this.state.totalPages) return;
        
        this.state.currentPage = page;
        this.loadProjects();
    },
    
    // View project details
    async viewProject(projectId) {
        Router.navigate(`/projects/${projectId}`);
    },
    
    // Render project detail
    async renderDetail(projectId) {
        try {
            App.showLoading(true);
            
            const project = await API.projects.getById(projectId);
            this.state.selectedProject = project;
            // Load bids only if user has permission
            if (this.shouldShowBidsTab()) {
                try {
                    project.bids = await API.bids.getProjectBids(projectId);
                } catch (error) {
                    console.error('Failed to load bids:', error);
                    project.bids = [];
                }
            } else {
                // Explicitly don't load bids for installation companies
                project.bids = null;
            }

            // Load project files
            try {
                project.files = await API.files.getProjectFiles(projectId);
            } catch (error) {
                console.error('Failed to load project files:', error);
                project.files = [];
            }
            
            const content = this.renderProjectDetail(project);
            DOM.setHTML('pageContent', content);
            
            // Initialize tabs and other interactions
            this.initializeDetailEventListeners();
            
        } catch (error) {
            Config.error('Failed to load project details:', error);
            App.showError('Failed to load project details');
            Router.navigate('/projects');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Render project detail view
    renderProjectDetail(project) {
        const user = State.getUser();
        const status = Formatter.status(project.status, 'project');
        const isManager = user.id === project.project_manager_id;
        const isAdmin = user.role === 'admin';
        const canBid = ['installation_company', 'operations'].includes(user.role) && 
                    project.status === 'bidding';
        
        return `
            <div class="project-detail">
                <!-- Project Header -->
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h2>${project.title}</h2>
                                <div class="project-meta mt-2">
                                    <span class="badge badge-${status.color}">
                                        <i class="fas ${status.icon}"></i> ${status.label}
                                    </span>
                                    <span class="text-muted ml-3">
                                        <i class="fas fa-user"></i> ${project.project_manager_name}
                                    </span>
                                    <span class="text-muted ml-3">
                                        <i class="fas fa-calendar"></i> Created ${Formatter.date(project.created_at)}
                                    </span>
                                </div>
                            </div>
                            
                            <div class="project-actions">
                                ${(isManager || isAdmin) ? this.renderManagerActions(project, isAdmin) : ''}
                                ${canBid || (isAdmin && !canBid) ? `
                                    <button class="btn btn-primary" onclick="ProjectsComponent.showBidModal(${project.id})">
                                        <i class="fas fa-gavel"></i> Place Bid${isAdmin && !canBid ? ' (Admin)' : ''}
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Apple-Style Tabs WITHOUT TIMELINE -->
                <div class="apple-tabs-container mt-3">
                    <ul class="apple-tabs">
                        <li class="apple-tab-item">
                            <button class="apple-tab-link active" data-tab="details">
                                <i class="fas fa-info-circle tab-icon"></i>
                                <span>Details</span>
                            </button>
                        </li>
                        ${this.shouldShowBidsTab() ? `
                            <li class="apple-tab-item">
                                <button class="apple-tab-link" data-tab="bids">
                                    <i class="fas fa-gavel tab-icon"></i>
                                    <span>Bids</span>
                                    <span class="apple-tab-badge">${project.bids?.length || 0}</span>
                                </button>
                            </li>
                        ` : ''}
                        <li class="apple-tab-item">
                            <button class="apple-tab-link" data-tab="files">
                                <i class="fas fa-folder tab-icon"></i>
                                <span>Files</span>
                                <span class="apple-tab-badge">${project.files?.length || 0}</span>
                            </button>
                        </li>
                    </ul>
                </div>
                
                <!-- Tab Content WITHOUT TIMELINE -->
                <div class="apple-tab-content">
                    <div class="apple-tab-pane active" data-tab-content="details">
                        ${this.renderProjectDetailsTab(project)}
                    </div>
                    
                    ${this.shouldShowBidsTab() ? `
                        <div class="apple-tab-pane" data-tab-content="bids">
                            ${this.renderProjectBidsTab(project)}
                        </div>
                    ` : ''}
                    
                    <div class="apple-tab-pane" data-tab-content="files">
                        ${this.renderProjectFilesTab(project)}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Render manager actions
    renderManagerActions(project, isAdmin = false) {
        const user = State.getUser();
        const isManager = user.id === project.project_manager_id;
        const actions = [];
        
        // Admin can perform all actions
        if (isAdmin || (isManager && project.status === 'draft')) {
            actions.push(`
                <button class="btn btn-success" onclick="ProjectsComponent.startBidding(${project.id})">
                    <i class="fas fa-play"></i> Start Bidding
                </button>
            `);
        }
        
        if (isAdmin || (isManager && project.status === 'bidding')) {
            actions.push(`
                <button class="btn btn-warning" onclick="ProjectsComponent.closeBidding(${project.id})">
                    <i class="fas fa-stop"></i> Close Bidding
                </button>
            `);
        }
        
        if (isAdmin || (isManager && project.status === 'reviewing' && project.bids?.length > 0)) {
            actions.push(`
                <button class="btn btn-primary" onclick="ProjectsComponent.showAwardModal(${project.id})">
                    <i class="fas fa-trophy"></i> Award Project
                </button>
            `);
        }
        
        if (isAdmin || (isManager && project.status === 'awarded')) {
            actions.push(`
                <button class="btn btn-success" onclick="ProjectsComponent.markComplete(${project.id})">
                    <i class="fas fa-check"></i> Mark Complete
                </button>
            `);
        }
        
        if (isAdmin || (isManager && ['draft', 'bidding'].includes(project.status))) {
            actions.push(`
                <button class="btn btn-outline" onclick="ProjectsComponent.editProject(${project.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
            `);
        }
        
        // Admin-only test actions
        if (isAdmin) {
            actions.push(`
                <div class="dropdown d-inline-block ml-2">
                    <button class="btn btn-secondary dropdown-toggle" type="button" data-toggle="dropdown">
                        <i class="fas fa-cog"></i> Admin Actions
                    </button>
                    <div class="dropdown-menu">
                        <a class="dropdown-item" onclick="ProjectsComponent.adminReviewBid(${project.id})">
                            <i class="fas fa-star"></i> Review as Bidder
                        </a>
                        <a class="dropdown-item" onclick="ProjectsComponent.adminCompleteProject(${project.id})">
                            <i class="fas fa-flag-checkered"></i> Force Complete
                        </a>
                        <a class="dropdown-item" onclick="ProjectsComponent.adminResetProject(${project.id})">
                            <i class="fas fa-undo"></i> Reset to Draft
                        </a>
                    </div>
                </div>
            `);
        }
        
        return actions.join(' ');
    },
    
    // Tab content renderers
    renderProjectDetailsTab(project) {
        return `
            <div class="row">
                <div class="col-md-8">
                    <h4>Description</h4>
                    <p>${project.description || 'No description provided.'}</p>
                    
                    ${project.site_conditions?.length > 0 ? `
                        <h4 class="mt-4">Site Conditions</h4>
                        <ul>
                            ${project.site_conditions.map(condition => `<li>${condition}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
                
                <div class="col-md-4">
                    <div class="project-info-box">
                        <h5>Project Information</h5>
                        <dl>
                            <dt>Location</dt>
                            <dd>${project.zip_code}</dd>
                            
                            <dt>Bid Due Date</dt>
                            <dd>${Formatter.date(project.bid_due_date)}</dd>
                            
                            <dt>Delivery Date</dt>
                            <dd>${Formatter.date(project.delivery_date)}</dd>
                            
                            ${project.show_max_bid && project.max_bid ? `
                                <dt>Maximum Bid</dt>
                                <dd>${Formatter.currency(project.max_bid)}</dd>
                            ` : ''}
                            
                            ${project.awarded_amount ? `
                                <dt>Awarded Amount</dt>
                                <dd>${Formatter.currency(project.awarded_amount)}</dd>
                            ` : ''}
                        </dl>
                    </div>
                </div>
            </div>
        `;
    },
    
    renderProjectBidsTab(project) {
        // Check if project has bids
        if (!project.bids || project.bids.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-gavel" style="font-size: 3rem; color: #dee2e6; margin-bottom: 1rem;"></i>
                    <h4>No Bids Yet</h4>
                    <p class="text-muted">No bids have been submitted for this project.</p>
                    ${project.status === 'bidding' ? `
                        <p class="text-muted">
                            <i class="fas fa-clock"></i> 
                            Bidding closes on ${Formatter.date(project.bid_due_date)}
                        </p>
                    ` : ''}
                </div>
            `;
        }

        const userRole = State.getUserRole();
        const canAcceptBids = (userRole === 'admin' || 
                              (userRole === 'project_manager' && project.project_manager_id === State.getUserId())) 
                              && project.status === 'reviewing';

        return `
            <div class="bids-list-container">
                ${project.status === 'bidding' ? `
                    <div class="alert alert-info mb-3">
                        <i class="fas fa-info-circle"></i>
                        Bidding is open until ${Formatter.date(project.bid_due_date)}
                    </div>
                ` : ''}
                
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Bidder</th>
                                <th>Company</th>
                                <th>Rating</th>
                                <th>Bid Amount</th>
                                <th>Delivery Date</th>
                                <th>Submitted</th>
                                <th>Status</th>
                                ${canAcceptBids ? '<th>Action</th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${project.bids.map(bid => this.renderBidRow(bid, project, canAcceptBids)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    renderBidRow(bid, project) {
        const userRole = State.getUserRole();
        const isAdmin = userRole === 'admin';
        const isProjectManager = userRole === 'project_manager';
        
        // Add test bid indicator
        const testBidIndicator = bid.is_test_bid ? 
            '<span class="badge badge-info ml-2">TEST</span>' : '';
        const bidNumberIndicator = bid.bid_number > 1 ? 
            `<span class="badge badge-secondary ml-2">#${bid.bid_number}</span>` : '';

        // Format delivery date
        let deliveryDateDisplay = '<span class="text-muted">No change</span>';
        if (bid.alternate_delivery_date) {
            // Normalize dates to compare only the date portion (not time)
            const altDate = new Date(bid.alternate_delivery_date);
            const projDate = new Date(project.delivery_date);
            
            // Set both dates to midnight to ensure proper comparison
            altDate.setHours(0, 0, 0, 0);
            projDate.setHours(0, 0, 0, 0);
            
            if (altDate.getTime() !== projDate.getTime()) {
                const daysDiff = Math.floor((altDate - projDate) / (1000 * 60 * 60 * 24));
                const earlier = daysDiff < 0;
                
                deliveryDateDisplay = `
                    <span class="text-${earlier ? 'success' : 'warning'}">
                        ${Formatter.date(bid.alternate_delivery_date)}
                        <small class="d-block">(${Math.abs(daysDiff)} days ${earlier ? 'earlier' : 'later'})</small>
                    </span>
                `;
            }
        }
        
        return `
            <tr class="${bid.status === 'won' ? 'table-success' : ''}">
                <td>
                    <strong>${bid.bidder_display || bid.user_name || 'Unknown'}</strong>
                    ${testBidIndicator}
                    ${bidNumberIndicator}
                </td>
                <td>
                    ${bid.company || '<span class="text-muted">-</span>'}
                </td>
                <td>
                    ${bid.rating ? this.getRatingStars(bid.rating) : '<span class="text-muted">No rating</span>'}
                </td>
                <td>
                    <span class="h5 mb-0">${Formatter.currency(bid.amount)}</span>
                </td>
                <td>${deliveryDateDisplay}</td>
                <td>
                    ${Formatter.timeAgo(bid.created_at)}
                </td>
                <td>
                    <span class="badge badge-${this.getBidStatusClass(bid.status)}">
                        ${bid.status.toUpperCase()}
                    </span>
                </td>
                ${(isAdmin || isProjectManager) && project.status === 'reviewing' ? `
                    <td>
                        <button class="btn btn-sm btn-success" 
                                onclick="ProjectsComponent.acceptBid(${project.id}, ${bid.id})"
                                title="Accept this bid">
                            <i class="fas fa-check"></i> Accept
                        </button>
                    </td>
                ` : ''}
            </tr>
        `;
    },  

    getBidStatusClass(status) {
        const statusClasses = {
            'pending': 'secondary',
            'submitted': 'info',
            'reviewing': 'warning',
            'won': 'success',
            'lost': 'danger',
            'withdrawn': 'dark'
        };
        return statusClasses[status] || 'secondary';
    },

    async showBidFiles(bidId) {
        try {
            const bid = await API.bids.getById(bidId);
            const filesHtml = bid.files && bid.files.length > 0 
                ? bid.files.map(file => this.renderFileItem(file)).join('')
                : '<p class="text-muted">No files attached to this bid.</p>';
            
            Modals.show('Bid Files', `
                <div class="bid-files-container">
                    ${filesHtml}
                </div>
            `, {
                size: 'large',
                confirmText: 'Close',
                showCancel: false
            });
        } catch (error) {
            App.showError('Failed to load bid files');
        }
    },

    getRatingStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star text-warning"></i>';
        }
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt text-warning"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star text-warning"></i>';
        }
        
        return stars;
    },
    
    renderProjectFilesTab(project) {
        // Check if project has files
        if (!project.files || project.files.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-folder-open" style="font-size: 3rem; color: #dee2e6; margin-bottom: 1rem;"></i>
                    <h4>No Files Uploaded</h4>
                    <p class="text-muted">No files have been uploaded for this project.</p>
                </div>
            `;
        }

        return `
            <div class="files-container">
                <div class="files-list">
                    ${project.files.map(file => this.renderFileItem(file)).join('')}
                </div>
            </div>
        `;
    },

    renderFileItem(file) {
        const fileIcon = this.getFileIcon(file.name || file.original_name);
        const fileName = file.original_name || file.name;
        const fileSize = this.formatFileSize(file.size);
        
        return `
            <div class="file-item card mb-2">
                <div class="card-body d-flex align-items-center">
                    <div class="file-icon mr-3">
                        <i class="fas ${fileIcon} fa-2x text-muted"></i>
                    </div>
                    <div class="file-info flex-grow-1">
                        <h6 class="mb-1">${fileName}</h6>
                        <small class="text-muted">
                            ${fileSize} • Uploaded ${Formatter.timeAgo(file.created_at)}
                            ${file.uploaded_by_name ? ` by ${file.uploaded_by_name}` : ''}
                        </small>
                    </div>
                    <div class="file-actions">
                        <a href="${API.files.download(file.id)}" 
                           class="btn btn-sm btn-outline-primary"
                           target="_blank"
                           download="${fileName}">
                            <i class="fas fa-download"></i> Download
                        </a>
                    </div>
                </div>
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
            'ppt': 'fa-file-powerpoint',
            'pptx': 'fa-file-powerpoint',
            'jpg': 'fa-file-image',
            'jpeg': 'fa-file-image',
            'png': 'fa-file-image',
            'gif': 'fa-file-image',
            'zip': 'fa-file-archive',
            'rar': 'fa-file-archive',
            'txt': 'fa-file-alt',
            'csv': 'fa-file-csv'
        };
        
        return iconMap[ext] || 'fa-file';
    },

    shouldShowBidsTab() {
        const userRole = State.getUserRole();
        // Only admins and project managers can see bids
        return userRole === 'admin' || userRole === 'project_manager';
    },

    formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Initialize detail event listeners
    initializeDetailEventListeners() {
        // Apple-style tab switching
        document.querySelectorAll('.apple-tab-link').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.currentTarget.dataset.tab);
            });
        });
    },
    
    // Switch tab
    switchTab(tabName) {
        // Check if trying to switch to bids tab without permission
        if (tabName === 'bids' && !this.shouldShowBidsTab()) {
            console.warn('Access denied to bids tab');
            return;
        }
        // Update tab links with smooth transition
        document.querySelectorAll('.apple-tab-link').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content with fade animation
        document.querySelectorAll('.apple-tab-pane').forEach(pane => {
            if (pane.dataset.tabContent === tabName) {
                pane.style.display = 'block';
                setTimeout(() => pane.classList.add('active'), 10);
            } else {
                pane.classList.remove('active');
                setTimeout(() => {
                    if (!pane.classList.contains('active')) {
                        pane.style.display = 'none';
                    }
                }, 300);
            }
        });
    },
    
    // Action methods
    async showCreateModal() {
        ProjectModals.showCreateModal();
    },
    
    async editProject(projectId) {
        const project = await API.projects.getById(projectId);
        ProjectModals.showEditModal(project);
    },
    
    async showBidModal(projectId) {
        BidModals.showCreateModal(projectId);
    },
    
    async startBidding(projectId) {
        if (!confirm('Are you sure you want to start bidding for this project?')) {
            return;
        }
        
        try {
            await API.projects.startBidding(projectId);
            App.showSuccess('Bidding started successfully');
            
            // Check if we're on the detail page or list page
            if (window.location.hash.includes(`/projects/${projectId}`)) {
                // We're on the detail page, refresh the detail view
                await this.renderDetail(projectId);
            } else {
                // We're on the list page, refresh the list
                await this.loadProjects();
            }
        } catch (error) {
            App.showError('Failed to start bidding');
        }
    },
    
    async showAwardModal(projectId) {
        try {
            // Load fresh project data with bids
            const project = await API.projects.getById(projectId);
            
            // Check status first
            if (project.status !== 'reviewing') {
                App.showError('Please close bidding first before awarding the project');
                return;
            }
            
            // Load bids if not present
            if (!project.bids) {
                project.bids = await API.bids.getProjectBids(projectId);
            }
            
            if (!project.bids || project.bids.length === 0) {
                App.showError('No bids available to award');
                return;
            }
            
            ProjectModals.showAwardModal(project);
        } catch (error) {
            App.showError('Failed to load project for awarding');
        }
    },
    
    async markComplete(projectId) {
        if (!confirm('Are you sure you want to mark this project as complete?')) {
            return;
        }
        
        try {
            await API.projects.complete(projectId);
            App.showSuccess('Project marked as complete');
            
            // Check current page and refresh accordingly
            if (window.location.hash.includes(`/projects/${projectId}`)) {
                await this.renderDetail(projectId);
            } else {
                await this.loadProjects();
            }
        } catch (error) {
            App.showError('Failed to complete project');
        }
    },
        
    // Reset filters
    resetFilters() {
        this.state.filters = {
            status: '',
            search: '',
            sortBy: 'created_at',
            sortOrder: 'desc'
        };
        
        DOM.setValue('projectSearch', '');
        DOM.setValue('statusFilter', '');
        DOM.setValue('sortBy', 'created_at');
        DOM.hide('clearSearch');
        
        this.loadProjects();
    },
    
    // Toggle view
    toggleView() {
        const container = DOM.get('projectsList');
        container.classList.toggle('project-list');
        container.classList.toggle('project-grid');
    },
    
    // Refresh projects
    async refreshProjects() {
        await this.loadProjects();
    },

    async renderWithFilter(status) {
        // Set the filter
        this.state.filters.status = status;
        
        // Render the normal projects view
        await this.render();
        
        // Update the status filter dropdown to show the current filter
        const statusFilter = DOM.get('statusFilter');
        if (statusFilter) {
            statusFilter.value = status;
        }
    },

    // Admin test methods
    async closeBidding(projectId) {
        if (!confirm('Are you sure you want to close bidding for this project?')) {
            return;
        }
        
        try {
            await API.post(`/projects/${projectId}/close-bidding`);
            App.showSuccess('Bidding closed successfully');
            
            // Check current page and refresh accordingly
            if (window.location.hash.includes(`/projects/${projectId}`)) {
                await this.renderDetail(projectId);
            } else {
                await this.loadProjects();
            }
        } catch (error) {
            App.showError('Failed to close bidding');
        }
    },

    async adminReviewBid(projectId) {
        // Allow admin to leave a review as if they were the winning bidder
        const rating = prompt('Enter rating (1-5):');
        const review = prompt('Enter review comment:');
        
        if (rating && review) {
            try {
                await API.post(`/ratings`, {
                    project_id: projectId,
                    rating: parseInt(rating),
                    review: review,
                    as_admin: true
                });
                App.showSuccess('Review submitted as admin');
                this.renderDetail(projectId);
            } catch (error) {
                App.showError('Failed to submit review');
            }
        }
    },

    async adminCompleteProject(projectId) {
        if (!confirm('Force complete this project as admin?')) {
            return;
        }
        
        try {
            await API.post(`/projects/${projectId}/admin-complete`);
            App.showSuccess('Project completed by admin');
            this.renderDetail(projectId);
        } catch (error) {
            App.showError('Failed to complete project');
        }
    },

    // Accept a bid
    async acceptBid(projectId, bidId) {
        if (!confirm('Are you sure you want to accept this bid? This action cannot be undone.')) {
            return;
        }
        
        try {
            App.showLoading(true);
            await API.projects.award(projectId, { bidId });
            App.showSuccess('Bid accepted successfully! The contractor has been notified.');
            
            // Reload the project details
            await this.renderDetail(projectId);
        } catch (error) {
            Config.error('Failed to accept bid:', error);
            App.showError(error.message || 'Failed to accept bid');
        } finally {
            App.showLoading(false);
        }
    },

    // Show file upload modal
    showUploadFileModal(projectId) {
        const content = `
            <form id="uploadFileForm">
                <div class="form-group">
                    <label>Select Files</label>
                    <input type="file" 
                        class="form-control-file" 
                        id="projectFiles" 
                        multiple 
                        required>
                    <small class="text-muted">
                        You can select multiple files. Supported formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, ZIP
                    </small>
                </div>
                
                <div class="form-group">
                    <label>Description (Optional)</label>
                    <textarea class="form-control" 
                            id="fileDescription" 
                            rows="3" 
                            placeholder="Add a description for these files..."></textarea>
                </div>
                
                <div id="selectedFilesList" class="mb-3"></div>
            </form>
        `;
        
        const modal = Modals.show('Upload Files', content, {
            size: 'medium',
            confirmText: 'Upload',
            onConfirm: async () => {
                const files = document.getElementById('projectFiles').files;
                if (!files || files.length === 0) {
                    App.showError('Please select at least one file');
                    return false;
                }
                
                try {
                    App.showLoading(true);
                    
                    // Upload each file
                    for (const file of files) {
                        await API.files.upload(file, { 
                            project_id: projectId,
                            description: document.getElementById('fileDescription').value
                        });
                    }
                    
                    App.showSuccess(`${files.length} file(s) uploaded successfully`);
                    await this.renderDetail(projectId);
                    return true;
                } catch (error) {
                    App.showError(error.message || 'Failed to upload files');
                    return false;
                } finally {
                    App.showLoading(false);
                }
            }
        });
        
        // Show selected files preview
        document.getElementById('projectFiles').addEventListener('change', (e) => {
            const filesList = document.getElementById('selectedFilesList');
            if (e.target.files.length > 0) {
                filesList.innerHTML = `
                    <h6>Selected Files:</h6>
                    <ul class="list-unstyled">
                        ${Array.from(e.target.files).map(file => `
                            <li>
                                <i class="fas fa-file mr-2"></i>
                                ${file.name} 
                                <small class="text-muted">(${this.formatFileSize(file.size)})</small>
                            </li>
                        `).join('')}
                    </ul>
                `;
            } else {
                filesList.innerHTML = '';
            }
        });
    },

    async adminResetProject(projectId) {
        if (!confirm('Reset this project to draft status?')) {
            return;
        }
        
        try {
            await API.post(`/projects/${projectId}/admin-reset`);
            App.showSuccess('Project reset to draft');
            
            // Check current page and refresh accordingly
            if (window.location.hash.includes(`/projects/${projectId}`)) {
                await this.renderDetail(projectId);
            } else {
                await this.loadProjects();
            }
        } catch (error) {
            App.showError('Failed to reset project');
        }
    }
};

// Register component
window.ProjectsComponent = ProjectsComponent;