// Capital Choice Platform - User Templates

const UserTemplates = {
    // Get user card template
    getUserCard(user, options = {}) {
        const {
            showActions = true,
            showStats = true,
            showContact = false,
            compact = false
        } = options;
        
        const status = this.getUserStatus(user);
        const roleConfig = Config.USER_ROLES[user.role] || {};
        
        return `
            <div class="user-card ${compact ? 'user-card-compact' : ''}" 
                 data-user-id="${user.id}">
                <div class="user-card-header">
                    <img src="${user.avatar || '/images/default-avatar.png'}" 
                         class="user-card-avatar" 
                         alt="${user.name}">
                    <div class="user-card-info">
                        <h4 class="user-card-name">
                            <a href="#/users/${user.id}">${user.name}</a>
                        </h4>
                        <div class="user-card-meta">
                            <span class="badge badge-${roleConfig.color || 'secondary'}">
                                <i class="fas ${roleConfig.icon || 'fa-user'}"></i> 
                                ${roleConfig.label || user.role}
                            </span>
                            <span class="badge badge-${status.color}">
                                ${status.label}
                            </span>
                        </div>
                    </div>
                </div>
                
                ${!compact ? `
                    <div class="user-card-body">
                        ${showContact ? this.getUserContact(user) : ''}
                        ${user.company ? `
                            <div class="user-company">
                                <i class="fas fa-building"></i> ${user.company}
                            </div>
                        ` : ''}
                        ${showStats ? this.getUserStats(user) : ''}
                    </div>
                ` : ''}
                
                ${showActions ? `
                    <div class="user-card-footer">
                        <div class="user-card-actions">
                            ${this.getUserActions(user)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get user list item template
    getUserListItem(user, options = {}) {
        const {
            showCheckbox = false,
            showActions = true,
            showRole = true
        } = options;
        
        const status = this.getUserStatus(user);
        const roleConfig = Config.USER_ROLES[user.role] || {};
        
        return `
            <div class="user-list-item" data-user-id="${user.id}">
                ${showCheckbox ? `
                    <div class="user-checkbox">
                        <input type="checkbox" 
                               class="form-check-input" 
                               value="${user.id}">
                    </div>
                ` : ''}
                
                <div class="user-avatar-wrapper">
                    <img src="${user.avatar || '/images/default-avatar.png'}" 
                         class="user-avatar" 
                         alt="${user.name}">
                    <span class="user-status-indicator ${status.indicator}"></span>
                </div>
                
                <div class="user-info">
                    <div class="user-name">
                        <a href="#/users/${user.id}">${user.name}</a>
                    </div>
                    <div class="user-details">
                        <span class="user-email">${user.email}</span>
                        ${user.company ? `
                            <span class="user-company">• ${user.company}</span>
                        ` : ''}
                    </div>
                </div>
                
                ${showRole ? `
                    <div class="user-role">
                        <span class="badge badge-${roleConfig.color || 'secondary'}">
                            <i class="fas ${roleConfig.icon || 'fa-user'}"></i> 
                            ${roleConfig.label || user.role}
                        </span>
                    </div>
                ` : ''}
                
                <div class="user-status">
                    <span class="badge badge-${status.color}">
                        ${status.label}
                    </span>
                </div>
                
                ${showActions ? `
                    <div class="user-actions">
                        ${this.getUserActions(user, true)}
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get user status
    getUserStatus(user) {
        if (user.suspended) {
            return { 
                label: 'Suspended', 
                color: 'danger',
                indicator: 'offline'
            };
        }
        if (!user.approved) {
            return { 
                label: 'Pending', 
                color: 'warning',
                indicator: 'pending'
            };
        }
        if (user.online) {
            return { 
                label: 'Online', 
                color: 'success',
                indicator: 'online'
            };
        }
        return { 
            label: 'Active', 
            color: 'success',
            indicator: 'offline'
        };
    },
    
    // Get user contact template
    getUserContact(user) {
        return `
            <div class="user-contact">
                ${user.email ? `
                    <div class="contact-item">
                        <i class="fas fa-envelope"></i>
                        <a href="mailto:${user.email}">${user.email}</a>
                    </div>
                ` : ''}
                ${user.phone ? `
                    <div class="contact-item">
                        <i class="fas fa-phone"></i>
                        <a href="tel:${user.phone}">${Formatter.phone(user.phone)}</a>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get user stats template
    getUserStats(user) {
        if (user.role === 'project_manager') {
            return `
                <div class="user-stats">
                    <div class="user-stat">
                        <span class="stat-value">${user.projects_count || 0}</span>
                        <span class="stat-label">Projects</span>
                    </div>
                    <div class="user-stat">
                        <span class="stat-value">${user.active_projects || 0}</span>
                        <span class="stat-label">Active</span>
                    </div>
                    <div class="user-stat">
                        <span class="stat-value">${user.completed_projects || 0}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                </div>
            `;
        }
        
        if (['installation_company', 'operations'].includes(user.role)) {
            return `
                <div class="user-stats">
                    <div class="user-stat">
                        <span class="stat-value">${user.bids_count || 0}</span>
                        <span class="stat-label">Bids</span>
                    </div>
                    <div class="user-stat">
                        <span class="stat-value">${user.won_bids || 0}</span>
                        <span class="stat-label">Won</span>
                    </div>
                    <div class="user-stat">
                        <span class="stat-value">${user.win_rate || 0}%</span>
                        <span class="stat-label">Win Rate</span>
                    </div>
                    ${user.average_rating ? `
                        <div class="user-stat">
                            <span class="stat-value">${user.average_rating}</span>
                            <span class="stat-label">Rating</span>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        return '';
    },
    
    // Get user actions template
    getUserActions(user, compact = false) {
        const currentUser = State.getUser();
        const isAdmin = Auth.isAdmin();
        const actions = [];
        
        if (compact) {
            // Compact dropdown menu
            return `
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline dropdown-toggle" data-toggle="dropdown">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="dropdown-menu dropdown-menu-right">
                        <a class="dropdown-item" href="#/users/${user.id}">
                            <i class="fas fa-eye"></i> View Profile
                        </a>
                        ${isAdmin ? this.getAdminUserActions(user, true) : ''}
                    </div>
                </div>
            `;
        }
        
        // Full action buttons
        actions.push(`
            <button class="btn btn-sm btn-outline" onclick="UsersComponent.viewUser(${user.id})">
                <i class="fas fa-eye"></i> View
            </button>
        `);
        
        if (isAdmin) {
            actions.push(...this.getAdminUserActions(user));
        }
        
        return actions.join(' ');
    },
    
    // Get admin user actions
    getAdminUserActions(user, asDropdownItems = false) {
        const actions = [];
        
        if (asDropdownItems) {
            // Dropdown items format
            actions.push(`
                <a class="dropdown-item" href="javascript:void(0)" 
                   onclick="UsersComponent.editUser(${user.id})">
                    <i class="fas fa-edit"></i> Edit
                </a>
            `);
            
            if (!user.approved) {
                actions.push(`
                    <a class="dropdown-item text-success" href="javascript:void(0)" 
                       onclick="UsersComponent.approveUser(${user.id})">
                        <i class="fas fa-check"></i> Approve
                    </a>
                `);
            }
            
            if (user.approved && !user.suspended) {
                actions.push(`
                    <a class="dropdown-item text-warning" href="javascript:void(0)" 
                       onclick="UsersComponent.suspendUser(${user.id})">
                        <i class="fas fa-ban"></i> Suspend
                    </a>
                `);
            }
            
            if (user.suspended) {
                actions.push(`
                    <a class="dropdown-item text-info" href="javascript:void(0)" 
                       onclick="UsersComponent.unsuspendUser(${user.id})">
                        <i class="fas fa-undo"></i> Unsuspend
                    </a>
                `);
            }
            
            actions.push(`
                <div class="dropdown-divider"></div>
                <a class="dropdown-item text-danger" href="javascript:void(0)" 
                   onclick="UsersComponent.deleteUser(${user.id})">
                    <i class="fas fa-trash"></i> Delete
                </a>
            `);
        } else {
            // Button format
            actions.push(`
                <button class="btn btn-sm btn-outline" onclick="UsersComponent.editUser(${user.id})">
                    <i class="fas fa-edit"></i>
                </button>
            `);
            
            if (!user.approved) {
                actions.push(`
                    <button class="btn btn-sm btn-success" onclick="UsersComponent.approveUser(${user.id})">
                        <i class="fas fa-check"></i>
                    </button>
                `);
            }
            
            if (user.approved && !user.suspended) {
                actions.push(`
                    <button class="btn btn-sm btn-warning" onclick="UsersComponent.suspendUser(${user.id})">
                        <i class="fas fa-ban"></i>
                    </button>
                `);
            }
            
            if (user.suspended) {
                actions.push(`
                    <button class="btn btn-sm btn-info" onclick="UsersComponent.unsuspendUser(${user.id})">
                        <i class="fas fa-undo"></i>
                    </button>
                `);
            }
        }
        
        return actions;
    },
    
    // Get user profile template
    getUserProfile(user, stats = {}) {
        const roleConfig = Config.USER_ROLES[user.role] || {};
        const status = this.getUserStatus(user);
        
        return `
            <div class="user-profile">
                <div class="profile-header">
                    <div class="profile-cover"></div>
                    <div class="profile-info">
                        <img src="${user.avatar || '/images/default-avatar.png'}" 
                             class="profile-avatar" 
                             alt="${user.name}">
                        <div class="profile-details">
                            <h2>${user.name}</h2>
                            <p class="profile-title">${user.position || roleConfig.label || user.role}</p>
                            <p class="profile-company">${user.company || ''}</p>
                        </div>
                        <div class="profile-badges">
                            <span class="badge badge-${roleConfig.color || 'secondary'} badge-lg">
                                <i class="fas ${roleConfig.icon || 'fa-user'}"></i> 
                                ${roleConfig.label || user.role}
                            </span>
                            <span class="badge badge-${status.color} badge-lg">
                                ${status.label}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="profile-content">
                    <div class="row">
                        <div class="col-md-4">
                            ${this.getUserInfoCard(user)}
                            ${this.getUserStatsCard(user, stats)}
                        </div>
                        <div class="col-md-8">
                            ${this.getUserActivityCard(user)}
                            ${this.getUserRatingsCard(user, stats)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get user info card
    getUserInfoCard(user) {
        return `
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">Contact Information</h5>
                </div>
                <div class="card-body">
                    <dl class="info-list">
                        <dt><i class="fas fa-envelope"></i> Email</dt>
                        <dd><a href="mailto:${user.email}">${user.email}</a></dd>
                        
                        ${user.phone ? `
                            <dt><i class="fas fa-phone"></i> Phone</dt>
                            <dd><a href="tel:${user.phone}">${Formatter.phone(user.phone)}</a></dd>
                        ` : ''}
                        
                        ${user.company ? `
                            <dt><i class="fas fa-building"></i> Company</dt>
                            <dd>${user.company}</dd>
                        ` : ''}
                        
                        ${user.position ? `
                            <dt><i class="fas fa-briefcase"></i> Position</dt>
                            <dd>${user.position}</dd>
                        ` : ''}
                        
                        <dt><i class="fas fa-calendar"></i> Member Since</dt>
                        <dd>${Formatter.date(user.created_at)}</dd>
                    </dl>
                </div>
            </div>
        `;
    },
    
    // Get user stats card
    getUserStatsCard(user, stats) {
        let content = '';
        
        if (user.role === 'project_manager') {
            content = `
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.projects_count || 0}</div>
                        <div class="stat-label">Total Projects</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.active_projects || 0}</div>
                        <div class="stat-label">Active Projects</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.completed_projects || 0}</div>
                        <div class="stat-label">Completed</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.completion_rate || 0}%</div>
                        <div class="stat-label">Completion Rate</div>
                    </div>
                </div>
            `;
        } else if (['installation_company', 'operations'].includes(user.role)) {
            content = `
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.bids_count || 0}</div>
                        <div class="stat-label">Total Bids</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.won_bids || 0}</div>
                        <div class="stat-label">Won Bids</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.win_rate || 0}%</div>
                        <div class="stat-label">Win Rate</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.projects_completed || 0}</div>
                        <div class="stat-label">Projects Done</div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card mt-3">
                <div class="card-header">
                    <h5 class="card-title">Statistics</h5>
                </div>
                <div class="card-body">
                    ${content}
                </div>
            </div>
        `;
    },
    
    // Get user activity card
    getUserActivityCard(user) {
        return `
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">Recent Activity</h5>
                </div>
                <div class="card-body">
                    <div class="activity-timeline">
                        <!-- Activity items would be loaded here -->
                        <p class="text-muted">Loading activity...</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Get user ratings card
    getUserRatingsCard(user, stats) {
        if (!['installation_company', 'operations'].includes(user.role)) {
            return '';
        }
        
        return `
            <div class="card mt-3">
                <div class="card-header">
                    <h5 class="card-title">Ratings & Reviews</h5>
                </div>
                <div class="card-body">
                    ${stats.average_rating ? `
                        <div class="rating-summary">
                            <div class="rating-average">
                                <h2>${stats.average_rating}</h2>
                                <div class="rating-stars">
                                    ${Formatter.rating(stats.average_rating)}
                                </div>
                                <p class="text-muted">Based on ${stats.rating_count || 0} reviews</p>
                            </div>
                        </div>
                    ` : `
                        <p class="text-muted">No ratings yet</p>
                    `}
                </div>
            </div>
        `;
    },
    
    // Get empty users template
    getEmptyUsersTemplate(message = 'No users found') {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-users"></i>
                </div>
                <h3 class="empty-state-title">${message}</h3>
                <p class="empty-state-description">
                    ${Auth.isAdmin() 
                        ? 'Try adjusting your filters or add a new user.'
                        : 'No users match your current filters.'}
                </p>
                ${Auth.isAdmin() ? `
                    <button class="btn btn-primary" onclick="UsersComponent.showCreateModal()">
                        <i class="fas fa-plus"></i> Add User
                    </button>
                ` : ''}
            </div>
        `;
    },
    
    // Get user summary widget
    getUserSummaryWidget(user) {
        return `
            <div class="user-widget">
                <div class="user-widget-header">
                    <img src="${user.avatar || '/images/default-avatar.png'}" 
                         class="user-widget-avatar" 
                         alt="${user.name}">
                    <div class="user-widget-info">
                        <a href="#/users/${user.id}" class="user-widget-name">${user.name}</a>
                        <span class="user-widget-role">${Formatter.role(user.role)}</span>
                    </div>
                </div>
                ${user.email ? `
                    <div class="user-widget-contact">
                        <a href="mailto:${user.email}" class="btn btn-sm btn-outline btn-block">
                            <i class="fas fa-envelope"></i> Send Email
                        </a>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Get user select option
    getUserOption(user) {
        return `
            <option value="${user.id}" data-avatar="${user.avatar || '/images/default-avatar.png'}">
                ${user.name} (${user.company || 'No Company'})
            </option>
        `;
    },
    
    // Get user mention
    getUserMention(user) {
        return `
            <span class="user-mention" data-user-id="${user.id}">
                @${user.username || user.name}
            </span>
        `;
    }
};

// Register globally
window.UserTemplates = UserTemplates;