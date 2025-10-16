// Capital Choice Platform - Dashboard Component

const DashboardComponent = {
    // Component state
    state: {
        stats: null,
        charts: {},
        refreshInterval: null
    },
    
    // Render dashboard
    async render() {
        try {
            App.showLoading(true);
            
            // Get dashboard data
            const data = await API.dashboard.getData();
            this.state.stats = data.stats;
            
            // Render based on user role
            const user = State.getUser();
            let content = '';
            
            switch (user.role) {
                case 'admin':
                    content = this.renderAdminDashboard(data);
                    break;
                case 'project_manager':
                    content = this.renderProjectManagerDashboard(data);
                    break;
                case 'installation_company':
                case 'operations':
                    content = this.renderContractorDashboard(data);
                    break;
                default:
                    content = this.renderDefaultDashboard(data);
            }
            
            DOM.setHTML('pageContent', content);
            
        } catch (error) {
            Config.error('Failed to load dashboard:', error);
            App.showError('Failed to load dashboard');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Render admin dashboard
    renderAdminDashboard(data) {
        const { stats, recentActivity } = data;
        
        return `
            <!-- Stats Grid -->
            <div class="dashboard-grid">
                ${this.renderStatCard('Users', stats.totalUsers, 'fa-users', 'primary', stats.newUsersThisMonth, 'new this month')}
                ${this.renderStatCard('Projects', stats.totalProjects, 'fa-project-diagram', 'success', stats.activeProjects, 'active')}
                ${this.renderStatCard('Total Bids', stats.totalBids, 'fa-gavel', 'info', stats.newProjectsThisMonth, 'new projects')}
                ${this.renderStatCard('Pending Approvals', stats.pendingApprovals, 'fa-user-clock', 'warning')}
            </div>
            
            <!-- Recent Activity -->
            <div class="row mt-4">
                <div class="col-lg-6">
                    ${this.renderRecentUsers(recentActivity.recentUsers)}
                </div>
                <div class="col-lg-6">
                    ${this.renderPendingUsers(recentActivity.pendingUsers)}
                </div>
            </div>
            
            <!-- Recent Projects and Bids -->
            <div class="row mt-4">
                <div class="col-lg-6">
                    ${this.renderRecentProjects(recentActivity.recentProjects)}
                </div>
                <div class="col-lg-6">
                    ${this.renderRecentBids(recentActivity.recentBids)}
                </div>
            </div>
        `;
    },
    
    // Render project manager dashboard
    renderProjectManagerDashboard(data) {
        const { stats, recentActivity } = data;
        
        return `
            <!-- Stats Grid -->
            <div class="dashboard-grid">
                ${this.renderStatCard('Total Projects', stats.totalProjects, 'fa-project-diagram', 'primary')}
                ${this.renderStatCard('Active Projects', stats.activeProjects, 'fa-spinner', 'info')}
                ${this.renderStatCard('Bids Received', stats.totalBidsReceived, 'fa-gavel', 'success')}
                ${this.renderStatCard('Completion Rate', stats.completionRate + '%', 'fa-chart-line', 'warning')}
            </div>
            
            <!-- Project Status Overview -->
            <div class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">Project Status Overview</h3>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-2 text-center">
                            <h4>${stats.draftProjects}</h4>
                            <p class="text-muted">Draft</p>
                        </div>
                        <div class="col-md-2 text-center">
                            <h4 class="text-info">${stats.activeProjects}</h4>
                            <p class="text-muted">Bidding</p>
                        </div>
                        <div class="col-md-2 text-center">
                            <h4 class="text-warning">${stats.reviewingProjects}</h4>
                            <p class="text-muted">Reviewing</p>
                        </div>
                        <div class="col-md-2 text-center">
                            <h4 class="text-primary">${stats.awardedProjects}</h4>
                            <p class="text-muted">Awarded</p>
                        </div>
                        <div class="col-md-2 text-center">
                            <h4 class="text-success">${stats.completedProjects}</h4>
                            <p class="text-muted">Completed</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="row mt-4">
                <div class="col-lg-6">
                    ${this.renderRecentProjects(recentActivity.recentProjects)}
                </div>
                <div class="col-lg-6">
                    ${this.renderRecentBids(recentActivity.recentBids)}
                </div>
            </div>
            
            <!-- Projects Needing Attention -->
            <div class="row mt-4">
                <div class="col-lg-6">
                    ${this.renderProjectsNeedingReview(recentActivity.projectsNeedingReview)}
                </div>
                <div class="col-lg-6">
                    ${this.renderUpcomingDeadlines(recentActivity.upcomingDeadlines)}
                </div>
            </div>
        `;
    },
    
    // Render contractor dashboard
    renderContractorDashboard(data) {
        const { stats, recentActivity } = data;
        
        return `
            <!-- Stats Grid -->
            <div class="dashboard-grid">
                ${this.renderStatCard('Total Bids', stats.totalBids, 'fa-gavel', 'primary')}
                ${this.renderStatCard('Won Bids', stats.wonBids, 'fa-trophy', 'success')}
                ${this.renderStatCard('Win Rate', stats.winRate + '%', 'fa-percentage', 'info')}
                ${this.renderStatCard('Avg Rating', stats.averageRating || 'N/A', 'fa-star', 'warning')}
            </div>
            
            <!-- Recent Activity -->
            <div class="row mt-4">
                <div class="col-lg-6">
                    ${this.renderAvailableProjects(recentActivity.availableProjects)}
                </div>
                <div class="col-lg-6">
                    ${this.renderRecentBids(recentActivity.recentBids)}
                </div>
            </div>
            
            <!-- Won Projects and Upcoming Deliveries -->
            <div class="row mt-4">
                <div class="col-lg-6">
                    ${this.renderWonProjects(recentActivity.wonProjects)}
                </div>
                <div class="col-lg-6">
                    ${this.renderUpcomingDeliveries(recentActivity.upcomingDeliveries)}
                </div>
            </div>
        `;
    },
    
    // Render default dashboard
    renderDefaultDashboard(data) {
        return `
            <div class="card">
                <div class="card-body">
                    <h3>Welcome to Capital Choice Platform</h3>
                    <p>Your dashboard is being prepared...</p>
                </div>
            </div>
        `;
    },
    
    // Render stat card
    renderStatCard(title, value, icon, color = 'primary', subValue = '', subLabel = '') {
        return `
            <div class="stat-card ${color}">
                <div class="stat-icon ${color}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="stat-value">${value}</div>
                <div class="stat-label">${title}</div>
                ${subValue ? `
                    <div class="stat-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>${subValue} ${subLabel}</span>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // Render recent users
    renderRecentUsers(users) {
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Users</h3>
                    <a href="#/users" class="btn btn-sm btn-outline">View All</a>
                </div>
                <div class="card-body">
                    <div class="user-list">
                        ${users.map(user => `
                            <div class="user-item">
                                <img src="${user.avatar || '/images/default-avatar.png'}" class="user-avatar" alt="${user.name}">
                                <div class="user-info">
                                    <div class="user-name">${user.name}</div>
                                    <div class="user-role">${Formatter.role(user.role)}</div>
                                </div>
                                <div class="user-meta">
                                    <span class="badge badge-${user.approved ? 'success' : 'warning'}">
                                        ${user.approved ? 'Approved' : 'Pending'}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Additional render methods...
    renderPendingUsers(users) {
        // Implementation
        return `<div class="card"><div class="card-body">Pending users...</div></div>`;
    },
    
    renderRecentProjects(projects) {
        if (!projects || projects.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Recent Projects</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No recent projects found</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Projects</h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${projects.map(project => `
                            <a href="#/projects/${project.id}" class="list-group-item list-group-item-action">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${project.title || 'Untitled Project'}</h6>
                                    <small>${this.formatDate(project.created_at)}</small>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <small class="text-muted">Status: ${project.status}</small>
                                    ${project.bid_count ? `<span class="badge badge-info">${project.bid_count} bids</span>` : ''}
                                </div>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },
    
    renderRecentBids(bids) {
        if (!bids || bids.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Recent Bids</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No recent bids found</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Recent Bids</h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${bids.map(bid => `
                            <a href="javascript:void(0)" onclick="if(window.BidDetailModal) BidDetailModal.showBidDetail(${bid.id}); return false;" class="list-group-item">
                                <div class="d-flex w-100 justify-content-between">
                                    <div>
                                        <h6 class="mb-1">${bid.project_title || 'Project #' + bid.project_id}</h6>
                                        <small>${bid.user_name || bid.company || 'Unknown Bidder'}</small>
                                    </div>
                                    <div class="text-right">
                                        <strong>${this.formatCurrency(bid.amount)}</strong>
                                        <br>
                                        <span class="badge badge-${this.getBidStatusColor(bid.status)}">${bid.status}</span>
                                    </div>
                                </div>
                                <small class="text-muted">${this.formatDate(bid.created_at)}</small>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },
    
    renderProjectsNeedingReview(projects) {
        if (!projects || projects.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Projects Needing Review</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No projects need review at this time</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        Projects Needing Review
                        <span class="badge badge-warning ml-2">${projects.length}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${projects.map(project => `
                            <a href="#/projects/${project.id}" class="list-group-item list-group-item-action">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">${project.title || 'Untitled Project'}</h6>
                                    <span class="badge badge-warning">Review Needed</span>
                                </div>
                                <p class="mb-1 small">
                                    ${project.status === 'bidding' ? 
                                        'Bidding period ended' : 
                                        'In review status'}
                                </p>
                                <small class="text-muted">
                                    Due: ${this.formatDate(project.bid_due_date)}
                                </small>
                            </a>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },
    
    renderUpcomingDeadlines(deadlines) {
        if (!deadlines || deadlines.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Upcoming Deadlines</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No upcoming deadlines</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        Upcoming Deadlines
                        <span class="badge badge-info ml-2">${deadlines.length}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${deadlines.map(project => {
                            const daysLeft = this.getDaysUntil(project.delivery_date);
                            const urgencyClass = daysLeft <= 7 ? 'danger' : daysLeft <= 14 ? 'warning' : 'info';
                            return `
                                <a href="#/projects/${project.id}" class="list-group-item list-group-item-action">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h6 class="mb-1">${project.title || 'Untitled Project'}</h6>
                                        <span class="badge badge-${urgencyClass}">${daysLeft} days</span>
                                    </div>
                                    <p class="mb-1 small">Delivery: ${this.formatDate(project.delivery_date)}</p>
                                    <small class="text-muted">Status: ${project.status}</small>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    },
    
    renderAvailableProjects(projects) {
        if (!projects || projects.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Available Projects</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No projects available for bidding at this time</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        Available Projects
                        <span class="badge badge-success ml-2">${projects.length}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${projects.map(project => {
                            const daysLeft = this.getDaysUntil(project.bid_due_date);
                            const urgencyClass = daysLeft <= 3 ? 'danger' : daysLeft <= 7 ? 'warning' : 'success';
                            return `
                                <a href="#/projects/${project.id}" class="list-group-item list-group-item-action">
                                    <div class="d-flex w-100 justify-content-between">
                                        <div>
                                            <h6 class="mb-1">${project.title || 'Untitled Project'}</h6>
                                            <p class="mb-1 small">${project.description ? project.description.substring(0, 100) + '...' : 'No description'}</p>
                                        </div>
                                        <div class="text-right">
                                            <span class="badge badge-${urgencyClass}">${daysLeft} days left</span>
                                            ${project.max_bid && project.show_max_bid ? 
                                                `<br><small class="text-muted">Max: ${this.formatCurrency(project.max_bid)}</small>` : ''}
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between">
                                        <small class="text-muted">
                                            <i class="fas fa-map-marker-alt"></i> ${project.zip_code || 'Location TBD'}
                                        </small>
                                        <small class="text-muted">
                                            Delivery: ${this.formatDate(project.delivery_date)}
                                        </small>
                                    </div>
                                    ${project.has_bid ? 
                                        `<span class="badge badge-info mt-2">You have bid on this project</span>` : 
                                        `<button class="btn btn-sm btn-primary mt-2" onclick="event.preventDefault(); Router.navigate('/projects/${project.id}')">
                                            <i class="fas fa-gavel"></i> Place Bid
                                        </button>`}
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="card-footer">
                    <a href="#/projects?status=bidding" class="btn btn-primary btn-block">
                        View All Available Projects
                    </a>
                </div>
            </div>
        `;
    },
    
    renderWonProjects(projects) {
        if (!projects || projects.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Won Projects</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No won projects yet. Keep bidding!</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        Won Projects
                        <span class="badge badge-success ml-2">${projects.length}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${projects.map(project => {
                            const statusBadge = this.getProjectStatusBadge(project.status);
                            return `
                                <a href="#/projects/${project.id}" class="list-group-item list-group-item-action">
                                    <div class="d-flex w-100 justify-content-between">
                                        <div>
                                            <h6 class="mb-1">
                                                <i class="fas fa-trophy text-warning mr-1"></i>
                                                ${project.title || 'Untitled Project'}
                                            </h6>
                                            <p class="mb-1 small">${project.description ? project.description.substring(0, 80) + '...' : ''}</p>
                                        </div>
                                        <div class="text-right">
                                            ${statusBadge}
                                            ${project.awarded_amount ? 
                                                `<br><strong class="text-success">${this.formatCurrency(project.awarded_amount)}</strong>` : ''}
                                        </div>
                                    </div>
                                    <div class="d-flex justify-content-between mt-2">
                                        <small class="text-muted">
                                            <i class="fas fa-calendar"></i> Won on: ${this.formatDate(project.awarded_date || project.updated_at)}
                                        </small>
                                        <small class="text-muted">
                                            <i class="fas fa-truck"></i> Delivery: ${this.formatDate(project.delivery_date)}
                                        </small>
                                    </div>
                                    ${project.project_manager_name ? 
                                        `<small class="text-muted"><i class="fas fa-user"></i> PM: ${project.project_manager_name}</small>` : ''}
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="card-footer">
                    <a href="#/bids?status=won" class="btn btn-success btn-block">
                        View All Won Projects
                    </a>
                </div>
            </div>
        `;
    },
    
    renderUpcomingDeliveries(deliveries) {
        if (!deliveries || deliveries.length === 0) {
            return `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Upcoming Deliveries</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-muted">No upcoming deliveries scheduled</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        Upcoming Deliveries
                        <span class="badge badge-warning ml-2">${deliveries.length}</span>
                    </h3>
                </div>
                <div class="card-body">
                    <div class="list-group">
                        ${deliveries.map(project => {
                            const daysUntilDelivery = this.getDaysUntil(project.delivery_date);
                            let urgencyClass = 'info';
                            let urgencyIcon = 'fa-clock';
                            
                            if (daysUntilDelivery <= 0) {
                                urgencyClass = 'danger';
                                urgencyIcon = 'fa-exclamation-triangle';
                            } else if (daysUntilDelivery <= 3) {
                                urgencyClass = 'warning';
                                urgencyIcon = 'fa-exclamation-circle';
                            } else if (daysUntilDelivery <= 7) {
                                urgencyClass = 'primary';
                            }
                            
                            return `
                                <a href="#/projects/${project.id}" class="list-group-item list-group-item-action">
                                    <div class="d-flex w-100 justify-content-between">
                                        <div>
                                            <h6 class="mb-1">
                                                <i class="fas ${urgencyIcon} text-${urgencyClass} mr-1"></i>
                                                ${project.title || 'Untitled Project'}
                                            </h6>
                                            <div class="small">
                                                <i class="fas fa-map-marker-alt"></i> ${project.zip_code || 'Location TBD'}
                                                ${project.site_address ? ` - ${project.site_address}` : ''}
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <span class="badge badge-${urgencyClass}">
                                                ${daysUntilDelivery === 0 ? 'TODAY' :
                                                daysUntilDelivery === 1 ? 'Tomorrow' :
                                                daysUntilDelivery < 0 ? `${Math.abs(daysUntilDelivery)} days overdue` :
                                                `${daysUntilDelivery} days`}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="mt-2">
                                        <small class="text-muted d-block">
                                            <i class="fas fa-calendar-check"></i> Delivery Date: <strong>${this.formatDate(project.delivery_date)}</strong>
                                        </small>
                                        ${project.installation_time ? 
                                            `<small class="text-muted d-block">
                                                <i class="fas fa-clock"></i> Installation Time: ${project.installation_time}
                                            </small>` : ''}
                                        ${project.project_manager_name ? 
                                            `<small class="text-muted d-block">
                                                <i class="fas fa-user"></i> Project Manager: ${project.project_manager_name}
                                            </small>` : ''}
                                    </div>
                                    <div class="mt-2">
                                        ${daysUntilDelivery <= 3 ? 
                                            `<button class="btn btn-sm btn-${urgencyClass}" onclick="event.preventDefault(); alert('Contact project manager for delivery details');">
                                                <i class="fas fa-phone"></i> Contact PM
                                            </button>` : ''}
                                    </div>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="card-footer text-center">
                    <small class="text-muted">
                        <i class="fas fa-info-circle"></i> Projects are sorted by delivery date
                    </small>
                </div>
            </div>
        `;
},

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    },

    formatCurrency(amount) {
        if (!amount) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    getDaysUntil(dateString) {
        if (!dateString) return 0;
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = date - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    },

    getBidStatusColor(status) {
        const colors = {
            'pending': 'secondary',
            'won': 'success',
            'lost': 'danger',
            'withdrawn': 'warning'
        };
        return colors[status] || 'secondary';
    },

    getProjectStatusBadge(status) {
        const badges = {
            'draft': '<span class="badge badge-secondary">Draft</span>',
            'bidding': '<span class="badge badge-info">Open for Bids</span>',
            'reviewing': '<span class="badge badge-warning">Under Review</span>',
            'awarded': '<span class="badge badge-primary">Awarded</span>',
            'in_progress': '<span class="badge badge-info">In Progress</span>',
            'completed': '<span class="badge badge-success">Completed</span>',
            'cancelled': '<span class="badge badge-danger">Cancelled</span>'
        };
        return badges[status] || '<span class="badge badge-secondary">Unknown</span>';
    },
    
    // Refresh data
    async refreshData() {
        try {
            const data = await API.dashboard.getData();
            // Update UI with new data
            Config.log('Dashboard data refreshed');
        } catch (error) {
            Config.error('Failed to refresh dashboard:', error);
        }
    },
    
    // Cleanup
    cleanup() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }
    }
};

// Register component
window.DashboardComponent = DashboardComponent;