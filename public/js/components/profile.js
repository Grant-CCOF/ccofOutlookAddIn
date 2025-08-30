// Capital Choice Platform - Profile Component

const ProfileComponent = {
    // Component state
    state: {
        user: null,
        stats: null,
        isEditing: false
    },
    
    // Render profile
    async render() {
        try {
            App.showLoading(true);
            
            // Get current user
            const user = await API.auth.me();
            this.state.user = user;
            
            // Get user stats
            const stats = await API.users.getStats(user.id);
            this.state.stats = stats;
            
            // Render content
            const content = this.renderProfile();
            DOM.setHTML('pageContent', content);
            
            // Initialize event listeners
            this.initializeEventListeners();
            
        } catch (error) {
            Config.error('Failed to load profile:', error);
            App.showError('Failed to load profile');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Render profile content
    renderProfile() {
        const { user, stats } = this.state;
        const roleConfig = Config.USER_ROLES[user.role] || {};
        
        return `
            <div class="profile-container">
                <div class="row">
                    <!-- Profile Sidebar -->
                    <div class="col-lg-4">
                        <div class="card">
                            <div class="card-body text-center">                                
                                <h3 class="mt-3">${user.name}</h3>
                                <p class="text-muted">${user.email}</p>
                                
                                <div class="mb-3">
                                    <span class="badge badge-${roleConfig.color || 'secondary'}">
                                        <i class="fas ${roleConfig.icon || 'fa-user'}"></i> 
                                        ${roleConfig.label || user.role}
                                    </span>
                                </div>
                                
                                <div class="profile-stats">
                                    ${this.renderProfileStats(stats, user.role)}
                                </div>
                                
                                <hr>
                                
                                <div class="profile-meta">
                                    <p><i class="fas fa-building"></i> ${user.company || 'No company'}</p>
                                    <p><i class="fas fa-phone"></i> ${Formatter.phone(user.phone) || 'No phone'}</p>
                                    <p><i class="fas fa-calendar"></i> Joined ${Formatter.date(user.created_at)}</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Quick Actions -->
                        <div class="card mt-3">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Quick Actions</h5>
                            </div>
                            <div class="card-body">
                                <button class="btn btn-outline btn-block mb-2" 
                                        onclick="ProfileComponent.showChangePasswordModal()">
                                    <i class="fas fa-key"></i> Change Password
                                </button>
                                <button class="btn btn-outline btn-block mb-2" 
                                        onclick="ProfileComponent.showNotificationSettings()">
                                    <i class="fas fa-bell"></i> Notification Settings
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Profile Content -->
                    <div class="col-lg-8">
                        <!-- Profile Form -->
                        <div class="card">
                            <div class="card-header">
                                <h5 class="card-title mb-0">Profile Information</h5>
                                <button class="btn btn-sm btn-primary float-right" 
                                        onclick="ProfileComponent.toggleEdit()">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                            </div>
                            <div class="card-body">
                                <form id="profileForm">
                                    <!-- Form fields here - keep existing form structure -->
                                    ${this.renderProfileForm(user)}
                                </form>
                            </div>
                        </div>
                        
                        <!-- REMOVED RECENT ACTIVITY CARD -->
                        
                        <!-- Ratings - ONLY VISIBLE TO SELF IF PM/ADMIN -->
                        ${this.shouldShowOwnRatings(user) ? `
                            <div class="card mt-3">
                                <div class="card-header">
                                    <h5 class="card-title mb-0">My Ratings</h5>
                                </div>
                                <div class="card-body">
                                    ${this.renderRatings(stats)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    shouldShowOwnRatings(user) {
        const currentUser = State.getUser();
        const isOwnProfile = currentUser && currentUser.id === user.id;
        const canViewRatings = currentUser.role === 'admin' || currentUser.role === 'project_manager';
        const hasRatings = ['installation_company', 'operations', 'admin'].includes(user.role);
        
        // Show if: PM/Admin viewing any installer OR installer viewing own profile
        if (canViewRatings && hasRatings) return true;
        if (isOwnProfile && hasRatings) return true;
        
        return false;
    },

    renderProfileForm(user) {
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" 
                            class="form-control" 
                            name="name" 
                            value="${user.name}"
                            ${!this.state.isEditing ? 'disabled' : ''}>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" 
                            class="form-control" 
                            name="email" 
                            value="${user.email}"
                            ${!this.state.isEditing ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="tel" 
                            class="form-control" 
                            name="phone" 
                            value="${user.phone || ''}"
                            ${!this.state.isEditing ? 'disabled' : ''}>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" 
                            class="form-control" 
                            value="${user.username}"
                            disabled>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Company</label>
                        <input type="text" 
                            class="form-control" 
                            name="company" 
                            value="${user.company || ''}"
                            ${!this.state.isEditing ? 'disabled' : ''}>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label>Position</label>
                        <input type="text" 
                            class="form-control" 
                            name="position" 
                            value="${user.position || ''}"
                            ${!this.state.isEditing ? 'disabled' : ''}>
                    </div>
                </div>
            </div>
            
            ${this.state.isEditing ? `
                <div class="form-group">
                    <button type="submit" class="btn btn-primary">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                    <button type="button" 
                            class="btn btn-outline ml-2" 
                            onclick="ProfileComponent.cancelEdit()">
                        Cancel
                    </button>
                </div>
            ` : ''}
        `;
    },
    
    // Render profile stats
    renderProfileStats(stats, role) {
        if (!stats) return '';
        
        if (role === 'project_manager') {
            return `
                <div class="row text-center">
                    <div class="col-4">
                        <h4>${stats.projects_count || 0}</h4>
                        <small>Projects</small>
                    </div>
                    <div class="col-4">
                        <h4>${stats.active_projects || 0}</h4>
                        <small>Active</small>
                    </div>
                    <div class="col-4">
                        <h4>${stats.completed_projects || 0}</h4>
                        <small>Completed</small>
                    </div>
                </div>
            `;
        }
        
        if (['installation_company', 'operations'].includes(role)) {
            return `
                <div class="row text-center">
                    <div class="col-4">
                        <h4>${stats.bids_count || 0}</h4>
                        <small>Bids</small>
                    </div>
                    <div class="col-4">
                        <h4>${stats.won_bids || 0}</h4>
                        <small>Won</small>
                    </div>
                    <div class="col-4">
                        <h4>${stats.win_rate || 0}%</h4>
                        <small>Win Rate</small>
                    </div>
                </div>
            `;
        }
        
        return '';
    },
    
    // Render ratings
    renderRatings(stats) {
        if (!stats || !stats.average_rating) {
            return '<p class="text-muted">No ratings yet</p>';
        }
        
        return `
            <div class="rating-summary">
                <div class="text-center mb-3">
                    <h2>${stats.average_rating}</h2>
                    <div class="rating-stars">
                        ${Formatter.rating(stats.average_rating)}
                    </div>
                    <p class="text-muted">Based on ${stats.rating_count || 0} ratings</p>
                </div>
                
                <!-- Rating breakdown would go here -->
            </div>
        `;
    },
    
    // Initialize event listeners
    initializeEventListeners() {
        const form = DOM.get('profileForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }
    },
    
    // Toggle edit mode
    toggleEdit() {
        this.state.isEditing = !this.state.isEditing;
        this.render();
    },
    
    // Cancel edit
    cancelEdit() {
        this.state.isEditing = false;
        this.render();
    },
    
    // Save profile
    async saveProfile() {
        try {
            const form = DOM.get('profileForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Validate
            const validation = Validators.validateForm(data, {
                name: 'required',
                email: 'email',
                phone: 'phone'
            });
            
            if (!validation.valid) {
                Validators.showErrors(validation.errors, 'profileForm');
                return;
            }
            
            // Update profile
            await API.users.update(this.state.user.id, data);
            
            App.showSuccess('Profile updated successfully');
            
            // Refresh user data
            const user = await API.auth.me();
            this.state.user = user;
            State.setUser(user);
            
            this.state.isEditing = false;
            this.render();
            
        } catch (error) {
            App.showError('Failed to update profile');
        }
    },
    
    // Change avatar
    async changeAvatar() {
        const input = DOM.create('input', {
            type: 'file',
            accept: 'image/*'
        });
        
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Validate file
            const validation = Validators.file(file, {
                maxSize: 5 * 1024 * 1024, // 5MB
                allowedTypes: ['.jpg', '.jpeg', '.png', '.gif']
            });
            
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            try {
                App.showLoading(true);
                
                // Upload avatar
                const response = await API.files.upload(file, { type: 'avatar' });
                
                // Update user avatar
                await API.users.update(this.state.user.id, { 
                    avatar: response.url 
                });
                
                App.showSuccess('Avatar updated successfully');
                
                // Update UI
                DOM.setAttribute('profileAvatar', 'src', response.url);
                DOM.setAttribute('userAvatar', 'src', response.url);
                DOM.setAttribute('userAvatarLarge', 'src', response.url);
                
            } catch (error) {
                App.showError('Failed to update avatar');
            } finally {
                App.showLoading(false);
            }
        });
        
        input.click();
    },
    
    // Show change password modal
    showChangePasswordModal() {
        // Implementation for change password modal
        const modal = `
            <div class="modal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Change Password</h5>
                            <button class="close" onclick="this.closest('.modal').remove()">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="changePasswordForm">
                                <div class="form-group">
                                    <label>Current Password</label>
                                    <input type="password" class="form-control" name="currentPassword" required>
                                </div>
                                <div class="form-group">
                                    <label>New Password</label>
                                    <input type="password" class="form-control" name="newPassword" required>
                                </div>
                                <div class="form-group">
                                    <label>Confirm New Password</label>
                                    <input type="password" class="form-control" name="confirmPassword" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="ProfileComponent.changePassword()">
                                Change Password
                            </button>
                            <button class="btn btn-outline" onclick="this.closest('.modal').remove()">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        DOM.append('modalContainer', modal);
    },
    
    // Change password
    async changePassword() {
        const form = DOM.get('changePasswordForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        if (data.newPassword !== data.confirmPassword) {
            App.showError('Passwords do not match');
            return;
        }
        
        try {
            await Auth.changePassword(data.currentPassword, data.newPassword);
            App.showSuccess('Password changed successfully');
            DOM.query('.modal').remove();
        } catch (error) {
            App.showError('Failed to change password');
        }
    },
    
    // Show notification settings
    showNotificationSettings() {
        // Implementation for notification settings
        App.showToast('Info', 'Notification settings coming soon', 'info');
    },
    
    // Download user data
    async downloadData() {
        try {
            // Implementation for data download
            App.showSuccess('Your data download will begin shortly');
        } catch (error) {
            App.showError('Failed to download data');
        }
    }
};

// Register component
window.ProfileComponent = ProfileComponent;