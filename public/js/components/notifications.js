// Capital Choice Platform - Notifications Component

const NotificationsComponent = {
    // Component state
    state: {
        notifications: [],
        filters: {
            unread: false,
            type: ''
        },
        currentPage: 1,
        totalPages: 1,
        loading: false
    },
    
    // Render notifications
    async render() {
        try {
            App.showLoading(true);
            
            // Set page actions
            DOM.setHTML('pageActions', `
                <button class="btn btn-outline" onclick="NotificationsComponent.markAllRead()">
                    <i class="fas fa-check-double"></i> Mark All Read
                </button>
                <button class="btn btn-outline" onclick="NotificationsComponent.clearAll()">
                    <i class="fas fa-trash"></i> Clear All
                </button>
            `);
            
            // Render layout
            const content = `
                <div class="notifications-container">
                    <div class="row">
                        <!-- Filters Sidebar -->
                        <div class="col-lg-3">
                            <div class="card">
                                <div class="card-header">
                                    <h5 class="card-title mb-0">Filters</h5>
                                </div>
                                <div class="card-body">
                                    <div class="form-group">
                                        <div class="custom-control custom-checkbox">
                                            <input type="checkbox" 
                                                   class="custom-control-input" 
                                                   id="unreadOnly">
                                            <label class="custom-control-label" for="unreadOnly">
                                                Unread Only
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label>Type</label>
                                        <select id="typeFilter" class="form-control">
                                            <option value="">All Types</option>
                                            <option value="system">System</option>
                                            <option value="bid_received">Bid Received</option>
                                            <option value="bid_accepted">Bid Accepted</option>
                                            <option value="bid_rejected">Bid Rejected</option>
                                            <option value="project_update">Project Update</option>
                                            <option value="project_completed">Project Completed</option>
                                            <option value="rating_received">Rating Received</option>
                                            <option value="message">Message</option>
                                        </select>
                                    </div>
                                    
                                    <button class="btn btn-outline btn-block" 
                                            onclick="NotificationsComponent.resetFilters()">
                                        Reset Filters
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Stats Card -->
                            <div class="card mt-3">
                                <div class="card-body">
                                    <h6>Statistics</h6>
                                    <div class="notification-stats">
                                        <div class="stat-item">
                                            <span class="stat-label">Total</span>
                                            <span class="stat-value" id="totalCount">0</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">Unread</span>
                                            <span class="stat-value text-warning" id="unreadCount">0</span>
                                        </div>
                                        <div class="stat-item">
                                            <span class="stat-label">This Week</span>
                                            <span class="stat-value" id="weekCount">0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Notifications List -->
                        <div class="col-lg-9">
                            <div class="card">
                                <div class="card-body">
                                    <div id="notificationsList" class="notifications-list">
                                        <!-- Notifications will be loaded here -->
                                    </div>
                                    
                                    <!-- Load More Button -->
                                    <div id="loadMoreContainer" class="text-center mt-3" style="display: none;">
                                        <button class="btn btn-outline" 
                                                onclick="NotificationsComponent.loadMore()">
                                            Load More
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            DOM.setHTML('pageContent', content);
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Load notifications
            await this.loadNotifications();
            
        } catch (error) {
            Config.error('Failed to render notifications:', error);
            App.showError('Failed to load notifications');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Initialize event listeners
    initializeEventListeners() {
        // Unread filter
        DOM.on('unreadOnly', 'change', (e) => {
            this.state.filters.unread = e.target.checked;
            this.state.currentPage = 1;
            this.loadNotifications();
        });
        
        // Type filter
        DOM.on('typeFilter', 'change', (e) => {
            this.state.filters.type = e.target.value;
            this.state.currentPage = 1;
            this.loadNotifications();
        });
    },
    
    // Load notifications
    async loadNotifications(append = false) {
        if (this.state.loading) return;
        
        try {
            this.state.loading = true;
            
            const params = {
                page: this.state.currentPage,
                limit: 20,
                unread: this.state.filters.unread || undefined,
                type: this.state.filters.type || undefined
            };
            
            const response = await API.notifications.getAll(params);
            
            if (append) {
                this.state.notifications = [...this.state.notifications, ...response.notifications];
            } else {
                this.state.notifications = response.notifications;
            }
            
            this.state.totalPages = Math.ceil(response.total / 20);
            
            this.renderNotifications(append);
            this.updateStats(response);
            
            // Show/hide load more button
            const loadMoreContainer = DOM.get('loadMoreContainer');
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 
                    this.state.currentPage < this.state.totalPages ? 'block' : 'none';
            }
            
        } catch (error) {
            Config.error('Failed to load notifications:', error);
            if (!append) {
                this.renderEmptyState();
            }
        } finally {
            this.state.loading = false;
        }
    },
    
    // Render notifications
    renderNotifications(append = false) {
        const container = DOM.get('notificationsList');
        
        if (!container) return;
        
        if (!append && this.state.notifications.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        const notificationsHTML = this.state.notifications.map(notification => 
            this.renderNotificationItem(notification)
        ).join('');
        
        if (append) {
            container.insertAdjacentHTML('beforeend', notificationsHTML);
        } else {
            container.innerHTML = notificationsHTML;
        }
        
        // Add click handlers
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-actions button')) {
                    this.viewNotification(item.dataset.notificationId);
                }
            });
        });
    },
    
    // Render notification item
    renderNotificationItem(notification) {
        const typeConfig = Config.NOTIFICATION_TYPES[notification.type] || {
            icon: 'fa-bell',
            color: 'secondary'
        };
        
        return `
            <div class="notification-item ${!notification.read ? 'unread' : ''}" 
                 data-notification-id="${notification.id}">
                <div class="notification-icon ${typeConfig.color}">
                    <i class="fas ${typeConfig.icon}"></i>
                </div>
                
                <div class="notification-content">
                    <div class="notification-header">
                        <h6 class="notification-title">${notification.title}</h6>
                        <span class="notification-time">${Formatter.timeAgo(notification.created_at)}</span>
                    </div>
                    
                    <p class="notification-message">${notification.message}</p>
                    
                    ${notification.data ? `
                        <div class="notification-meta">
                            ${this.renderNotificationMeta(notification)}
                        </div>
                    ` : ''}
                </div>
                
                <div class="notification-actions">
                    ${!notification.read ? `
                        <button class="btn btn-sm btn-outline" 
                                onclick="NotificationsComponent.markRead(${notification.id})"
                                title="Mark as read">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline" 
                            onclick="NotificationsComponent.deleteNotification(${notification.id})"
                            title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    // Render notification meta
    renderNotificationMeta(notification) {
        const data = notification.data || {};
        const meta = [];
        
        if (data.projectId) {
            meta.push(`<a href="#/projects/${data.projectId}">View Project</a>`);
        }
        
        if (data.bidId) {
            meta.push(`<a href="#/bids/${data.bidId}">View Bid</a>`);
        }
        
        if (data.userId) {
            meta.push(`<a href="#/users/${data.userId}">View User</a>`);
        }
        
        return meta.join(' • ');
    },
    
    // Render empty state
    renderEmptyState() {
        const container = DOM.get('notificationsList');
        
        if (!container) return;
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-bell-slash"></i>
                </div>
                <h3 class="empty-state-title">No Notifications</h3>
                <p class="empty-state-description">
                    ${this.state.filters.unread || this.state.filters.type
                        ? 'No notifications match your filters.'
                        : 'You don\'t have any notifications yet.'}
                </p>
                ${this.state.filters.unread || this.state.filters.type ? `
                    <button class="btn btn-primary" onclick="NotificationsComponent.resetFilters()">
                        Clear Filters
                    </button>
                ` : ''}
            </div>
        `;
    },
    
    // Update stats
    updateStats(response) {
        DOM.setText('totalCount', response.total || 0);
        DOM.setText('unreadCount', response.unreadCount || 0);
        
        // Calculate this week's count
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weekCount = this.state.notifications.filter(n => 
            new Date(n.created_at) > weekAgo
        ).length;
        
        DOM.setText('weekCount', weekCount);
    },
    
    // View notification
    async viewNotification(notificationId) {
        const notification = this.state.notifications.find(n => n.id == notificationId);
        
        if (!notification) return;
        
        // Mark as read if unread
        if (!notification.read) {
            await this.markRead(notificationId);
        }
        
        // Navigate based on notification type
        const data = notification.data || {};
        
        if (data.projectId) {
            Router.navigate(`/projects/${data.projectId}`);
        } else if (data.bidId) {
            Router.navigate(`/bids/${data.bidId}`);
        } else if (data.userId) {
            Router.navigate(`/users/${data.userId}`);
        }
    },
    
    // Mark notification as read
    async markRead(notificationId) {
        try {
            await API.notifications.markAsRead(notificationId);
            
            // Update UI
            const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (item) {
                item.classList.remove('unread');
                const markReadBtn = item.querySelector('.fa-check')?.parentElement;
                if (markReadBtn) {
                    markReadBtn.remove();
                }
            }
            
            // Update notification in state
            const notification = this.state.notifications.find(n => n.id == notificationId);
            if (notification) {
                notification.read = true;
            }
            
            // Update unread count
            const unreadCount = parseInt(DOM.getText('unreadCount') || '0');
            if (unreadCount > 0) {
                DOM.setText('unreadCount', unreadCount - 1);
            }
            
        } catch (error) {
            Config.error('Failed to mark notification as read:', error);
        }
    },
    
    // Mark all as read
    async markAllRead() {
        if (!confirm('Mark all notifications as read?')) {
            return;
        }
        
        try {
            await API.notifications.markAllAsRead();
            
            // Update UI
            document.querySelectorAll('.notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            
            // Update state
            this.state.notifications.forEach(n => n.read = true);
            
            // Update count
            DOM.setText('unreadCount', '0');
            
            App.showSuccess('All notifications marked as read');
            
        } catch (error) {
            App.showError('Failed to mark notifications as read');
        }
    },
    
    // Delete notification
    async deleteNotification(notificationId) {
        if (!confirm('Delete this notification?')) {
            return;
        }
        
        try {
            await API.notifications.delete(notificationId);
            
            // Remove from UI
            const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (item) {
                item.remove();
            }
            
            // Remove from state
            this.state.notifications = this.state.notifications.filter(n => n.id != notificationId);
            
            // Check if empty
            if (this.state.notifications.length === 0) {
                this.renderEmptyState();
            }
            
            App.showSuccess('Notification deleted');
            
        } catch (error) {
            App.showError('Failed to delete notification');
        }
    },
    
    // Clear all notifications
    async clearAll() {
        if (!confirm('Delete all notifications? This action cannot be undone.')) {
            return;
        }
        
        try {
            await API.notifications.clearAll();
            
            this.state.notifications = [];
            this.renderEmptyState();
            
            // Update stats
            DOM.setText('totalCount', '0');
            DOM.setText('unreadCount', '0');
            DOM.setText('weekCount', '0');
            
            App.showSuccess('All notifications cleared');
            
        } catch (error) {
            App.showError('Failed to clear notifications');
        }
    },
    
    // Load more notifications
    loadMore() {
        this.state.currentPage++;
        this.loadNotifications(true);
    },
    
    // Reset filters
    resetFilters() {
        this.state.filters = {
            unread: false,
            type: ''
        };
        
        DOM.get('unreadOnly').checked = false;
        DOM.setValue('typeFilter', '');
        
        this.state.currentPage = 1;
        this.loadNotifications();
    }
};

// Register component
window.NotificationsComponent = NotificationsComponent;