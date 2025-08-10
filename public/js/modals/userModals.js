// Capital Choice Platform - User Modals

const UserModals = {
    // Show create user modal
    showCreateModal() {
        const content = this.getUserForm();
        const modal = this.createModal('Add New User', content, {
            confirmText: 'Create User'
        });
        
        // Initialize form
        this.initializeUserForm('createUserForm');
        
        // Handle submit
        DOM.on('createUserForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleCreateUser();
        });
    },
    
    // Show edit user modal
    showEditModal(user) {
        const content = this.getUserForm(user);
        const modal = this.createModal('Edit User', content, {
            confirmText: 'Update User'
        });
        
        // Initialize form
        this.initializeUserForm('editUserForm', user);
        
        // Handle submit
        DOM.on('editUserForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleEditUser(user.id);
        });
    },
    
    // Get user form
    getUserForm(user = null) {
        const isEdit = user !== null;
        const formId = isEdit ? 'editUserForm' : 'createUserForm';
        
        return `
            <form id="${formId}">
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Full Name <span class="required">*</span></label>
                            <input type="text" 
                                   class="form-control" 
                                   name="name" 
                                   value="${user?.name || ''}"
                                   required>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Username <span class="required">*</span></label>
                            <input type="text" 
                                   class="form-control" 
                                   name="username" 
                                   value="${user?.username || ''}"
                                   ${isEdit ? 'readonly' : 'required'}>
                            ${isEdit ? '<small class="form-text text-muted">Username cannot be changed</small>' : ''}
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Email Address <span class="required">*</span></label>
                            <input type="email" 
                                   class="form-control" 
                                   name="email" 
                                   value="${user?.email || ''}"
                                   required>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Phone Number</label>
                            <input type="tel" 
                                   class="form-control" 
                                   name="phone" 
                                   value="${user?.phone || ''}"
                                   placeholder="(123) 456-7890">
                        </div>
                    </div>
                </div>
                
                ${!isEdit ? `
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>Password <span class="required">*</span></label>
                                <input type="password" 
                                       class="form-control" 
                                       name="password" 
                                       required>
                                <small class="form-text text-muted">
                                    At least 8 characters with uppercase, lowercase, and numbers
                                </small>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="form-group">
                                <label>Confirm Password <span class="required">*</span></label>
                                <input type="password" 
                                       class="form-control" 
                                       name="confirmPassword" 
                                       required>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Role <span class="required">*</span></label>
                            <select class="form-control" name="role" required>
                                <option value="">Select Role</option>
                                <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>
                                    Administrator
                                </option>
                                <option value="project_manager" ${user?.role === 'project_manager' ? 'selected' : ''}>
                                    Project Manager
                                </option>
                                <option value="installation_company" ${user?.role === 'installation_company' ? 'selected' : ''}>
                                    Installation Company
                                </option>
                                <option value="operations" ${user?.role === 'operations' ? 'selected' : ''}>
                                    Operations
                                </option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="form-group">
                            <label>Company</label>
                            <input type="text" 
                                   class="form-control" 
                                   name="company" 
                                   value="${user?.company || ''}">
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Position</label>
                    <input type="text" 
                           class="form-control" 
                           name="position" 
                           value="${user?.position || ''}">
                </div>
                
                ${isEdit ? `
                    <div class="form-group">
                        <label>Status</label>
                        <div class="custom-control custom-checkbox">
                            <input type="checkbox" 
                                   class="custom-control-input" 
                                   id="userApproved"
                                   name="approved"
                                   ${user?.approved ? 'checked' : ''}>
                            <label class="custom-control-label" for="userApproved">
                                User is approved and can access the system
                            </label>
                        </div>
                        
                        <div class="custom-control custom-checkbox mt-2">
                            <input type="checkbox" 
                                   class="custom-control-input" 
                                   id="userSuspended"
                                   name="suspended"
                                   ${user?.suspended ? 'checked' : ''}>
                            <label class="custom-control-label" for="userSuspended">
                                User is suspended
                            </label>
                        </div>
                    </div>
                ` : `
                    <div class="form-group">
                        <div class="custom-control custom-checkbox">
                            <input type="checkbox" 
                                   class="custom-control-input" 
                                   id="autoApprove"
                                   name="approved"
                                   checked>
                            <label class="custom-control-label" for="autoApprove">
                                Automatically approve this user
                            </label>
                        </div>
                        
                        <div class="custom-control custom-checkbox mt-2">
                            <input type="checkbox" 
                                   class="custom-control-input" 
                                   id="sendWelcome"
                                   name="send_welcome"
                                   checked>
                            <label class="custom-control-label" for="sendWelcome">
                                Send welcome email with login credentials
                            </label>
                        </div>
                    </div>
                `}
            </form>
        `;
    },
    
    // Initialize user form
    initializeUserForm(formId, user = null) {
        const form = DOM.get(formId);
        if (!form) return;
        
        // Add validation
        const usernameInput = form.querySelector('[name="username"]');
        if (usernameInput && !user) {
            usernameInput.addEventListener('input', DOM.debounce(async (e) => {
                const username = e.target.value;
                if (username.length >= 3) {
                    // Check if username exists
                    const available = await this.checkUsernameAvailability(username);
                    if (!available) {
                        e.target.setCustomValidity('Username is already taken');
                    } else {
                        e.target.setCustomValidity('');
                    }
                }
            }, 500));
        }
        
        // Password validation
        if (!user) {
            const passwordInput = form.querySelector('[name="password"]');
            const confirmInput = form.querySelector('[name="confirmPassword"]');
            
            if (confirmInput) {
                confirmInput.addEventListener('input', () => {
                    if (confirmInput.value !== passwordInput.value) {
                        confirmInput.setCustomValidity('Passwords do not match');
                    } else {
                        confirmInput.setCustomValidity('');
                    }
                });
            }
        }
    },
    
    // Check username availability
    async checkUsernameAvailability(username) {
        try {
            const response = await API.get('/users/check-username', { username });
            return response.available;
        } catch {
            return true; // Assume available on error
        }
    },
    
    // Handle create user
    async handleCreateUser() {
        try {
            const form = DOM.get('createUserForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Validate
            const validation = this.validateUserData(data);
            if (!validation.valid) {
                App.showError(validation.message);
                return;
            }
            
            // Process checkboxes
            data.approved = formData.has('approved');
            data.send_welcome = formData.has('send_welcome');
            
            App.showLoading(true);
            
            // Create user
            await API.auth.register(data);
            
            App.showSuccess('User created successfully');
            this.closeModal();
            
            // Refresh users list
            if (window.UsersComponent) {
                UsersComponent.loadUsers();
            }
            
        } catch (error) {
            App.showError('Failed to create user');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Handle edit user
    async handleEditUser(userId) {
        try {
            const form = DOM.get('editUserForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Process checkboxes
            data.approved = formData.has('approved');
            data.suspended = formData.has('suspended');
            
            // Remove username (can't be changed)
            delete data.username;
            
            App.showLoading(true);
            
            // Update user
            await API.users.update(userId, data);
            
            App.showSuccess('User updated successfully');
            this.closeModal();
            
            // Refresh users list
            if (window.UsersComponent) {
                UsersComponent.loadUsers();
            }
            
        } catch (error) {
            App.showError('Failed to update user');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Validate user data
    validateUserData(data, isEdit = false) {
        // Name validation
        if (!data.name || data.name.trim().length < 2) {
            return { valid: false, message: 'Name must be at least 2 characters' };
        }
        
        // Username validation (only for new users)
        if (!isEdit) {
            const usernameValidation = Validators.username(data.username);
            if (!usernameValidation.valid) {
                return usernameValidation;
            }
        }
        
        // Email validation
        const emailValidation = Validators.email(data.email);
        if (!emailValidation.valid) {
            return emailValidation;
        }
        
        // Phone validation (if provided)
        if (data.phone) {
            const phoneValidation = Validators.phone(data.phone);
            if (!phoneValidation.valid) {
                return phoneValidation;
            }
        }
        
        // Password validation (only for new users)
        if (!isEdit) {
            const passwordValidation = Validators.password(data.password);
            if (!passwordValidation.valid) {
                return passwordValidation;
            }
            
            if (data.password !== data.confirmPassword) {
                return { valid: false, message: 'Passwords do not match' };
            }
        }
        
        // Role validation
        if (!data.role) {
            return { valid: false, message: 'Please select a role' };
        }
        
        return { valid: true };
    },
    
    // Create modal helper
    createModal(title, content, options = {}) {
        const {
            size = 'large',
            confirmText = 'Save',
            cancelText = 'Cancel'
        } = options;
        
        const modalId = `modal-${Date.now()}`;
        
        const modalHTML = `
            <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-${size}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="close" onclick="UserModals.closeModal('${modalId}')">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            <button type="submit" form="${content.match(/id="([^"]+)"/)?.[1]}" class="btn btn-primary">
                                ${confirmText}
                            </button>
                            <button type="button" class="btn btn-outline" onclick="UserModals.closeModal('${modalId}')">
                                ${cancelText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show" id="${modalId}-backdrop"></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.classList.add('modal-open');
        
        return modalId;
    },
    
    // Close modal
    closeModal(modalId) {
        const modal = modalId ? DOM.get(modalId) : document.querySelector('.modal.show');
        const backdrop = modalId ? DOM.get(`${modalId}-backdrop`) : document.querySelector('.modal-backdrop');
        
        if (modal) {
            modal.remove();
        }
        
        if (backdrop) {
            backdrop.remove();
        }
        
        // Remove modal-open class if no more modals
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
    }
};

// Register globally
window.UserModals = UserModals;