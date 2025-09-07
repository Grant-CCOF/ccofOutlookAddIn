// Capital Choice Platform - Users Component

const UsersComponent = {
    // Component state
    state: {
        users: [],
        filters: {
            role: '',
            status: '',
            search: '',
            sortBy: 'created_at',
            sortOrder: 'desc'
        },
        currentPage: 1,
        totalPages: 1,
        selectedUser: null,
        createCardExpanded: true
    },
    
    // Render users list
    async render() {
        try {
            App.showLoading(true);
            
            // Check permissions
            if (!Auth.isAdmin()) {
                App.showError('Access denied');
                Router.navigate('/dashboard');
                return;
            }
            
            // Set page actions
            DOM.setHTML('pageActions', `
                <button class="btn btn-primary" onclick="UsersComponent.showCreateModal()">
                    <i class="fas fa-plus"></i> Add User
                </button>
            `);
            
            // Render layout
            const content = `
                <div class="users-container">
                    <!-- Stats Row -->
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="stat-card">
                                <div class="stat-value" id="totalUsers">0</div>
                                <div class="stat-label">Total Users</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card warning">
                                <div class="stat-value" id="pendingUsers">0</div>
                                <div class="stat-label">Pending Approval</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card success">
                                <div class="stat-value" id="activeUsers">0</div>
                                <div class="stat-label">Active Users</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="stat-card danger">
                                <div class="stat-value" id="suspendedUsers">0</div>
                                <div class="stat-label">Suspended</div>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Create User Card -->
                    <div class="card mb-4" id="createUserCard">
                        <div class="card-header" style="cursor: pointer;" onclick="UsersComponent.toggleCreateCard()">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h5 class="card-title mb-0">
                                    <i class="fas fa-user-plus"></i> Quick Create User
                                </h5>
                                <i class="fas fa-chevron-${this.state.createCardExpanded ? 'up' : 'down'}" id="createCardToggleIcon"></i>
                            </div>
                        </div>
                        <div class="card-body" id="createUserCardBody" style="${this.state.createCardExpanded ? '' : 'display: none;'}">
                            <form id="quickCreateUserForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Full Name <span class="text-danger">*</span></label>
                                            <input type="text" 
                                                   class="form-control" 
                                                   id="qc_name"
                                                   name="name" 
                                                   placeholder="Enter full name"
                                                   required>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Username <span class="text-danger">*</span></label>
                                            <input type="text" 
                                                   class="form-control" 
                                                   id="qc_username"
                                                   name="username" 
                                                   placeholder="Choose a username"
                                                   required>
                                            <small class="form-text text-muted">Must be unique, 3-20 characters</small>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Email <span class="text-danger">*</span></label>
                                            <input type="email" 
                                                   class="form-control" 
                                                   id="qc_email"
                                                   name="email" 
                                                   placeholder="email@example.com"
                                                   required>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Phone</label>
                                            <input type="tel" 
                                                   class="form-control" 
                                                   id="qc_phone"
                                                   name="phone" 
                                                   placeholder="+1 (555) 123-4567">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Password <span class="text-danger">*</span></label>
                                            <input type="password" 
                                                   class="form-control" 
                                                   id="qc_password"
                                                   name="password" 
                                                   placeholder="Enter password"
                                                   required>
                                            <small class="form-text text-muted">At least 8 characters</small>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="form-group">
                                            <label>Confirm Password <span class="text-danger">*</span></label>
                                            <input type="password" 
                                                   class="form-control" 
                                                   id="qc_confirmPassword"
                                                   name="confirmPassword" 
                                                   placeholder="Re-enter password"
                                                   required>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label>Role <span class="text-danger">*</span></label>
                                            <select class="form-control" 
                                                    id="qc_role"
                                                    name="role" 
                                                    required>
                                                <option value="">Select role...</option>
                                                <option value="admin">Admin</option>
                                                <option value="project_manager">Project Manager</option>
                                                <option value="installation_company">Installation Company</option>
                                                <option value="operations">Operations</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label>Company</label>
                                            <input type="text" 
                                                   class="form-control" 
                                                   id="qc_company"
                                                   name="company" 
                                                   placeholder="Company name">
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="form-group">
                                            <label>Position</label>
                                            <input type="text" 
                                                   class="form-control" 
                                                   id="qc_position"
                                                   name="position" 
                                                   placeholder="Job title">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <div class="custom-control custom-checkbox">
                                        <input type="checkbox" 
                                               class="custom-control-input" 
                                               id="qc_approved"
                                               name="approved">
                                        <label class="custom-control-label" for="qc_approved">
                                            Approve user immediately (can access system right away)
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-check"></i> Create User
                                    </button>
                                    <button type="button" class="btn btn-outline" onclick="UsersComponent.resetCreateForm()">
                                        <i class="fas fa-times"></i> Clear Form
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <!-- Filters -->
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="filter-bar">
                                <div class="filter-group">
                                    <div class="search-box">
                                        <i class="fas fa-search search-icon"></i>
                                        <input type="text" 
                                               id="userSearch" 
                                               class="search-input" 
                                               placeholder="Search users...">
                                    </div>
                                </div>
                                
                                <div class="filter-group">
                                    <label class="filter-label">Role:</label>
                                    <select id="roleFilter" class="form-control filter-select">
                                        <option value="">All Roles</option>
                                        <option value="admin">Admin</option>
                                        <option value="project_manager">Project Manager</option>
                                        <option value="installation_company">Installation Company</option>
                                        <option value="operations">Operations</option>
                                    </select>
                                </div>
                                
                                <div class="filter-group">
                                    <label class="filter-label">Status:</label>
                                    <select id="statusFilter" class="form-control filter-select">
                                        <option value="">All Status</option>
                                        <option value="active">Active</option>
                                        <option value="pending">Pending</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                </div>
                                
                                <div class="filter-group">
                                    <button class="btn btn-outline" id="resetFilters">
                                        <i class="fas fa-redo"></i> Reset
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Users Table -->
                    <div class="card">
                        <div class="card-body">
                            <div class="table-wrapper">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>User</th>
                                            <th>Role</th>
                                            <th>Company</th>
                                            <th>Status</th>
                                            <th>Joined</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="usersTableBody">
                                        <!-- Users will be loaded here -->
                                    </tbody>
                                </table>
                            </div>
                            
                            <!-- Pagination -->
                            <div id="usersPagination" class="pagination mt-3">
                                <!-- Pagination will be loaded here -->
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            DOM.setHTML('pageContent', content);
            
            // Initialize event listeners
            this.initializeEventListeners();

            // Initialize create form
            this.initializeCreateForm();
            
            // Load users
            await this.loadUsers();
            
        } catch (error) {
            Config.error('Failed to render users:', error);
            App.showError('Failed to load users');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Initialize event listeners
    initializeEventListeners() {
        // Search
        const searchInput = DOM.get('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', DOM.debounce((e) => {
                this.state.filters.search = e.target.value;
                this.loadUsers();
            }, 300));
        }
        
        // Role filter
        DOM.on('roleFilter', 'change', (e) => {
            this.state.filters.role = e.target.value;
            this.loadUsers();
        });
        
        // Status filter
        DOM.on('statusFilter', 'change', (e) => {
            this.state.filters.status = e.target.value;
            this.loadUsers();
        });
        
        // Reset filters
        DOM.on('resetFilters', 'click', () => {
            this.resetFilters();
        });
    },

    // Toggle create card
    toggleCreateCard() {
        this.state.createCardExpanded = !this.state.createCardExpanded;
        const cardBody = DOM.get('createUserCardBody');
        const icon = DOM.get('createCardToggleIcon');
        
        if (this.state.createCardExpanded) {
            cardBody.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
        } else {
            cardBody.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
    },

    // Handle quick create user
    async handleQuickCreateUser() {
        try {
            const form = DOM.get('quickCreateUserForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Process checkbox
            data.approved = formData.has('approved') ? 1 : 0;
            
            // Validate data
            const validation = this.validateUserData(data);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            App.showLoading(true);
            
            // Create user
            await API.users.create(data);
            
            App.showSuccess('User created successfully');
            
            // Reset form
            this.resetCreateForm();
            
            // Collapse the card
            this.state.createCardExpanded = false;
            this.toggleCreateCard();
            
            // Reload users list
            await this.loadUsers();
            
        } catch (error) {
            Config.error('Failed to create user:', error);
            App.showError(error.message || 'Failed to create user');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Reset create form
    resetCreateForm() {
        const form = DOM.get('quickCreateUserForm');
        if (form) {
            form.reset();
        }
    },
    
    // Validate user data
    validateUserData(data) {
        // Name validation
        if (!data.name || data.name.trim().length < 2) {
            return { valid: false, message: 'Name must be at least 2 characters' };
        }
        
        // Username validation
        if (!data.username || data.username.length < 3 || data.username.length > 20) {
            return { valid: false, message: 'Username must be 3-20 characters' };
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!data.email || !emailRegex.test(data.email)) {
            return { valid: false, message: 'Please enter a valid email address' };
        }
        
        // Password validation
        if (!data.password || data.password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters' };
        }
        
        if (data.password !== data.confirmPassword) {
            return { valid: false, message: 'Passwords do not match' };
        }
        
        // Role validation
        if (!data.role) {
            return { valid: false, message: 'Please select a role' };
        }
        
        // Phone validation (optional)
        if (data.phone) {
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (!phoneRegex.test(data.phone)) {
                return { valid: false, message: 'Please enter a valid phone number' };
            }
        }
        
        return { valid: true };
    },
    
    // Initialize create form
    initializeCreateForm() {
        const form = DOM.get('quickCreateUserForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleQuickCreateUser();
            });
        }
    },
    
    // Load users
    async loadUsers() {
        try {
            const params = {
                page: this.state.currentPage,
                limit: Config.DEFAULT_PAGE_SIZE,
                ...this.state.filters
            };
            
            const response = await API.users.getAll(params);
            
            this.state.users = response.data || response;
            this.state.totalPages = response.totalPages || 1;
            
            this.renderUsers();
            this.renderPagination();
            this.updateStats();
            
        } catch (error) {
            Config.error('Failed to load users:', error);
            this.renderEmptyState();
        }
    },
    
    // Render users
    renderUsers() {
        const tbody = DOM.get('usersTableBody');
        
        if (!tbody) return;
        
        if (this.state.users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">No users found</td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.state.users.map(user => this.renderUserRow(user)).join('');
    },
    
    // Render user row
    renderUserRow(user) {
        const status = this.getUserStatus(user);
        const roleConfig = Config.USER_ROLES[user.role] || {};
        
        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div>
                            <div class="font-weight-medium">${user.name}</div>
                            <small class="text-muted">${user.email}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="badge badge-${roleConfig.color || 'secondary'}">
                        <i class="fas ${roleConfig.icon || 'fa-user'}"></i> 
                        ${roleConfig.label || user.role}
                    </span>
                </td>
                <td>${user.company || '-'}</td>
                <td>
                    <span class="badge badge-${status.color}">
                        ${status.label}
                    </span>
                </td>
                <td>${Formatter.date(user.created_at)}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline" 
                                onclick="UsersComponent.viewUser(${user.id})"
                                title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" 
                                onclick="UsersComponent.editUser(${user.id})"
                                title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        
                        ${!user.approved ? `
                            <button class="btn btn-sm btn-success" 
                                    onclick="UsersComponent.approveUser(${user.id})"
                                    title="Approve">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        
                        ${user.approved && !user.suspended ? `
                            <button class="btn btn-sm btn-warning" 
                                    onclick="UsersComponent.suspendUser(${user.id})"
                                    title="Suspend">
                                <i class="fas fa-ban"></i>
                            </button>
                        ` : ''}
                        
                        ${user.suspended ? `
                            <button class="btn btn-sm btn-info" 
                                    onclick="UsersComponent.unsuspendUser(${user.id})"
                                    title="Unsuspend">
                                <i class="fas fa-undo"></i>
                            </button>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-danger" 
                                onclick="UsersComponent.deleteUser(${user.id})"
                                title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    },

    // View user profile with certifications
    async viewUserProfile(userId) {
        try {
            // Use the ProfileComponent to render another user's profile
            await ProfileComponent.render(userId);
            Router.navigate(`/users/${userId}/profile`);
        } catch (error) {
            App.showError('Failed to load user profile');
        }
    },
    
    // Get user status
    getUserStatus(user) {
        if (user.suspended) {
            return { label: 'Suspended', color: 'danger' };
        }
        if (!user.approved) {
            return { label: 'Pending', color: 'warning' };
        }
        return { label: 'Active', color: 'success' };
    },
    
    // Update stats
    updateStats() {
        const total = this.state.users.length;
        const pending = this.state.users.filter(u => !u.approved).length;
        const active = this.state.users.filter(u => u.approved && !u.suspended).length;
        const suspended = this.state.users.filter(u => u.suspended).length;
        
        DOM.setText('totalUsers', total);
        DOM.setText('pendingUsers', pending);
        DOM.setText('activeUsers', active);
        DOM.setText('suspendedUsers', suspended);
    },
    
    // Render pagination
    renderPagination() {
        const container = DOM.get('usersPagination');
        
        if (!container || this.state.totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="pagination-item ${this.state.currentPage === 1 ? 'disabled' : ''}"
                    onclick="UsersComponent.goToPage(${this.state.currentPage - 1})"
                    ${this.state.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= Math.min(this.state.totalPages, 5); i++) {
            paginationHTML += `
                <button class="pagination-item ${i === this.state.currentPage ? 'active' : ''}"
                        onclick="UsersComponent.goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button class="pagination-item ${this.state.currentPage === this.state.totalPages ? 'disabled' : ''}"
                    onclick="UsersComponent.goToPage(${this.state.currentPage + 1})"
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
        this.loadUsers();
    },
    
    // View user
    async viewUser(userId) {
        Router.navigate(`/users/${userId}`);
    },
    
    // Edit user
    async editUser(userId) {
        const user = this.state.users.find(u => u.id === userId);
        if (user) {
            UserModals.showEditModal(user);
        }
    },
    
    // Approve user
    async approveUser(userId) {
        if (!confirm('Are you sure you want to approve this user?')) {
            return;
        }
        
        try {
            await API.users.approve(userId);
            App.showSuccess('User approved successfully');
            await this.loadUsers();
        } catch (error) {
            App.showError('Failed to approve user');
        }
    },
    
    // Suspend user
    async suspendUser(userId) {
        const reason = prompt('Please provide a reason for suspension:');
        if (!reason) return;
        
        try {
            await API.users.suspend(userId, reason);
            App.showSuccess('User suspended successfully');
            await this.loadUsers();
        } catch (error) {
            App.showError('Failed to suspend user');
        }
    },
    
    // Unsuspend user
    async unsuspendUser(userId) {
        if (!confirm('Are you sure you want to unsuspend this user?')) {
            return;
        }
        
        try {
            await API.users.unsuspend(userId);
            App.showSuccess('User unsuspended successfully');
            await this.loadUsers();
        } catch (error) {
            App.showError('Failed to unsuspend user');
        }
    },
    
    // Delete user
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            await API.users.delete(userId);
            App.showSuccess('User deleted successfully');
            await this.loadUsers();
        } catch (error) {
            App.showError('Failed to delete user');
        }
    },
    
    // Show create modal
    showCreateModal() {
        UserModals.showCreateModal();
    },
    
    // Reset filters
    resetFilters() {
        this.state.filters = {
            role: '',
            status: '',
            search: '',
            sortBy: 'created_at',
            sortOrder: 'desc'
        };
        
        DOM.setValue('userSearch', '');
        DOM.setValue('roleFilter', '');
        DOM.setValue('statusFilter', '');
        
        this.loadUsers();
    },
    
    // Render user detail
    async renderDetail(userId) {
        try {
            App.showLoading(true);
            
            const user = await API.users.getById(userId);
            const stats = await API.users.getStats(userId);
            
            // ADD THIS: Fetch certifications
            const certifications = await API.files.getUserCertifications(userId);
            
            this.state.selectedUser = user;
            this.state.certifications = certifications; // Store certifications in state
            
            const content = this.renderUserDetail(user, stats, certifications); // Pass certifications
            DOM.setHTML('pageContent', content);
            
        } catch (error) {
            Config.error('Failed to load user details:', error);
            App.showError('Failed to load user details');
            Router.navigate('/users');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Render user detail view
    renderUserDetail(user, stats, certifications) {
        const status = this.getUserStatus(user);
        const roleConfig = Config.USER_ROLES[user.role] || {};
        const currentUser = Auth.getUser();
        const canViewCertifications = currentUser.role === 'admin' || currentUser.role === 'project_manager';
        
        return `
            <div class="user-detail">
                <div class="card">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-4 text-center">
                                <!-- Existing user info -->
                                <img src="${user.avatar || '/images/default-avatar.png'}" 
                                    class="user-avatar-large mb-3" alt="${user.name}">
                                <h3>${user.name}</h3>
                                <p class="text-muted">${user.email}</p>
                                <span class="badge badge-${roleConfig.color || 'secondary'} mb-2">
                                    <i class="fas ${roleConfig.icon || 'fa-user'}"></i> 
                                    ${roleConfig.label || user.role}
                                </span>
                                <br>
                                <span class="badge badge-${status.color}">
                                    ${status.label}
                                </span>
                            </div>
                            
                            <div class="col-md-8">
                                <h4>User Information</h4>
                                <dl class="row">
                                    <!-- Existing user details -->
                                    <dt class="col-sm-3">Username</dt>
                                    <dd class="col-sm-9">${user.username}</dd>
                                    
                                    <dt class="col-sm-3">Company</dt>
                                    <dd class="col-sm-9">${user.company || '-'}</dd>
                                    
                                    <dt class="col-sm-3">Phone</dt>
                                    <dd class="col-sm-9">${Formatter.phone(user.phone) || '-'}</dd>
                                    
                                    <dt class="col-sm-3">Position</dt>
                                    <dd class="col-sm-9">${user.position || '-'}</dd>
                                    
                                    <dt class="col-sm-3">Joined</dt>
                                    <dd class="col-sm-9">${Formatter.datetime(user.created_at)}</dd>
                                </dl>
                                
                                ${stats ? this.renderUserStats(stats, user.role) : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ADD CERTIFICATIONS CARD HERE -->
                ${canViewCertifications ? `
                    <div class="card mt-3">
                        <div class="card-header">
                            <h5 class="card-title mb-0">Certifications</h5>
                        </div>
                        <div class="card-body">
                            ${this.renderCertifications(certifications)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Add this method to UsersComponent
    renderCertifications(certifications) {
        if (!certifications || certifications.length === 0) {
            return `
                <p class="text-muted text-center mb-0">
                    <i class="fas fa-certificate"></i><br>
                    No certifications uploaded yet
                </p>
            `;
        }
        
        return `
            <div class="certifications-list">
                ${certifications.map(cert => `
                    <div class="certification-item mb-3 p-2 border rounded">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center mb-1">
                                    <i class="fas ${this.getFileIcon(cert.original_name)} mr-2"></i>
                                    <strong>${cert.original_name}</strong>
                                </div>
                                ${cert.description ? `
                                    <small class="text-muted d-block mb-1">${cert.description}</small>
                                ` : ''}
                                <small class="text-muted">
                                    Uploaded ${Formatter.timeAgo(cert.created_at)}
                                </small>
                            </div>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" 
                                        onclick="UsersComponent.downloadCertification(${cert.id}, '${cert.original_name.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Helper method for file icons
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fa-file-pdf text-danger',
            'doc': 'fa-file-word text-primary',
            'docx': 'fa-file-word text-primary',
            'jpg': 'fa-file-image text-success',
            'jpeg': 'fa-file-image text-success',
            'png': 'fa-file-image text-success'
        };
        return iconMap[ext] || 'fa-file';
    },

    // Download certification method
    async downloadCertification(certId, filename) {
        try {
            await API.files.download(certId, filename);
        } catch (error) {
            App.showError('Failed to download certification');
        }
    },
    
    // Render user stats
    renderUserStats(stats, role) {
        if (role === 'project_manager') {
            return `
                <h4 class="mt-4">Statistics</h4>
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.projects_count || 0}</div>
                            <div class="stat-label">Projects</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.active_projects || 0}</div>
                            <div class="stat-label">Active</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.completed_projects || 0}</div>
                            <div class="stat-label">Completed</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (['installation_company', 'operations'].includes(role)) {
            return `
                <h4 class="mt-4">Statistics</h4>
                <div class="row">
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.bids_count || 0}</div>
                            <div class="stat-label">Total Bids</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.won_bids || 0}</div>
                            <div class="stat-label">Won</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.win_rate || 0}%</div>
                            <div class="stat-label">Win Rate</div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-mini">
                            <div class="stat-value">${stats.average_rating || 'N/A'}</div>
                            <div class="stat-label">Avg Rating</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return '';
    }
};

// Register component
window.UsersComponent = UsersComponent;