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
            
            // Initialize charts
            await this.initializeCharts();
            
            // Set up auto-refresh
            this.startAutoRefresh();
            
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
            
            <!-- Charts Row -->
            <div class="row mt-4">
                <div class="col-lg-8">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3 class="chart-title">Projects Timeline</h3>
                            <div class="chart-options">
                                <select class="form-control form-control-sm" id="timelineRange">
                                    <option value="7">Last 7 days</option>
                                    <option value="30" selected>Last 30 days</option>
                                    <option value="90">Last 90 days</option>
                                </select>
                            </div>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="projectsTimelineChart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3 class="chart-title">Users by Role</h3>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="usersByRoleChart"></canvas>
                        </div>
                    </div>
                </div>
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
            
            <!-- Bid Statistics -->
            <div class="row mt-4">
                <div class="col-lg-8">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3 class="chart-title">Bidding Activity</h3>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="biddingActivityChart"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3 class="chart-title">Bid Status</h3>
                        </div>
                        <div class="chart-wrapper">
                            <canvas id="bidStatusChart"></canvas>
                        </div>
                    </div>
                </div>
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
        // Implementation
        return `<div class="card"><div class="card-body">Recent projects...</div></div>`;
    },
    
    renderRecentBids(bids) {
        // Implementation  
        return `<div class="card"><div class="card-body">Recent bids...</div></div>`;
    },
    
    renderProjectsNeedingReview(projects) {
        // Implementation
        return `<div class="card"><div class="card-body">Projects needing review...</div></div>`;
    },
    
    renderUpcomingDeadlines(deadlines) {
        // Implementation
        return `<div class="card"><div class="card-body">Upcoming deadlines...</div></div>`;
    },
    
    renderAvailableProjects(projects) {
        // Implementation
        return `<div class="card"><div class="card-body">Available projects...</div></div>`;
    },
    
    renderWonProjects(projects) {
        // Implementation
        return `<div class="card"><div class="card-body">Won projects...</div></div>`;
    },
    
    renderUpcomingDeliveries(deliveries) {
        // Implementation
        return `<div class="card"><div class="card-body">Upcoming deliveries...</div></div>`;
    },
    
    // Initialize charts
    async initializeCharts() {
        // Implementation for Chart.js initialization
        Config.log('Initializing dashboard charts');
    },
    
    // Start auto refresh
    startAutoRefresh() {
        // Clear existing interval
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }
        
        // Set up new interval
        this.state.refreshInterval = setInterval(() => {
            this.refreshData();
        }, Config.DASHBOARD_REFRESH);
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