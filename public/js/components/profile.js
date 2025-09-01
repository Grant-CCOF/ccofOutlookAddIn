// Capital Choice Platform - Profile Component

const ProfileComponent = {
    // Component state
    state: {
        user: null,
        stats: null,
        certifications: [],
        isEditing: false
    },
    
    // Render profile
    async render(userId = null) {
        try {
            App.showLoading(true);
            
            // Get user (current user or specified user)
            const targetUserId = userId || Auth.getUserId();
            const user = userId ? await API.users.getById(userId) : await API.auth.me();
            this.state.user = user;
            
            // Get user stats
            const stats = await API.users.getStats(targetUserId);
            this.state.stats = stats;
            
            // Get user certifications
            const certifications = await API.files.getUserCertifications(targetUserId);
            this.state.certifications = certifications;
            
            // Render content
            const content = this.renderProfile(userId !== null);
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
        const { user, stats, certifications } = this.state;
        const roleConfig = Config.USER_ROLES[user.role] || {};
        const isOwnProfile = !isViewingOther;
        
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
                        
                        <!-- Certifications Card -->
                            <div class="card mt-3">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h5 class="card-title mb-0">Certifications</h5>
                                    ${isOwnProfile ? `
                                        <button class="btn btn-sm btn-primary" onclick="ProfileComponent.showUploadCertificationModal()">
                                            <i class="fas fa-plus"></i> Add
                                        </button>
                                    ` : ''}
                                </div>
                                <div class="card-body">
                                    ${this.renderCertifications(certifications, isOwnProfile)}
                                </div>
                            </div>
                        </div>
                        
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

    // Add method to render certifications
    renderCertifications(certifications, isOwnProfile) {
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
                                        onclick="ProfileComponent.downloadCertification(${cert.id}, '${cert.original_name.replace(/'/g, "\\'")}')">
                                    <i class="fas fa-download"></i>
                                </button>
                                ${isOwnProfile ? `
                                    <button class="btn btn-outline-danger" 
                                            onclick="ProfileComponent.deleteCertification(${cert.id})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // Add method to show upload modal
    showUploadCertificationModal() {
        const modalHTML = `
            <div class="modal fade show" id="uploadCertModal" tabindex="-1" style="display: block;">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Upload Certification</h5>
                            <button type="button" class="close" onclick="ProfileComponent.closeUploadModal()">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="uploadCertForm">
                                <div class="form-group">
                                    <label>Select Certification File <span class="text-danger">*</span></label>
                                    <input type="file" 
                                        class="form-control" 
                                        id="certFile"
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        required>
                                    <small class="text-muted">
                                        Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
                                    </small>
                                </div>
                                
                                <div class="form-group">
                                    <label>Description (Optional)</label>
                                    <textarea class="form-control" 
                                            id="certDescription" 
                                            rows="3"
                                            placeholder="e.g., AWS Certified Solutions Architect, Valid until 2025"></textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" 
                                    class="btn btn-primary" 
                                    onclick="ProfileComponent.uploadCertification()">
                                <i class="fas fa-upload"></i> Upload
                            </button>
                            <button type="button" 
                                    class="btn btn-outline" 
                                    onclick="ProfileComponent.closeUploadModal()">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show" id="uploadCertBackdrop"></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.classList.add('modal-open');
    },

    // Add upload certification method
    async uploadCertification() {
        const fileInput = document.getElementById('certFile');
        const descriptionInput = document.getElementById('certDescription');
        
        if (!fileInput.files[0]) {
            App.showError('Please select a file');
            return;
        }
        
        const file = fileInput.files[0];
        const description = descriptionInput.value.trim();
        
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            App.showError('File size must be less than 10MB');
            return;
        }
        
        try {
            App.showLoading(true);
            
            await API.files.uploadCertification(file, description);
            
            App.showSuccess('Certification uploaded successfully');
            this.closeUploadModal();
            
            // Reload certifications
            await this.render();
            
        } catch (error) {
            App.showError('Failed to upload certification');
        } finally {
            App.showLoading(false);
        }
    },

    // Add delete certification method
    async deleteCertification(certId) {
        if (!confirm('Are you sure you want to delete this certification?')) {
            return;
        }
        
        try {
            App.showLoading(true);
            
            await API.files.deleteCertification(certId);
            
            App.showSuccess('Certification deleted successfully');
            
            // Reload certifications
            await this.render();
            
        } catch (error) {
            App.showError('Failed to delete certification');
        } finally {
            App.showLoading(false);
        }
    },

    // Add download certification method
    async downloadCertification(certId, filename) {
        try {
            await API.files.download(certId, filename);
        } catch (error) {
            App.showError('Failed to download certification');
        }
    },

    // Add helper method for file icons
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

    // Add method to close upload modal
    closeUploadModal() {
        const modal = document.getElementById('uploadCertModal');
        const backdrop = document.getElementById('uploadCertBackdrop');
        
        if (modal) modal.remove();
        if (backdrop) backdrop.remove();
        
        document.body.classList.remove('modal-open');
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
        const modalHTML = `
            <div class="modal fade show" id="changePasswordModal" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-md">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Change Password</h5>
                            <button type="button" class="close" onclick="ProfileComponent.closeChangePasswordModal()">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <form id="changePasswordForm" onsubmit="event.preventDefault(); ProfileComponent.changePassword();">
                                <div class="form-group">
                                    <label>Current Password <span class="text-danger">*</span></label>
                                    <input type="password" 
                                        class="form-control" 
                                        id="currentPassword"
                                        name="currentPassword" 
                                        required
                                        autocomplete="current-password">
                                    <small class="text-danger" id="currentPasswordError" style="display: none;"></small>
                                </div>
                                
                                <div class="form-group">
                                    <label>New Password <span class="text-danger">*</span></label>
                                    <input type="password" 
                                        class="form-control" 
                                        id="newPassword"
                                        name="newPassword" 
                                        required
                                        minlength="8"
                                        pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}"
                                        title="Must contain at least one number, one uppercase and lowercase letter, and at least 8 characters"
                                        autocomplete="new-password"
                                        oninput="ProfileComponent.validatePasswordMatch()">
                                    <small class="text-muted">
                                        Must be at least 8 characters with:
                                        <ul class="mb-0" style="font-size: 0.875rem;">
                                            <li>At least one uppercase letter (A-Z)</li>
                                            <li>At least one lowercase letter (a-z)</li>
                                            <li>At least one number (0-9)</li>
                                        </ul>
                                    </small>
                                </div>
                                
                                <div class="form-group">
                                    <label>Confirm New Password <span class="text-danger">*</span></label>
                                    <input type="password" 
                                        class="form-control" 
                                        id="confirmPassword"
                                        name="confirmPassword" 
                                        required
                                        minlength="8"
                                        autocomplete="new-password"
                                        oninput="ProfileComponent.validatePasswordMatch()">
                                    <small class="text-danger" id="confirmPasswordError" style="display: none;"></small>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" 
                                    class="btn btn-primary" 
                                    id="changePasswordBtn"
                                    onclick="ProfileComponent.changePassword()">
                                <i class="fas fa-key"></i> Change Password
                            </button>
                            <button type="button" 
                                    class="btn btn-outline" 
                                    onclick="ProfileComponent.closeChangePasswordModal()">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show" id="changePasswordBackdrop"></div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.classList.add('modal-open');
        
        // Focus on first input
        setTimeout(() => {
            document.getElementById('currentPassword').focus();
        }, 100);
    },

    // Validate password match in real-time
    validatePasswordMatch() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('confirmPasswordError');
        const submitBtn = document.getElementById('changePasswordBtn');
        
        if (confirmPassword && newPassword !== confirmPassword) {
            errorElement.textContent = 'Passwords do not match';
            errorElement.style.display = 'block';
            submitBtn.disabled = true;
        } else {
            errorElement.style.display = 'none';
            submitBtn.disabled = false;
        }
    },
    
    // Change password
    async changePassword() {
        const form = document.getElementById('changePasswordForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Clear any previous error messages
        this.clearPasswordErrors();
        
        // Validate passwords match
        if (data.newPassword !== data.confirmPassword) {
            const errorElement = document.getElementById('confirmPasswordError');
            errorElement.textContent = 'Passwords do not match';
            errorElement.style.display = 'block';
            return;
        }
        
        // Validate password strength (must match backend requirements)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(data.newPassword)) {
            const errorElement = document.getElementById('confirmPasswordError');
            errorElement.textContent = 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number';
            errorElement.style.display = 'block';
            return;
        }
        
        try {
            App.showLoading(true);
            
            // Call API to change password
            const response = await fetch(`${Config.API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.getToken()}`
                },
                body: JSON.stringify({
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword
                })
            });
            
            const responseData = await response.json();
            
            if (!response.ok) {
                // Handle different error types
                if (response.status === 401) {
                    // Incorrect current password
                    const errorElement = document.getElementById('currentPasswordError');
                    errorElement.textContent = 'Incorrect password';
                    errorElement.style.display = 'block';
                    
                    // Clear all password fields
                    this.clearPasswordFields();
                    
                    // Focus back on current password field
                    document.getElementById('currentPassword').focus();
                } else if (response.status === 400) {
                    // Validation error
                    let errorMessage = 'Password does not meet requirements';
                    
                    if (responseData.errors && Array.isArray(responseData.errors)) {
                        // Express-validator error format
                        errorMessage = responseData.errors.map(e => e.msg || e.message).join('. ');
                    } else if (responseData.error) {
                        errorMessage = responseData.error;
                    }
                    
                    const errorElement = document.getElementById('confirmPasswordError');
                    errorElement.textContent = errorMessage;
                    errorElement.style.display = 'block';
                    
                    // Clear password fields but keep current password
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                } else {
                    // Other errors
                    App.showError(responseData.error || 'Failed to change password');
                    this.clearPasswordFields();
                }
            } else {
                // Success - close modal and show success message
                App.showSuccess('Password changed successfully');
                this.closeChangePasswordModal();
            }
            
        } catch (error) {
            console.error('Change password error:', error);
            App.showError('Failed to change password. Please try again.');
            this.clearPasswordFields();
        } finally {
            App.showLoading(false);
        }
    },

    // Clear all password fields
    clearPasswordFields() {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    },

    // Clear error messages
    clearPasswordErrors() {
        document.getElementById('currentPasswordError').style.display = 'none';
        document.getElementById('confirmPasswordError').style.display = 'none';
    },

    // Close change password modal
    closeChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        const backdrop = document.getElementById('changePasswordBackdrop');
        
        if (modal) {
            modal.remove();
        }
        if (backdrop) {
            backdrop.remove();
        }
        
        document.body.classList.remove('modal-open');
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