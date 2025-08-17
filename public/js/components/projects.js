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
                    <button class="btn btn-outline" onclick="ProjectsComponent.exportProjects()">
                        <i class="fas fa-download"></i> Export
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
                        <i class="fas fa-user"></i> ${project.manager_name || 'Unknown'}
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
                                        <i class="fas fa-user"></i> ${project.manager_name}
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
                        <li class="apple-tab-item">
                            <button class="apple-tab-link" data-tab="bids">
                                <i class="fas fa-gavel tab-icon"></i>
                                <span>Bids</span>
                                <span class="apple-tab-badge">${project.bids?.length || 0}</span>
                            </button>
                        </li>
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
                    
                    <div class="apple-tab-pane" data-tab-content="bids">
                        ${this.renderProjectBidsTab(project)}
                    </div>
                    
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
        // Implementation for bids tab
        return '<div>Bids content...</div>';
    },
    
    renderProjectFilesTab(project) {
        // Implementation for files tab
        return '<div>Files content...</div>';
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
            this.loadProjects();
        } catch (error) {
            App.showError('Failed to start bidding');
        }
    },
    
    async showAwardModal(projectId) {
        const project = await API.projects.getById(projectId);
        ProjectModals.showAwardModal(project);
    },
    
    async markComplete(projectId) {
        if (!confirm('Are you sure you want to mark this project as complete?')) {
            return;
        }
        
        try {
            await API.projects.complete(projectId);
            App.showSuccess('Project marked as complete');
            this.renderDetail(projectId);
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
            this.loadProjects();
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

    async adminResetProject(projectId) {
        if (!confirm('Reset this project to draft status?')) {
            return;
        }
        
        try {
            await API.post(`/projects/${projectId}/admin-reset`);
            App.showSuccess('Project reset to draft');
            this.renderDetail(projectId);
        } catch (error) {
            App.showError('Failed to reset project');
        }
    }
};

// Register component
window.ProjectsComponent = ProjectsComponent;