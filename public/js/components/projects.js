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
            
            // Set page actions based on role
            const pageActions = this.getPageActions();
            DOM.setHTML('pageActions', pageActions);
            
            // Render layout
            const content = `
                <div class="projects-container">
                    <!-- Filters -->
                    <div class="filter-bar">
                        <div class="filter-group">
                            <div class="search-box">
                                <i class="fas fa-search search-icon"></i>
                                <input type="text" 
                                       id="projectSearch" 
                                       class="search-input" 
                                       placeholder="Search projects...">
                                <button class="search-clear" id="clearSearch" style="display: none;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="filter-group">
                            <label class="filter-label">Status:</label>
                            <select id="statusFilter" class="form-control filter-select">
                                <option value="">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="bidding">Open for Bidding</option>
                                <option value="reviewing">Under Review</option>
                                <option value="awarded">Awarded</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label class="filter-label">Sort by:</label>
                            <select id="sortBy" class="form-control filter-select">
                                <option value="created_at">Date Created</option>
                                <option value="bid_due_date">Bid Due Date</option>
                                <option value="delivery_date">Delivery Date</option>
                                <option value="title">Title</option>
                                <option value="max_bid">Max Bid</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <button class="btn btn-outline" id="resetFilters">
                                <i class="fas fa-redo"></i> Reset
                            </button>
                        </div>
                    </div>
                    
                    <!-- Projects Grid/List -->
                    <div id="projectsList" class="project-grid">
                        <!-- Projects will be loaded here -->
                    </div>
                    
                    <!-- Pagination -->
                    <div id="projectsPagination" class="pagination">
                        <!-- Pagination will be loaded here -->
                    </div>
                </div>
            `;
            
            DOM.setHTML('pageContent', content);
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Load projects
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
                <button class="btn btn-outline" onclick="ProjectsComponent.exportProjects()">
                    <i class="fas fa-download"></i> Export
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
                                ${isManager ? this.renderManagerActions(project) : ''}
                                ${canBid ? `
                                    <button class="btn btn-primary" onclick="ProjectsComponent.showBidModal(${project.id})">
                                        <i class="fas fa-gavel"></i> Place Bid
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Project Tabs -->
                <div class="card mt-3">
                    <div class="card-header">
                        <ul class="nav nav-tabs card-header-tabs">
                            <li class="nav-item">
                                <a class="nav-link active" data-tab="details">Details</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="bids">Bids (${project.bids?.length || 0})</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="files">Files (${project.files?.length || 0})</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="timeline">Timeline</a>
                            </li>
                        </ul>
                    </div>
                    
                    <div class="card-body">
                        <div class="tab-content">
                            <!-- Details Tab -->
                            <div class="tab-pane active" data-tab-content="details">
                                ${this.renderProjectDetailsTab(project)}
                            </div>
                            
                            <!-- Bids Tab -->
                            <div class="tab-pane" data-tab-content="bids">
                                ${this.renderProjectBidsTab(project)}
                            </div>
                            
                            <!-- Files Tab -->
                            <div class="tab-pane" data-tab-content="files">
                                ${this.renderProjectFilesTab(project)}
                            </div>
                            
                            <!-- Timeline Tab -->
                            <div class="tab-pane" data-tab-content="timeline">
                                ${this.renderProjectTimelineTab(project)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Render manager actions
    renderManagerActions(project) {
        const actions = [];
        
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
    
    renderProjectTimelineTab(project) {
        // Implementation for timeline tab
        return '<div>Timeline content...</div>';
    },
    
    // Initialize detail event listeners
    initializeDetailEventListeners() {
        // Tab switching
        document.querySelectorAll('.nav-link[data-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.target.dataset.tab);
            });
        });
    },
    
    // Switch tab
    switchTab(tabName) {
        // Update nav links
        document.querySelectorAll('.nav-link[data-tab]').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-pane[data-tab-content]').forEach(pane => {
            pane.classList.toggle('active', pane.dataset.tabContent === tabName);
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
    
    // Export projects
    async exportProjects() {
        try {
            // Implementation for export
            App.showSuccess('Export started');
        } catch (error) {
            App.showError('Failed to export projects');
        }
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
    }
};

// Register component
window.ProjectsComponent = ProjectsComponent;