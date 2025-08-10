// Capital Choice Platform - Main Application Controller
// Final fixed version with proper initialization and state management

const App = {
    // Application state - properly initialized
    initialized: false,
    currentRoute: null,
    socket: null,
    currentUser: null,
    
    // Initialize application - prevent double initialization
    async init() {
        // Prevent double initialization
        if (this.initialized) {
            console.log('App already initialized, skipping...');
            return;
        }
        
        console.log('Initializing Capital Choice Platform...');
        
        try {
            // Check authentication status
            if (!Auth.isAuthenticated()) {
                console.log('User not authenticated, showing login page');
                this.showLoginPage();
                return;
            }
            
            // User is authenticated, initialize the main app
            await this.initializeApp();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application');
            this.showLoginPage();
        }
    },
    
    // Initialize main application (after successful login)
    async initializeApp() {
        console.log('Initializing main application...');
        
        try {
            // Show loading while initializing
            this.showLoading(true);
            
            // Get current user data
            const user = await Auth.getCurrentUser();
            if (!user) {
                throw new Error('Failed to get user data');
            }
            
            // Store user in state
            this.currentUser = user;
            State.setUser(user);
            
            // Hide login page
            DOM.hide('loginPage');
            
            // Show main application elements
            DOM.show('mainNav');
            DOM.show('sidebar');
            DOM.show('mainContent');
            
            console.log('Initializing components...');
            
            // Initialize components
            this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize Socket.IO (with proper error handling)
            this.initializeSocket();
            
            // Update UI for user role
            this.updateUIForRole(user.role);
            
            // Update navigation with user info
            this.updateNavigation();
            
            // Setup router AFTER everything else is initialized
            Router.init();
            
            // Hide loading overlay
            this.showLoading(false);
            
            // Mark as initialized
            this.initialized = true;
            
            console.log('Application initialized successfully');
            this.showSuccess(`Welcome back, ${user.name}!`);
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showLoading(false);
            
            // Don't logout if it's just a component loading issue
            if (error.message.includes('Failed to get user data')) {
                this.showError('Failed to load application. Please try logging in again.');
                await Auth.logout();
                this.showLoginPage();
            } else {
                // For other errors, just show the error but stay logged in
                this.showError('Some features may not be available. Please refresh the page.');
            }
        }
    },
    
    // Update navigation with user info
    updateNavigation() {
        const user = this.currentUser;
        if (!user) return;
        
        // Update user name in navigation
        DOM.setText('userName', user.name || 'User');
        DOM.setText('dropdownUserName', user.name || 'User');
        
        // Format and display role (using correct Formatter method)
        const formattedRole = typeof Formatter !== 'undefined' && Formatter.role ? 
            Formatter.role(user.role) : 
            user.role.replace(/_/g, ' ').toUpperCase();
        DOM.setText('dropdownUserRole', formattedRole);
    },
    
    // Show login page
    showLoginPage() {
        console.log('Showing login page');
        
        // Hide loading
        this.showLoading(false);
        
        // Hide main app elements
        DOM.hide('mainNav');
        DOM.hide('sidebar');
        DOM.hide('mainContent');
        
        // Show login page
        DOM.show('loginPage');
        
        // Initialize login form
        this.initializeLoginForm();
        
        // Check for remembered username
        const rememberedUsername = localStorage.getItem('rememberedUsername');
        if (rememberedUsername) {
            DOM.setValue('loginUsername', rememberedUsername);
            DOM.get('rememberMe').checked = true;
        }
    },
    
    // Initialize login form
    initializeLoginForm() {
        const form = DOM.get('loginForm');
        if (!form) return;
        
        // Check if already initialized
        if (form.dataset.initialized === 'true') {
            return;
        }
        
        // Mark as initialized
        form.dataset.initialized = 'true';
        
        // Add submit handler
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
        
        // Add password toggle
        const toggleBtn = form.querySelector('.toggle-password');
        if (toggleBtn && !toggleBtn.dataset.initialized) {
            toggleBtn.dataset.initialized = 'true';
            toggleBtn.addEventListener('click', () => {
                const input = DOM.get('loginPassword');
                const icon = toggleBtn.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.replace('fa-eye', 'fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.replace('fa-eye-slash', 'fa-eye');
                }
            });
        }
    },
    
    // Handle login
    async handleLogin() {
        const username = DOM.getValue('loginUsername');
        const password = DOM.getValue('loginPassword');
        const remember = DOM.get('rememberMe').checked;
        
        if (!username || !password) {
            this.showError('Please enter username and password');
            return;
        }
        
        try {
            // Show loading on button
            const submitBtn = DOM.query('#loginForm button[type="submit"]');
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            
            // Hide any previous errors
            DOM.hide('loginError');
            
            console.log('Attempting login for:', username);
            
            // Attempt login
            const result = await Auth.login(username, password, remember);
            
            if (result.success) {
                console.log('Login successful');
                
                // Handle remember me
                if (remember) {
                    localStorage.setItem('rememberedUsername', username);
                } else {
                    localStorage.removeItem('rememberedUsername');
                }
                
                // Initialize the main application
                await this.initializeApp();
                
            } else {
                console.log('Login failed:', result.message);
                DOM.setText('loginError', result.message || 'Invalid username or password');
                DOM.show('loginError');
                
                // Remove loading state
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('Login error:', error);
            DOM.setText('loginError', 'Login failed. Please try again.');
            DOM.show('loginError');
            
            // Remove loading state
            const submitBtn = DOM.query('#loginForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
        }
    },
    
    // Initialize components
    initializeComponents() {
        console.log('Initializing UI components...');
        
        // Initialize notification bell
        this.initializeNotifications();
        
        // Initialize user menu
        this.initializeUserMenu();
        
        // Initialize sidebar
        this.initializeSidebar();
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Logout button
        const logoutBtn = DOM.get('logoutBtn');
        if (logoutBtn && !logoutBtn.dataset.initialized) {
            logoutBtn.dataset.initialized = 'true';
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.logout();
            });
        }
        
        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        }, { passive: true });
    },
    
    // Initialize Socket.IO with better error handling
    initializeSocket() {
        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.warn('Socket.IO library not available, skipping socket initialization');
            return;
        }
        
        try {
            // Get the token
            const token = Auth.getToken();
            if (!token) {
                console.warn('No auth token available for socket connection');
                return;
            }
            
            // Configure socket connection with proper URL
            const socketUrl = window.location.origin; // Use same origin as the page
            
            this.socket = io(socketUrl, {
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 5
            });
            
            // Socket event handlers
            this.socket.on('connect', () => {
                console.log('Socket connected');
                const statusEl = DOM.get('connectionStatus');
                if (statusEl) {
                    statusEl.classList.add('online');
                    statusEl.classList.remove('offline');
                }
                DOM.setText('connectionText', 'Connected');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
                const statusEl = DOM.get('connectionStatus');
                if (statusEl) {
                    statusEl.classList.remove('online');
                    statusEl.classList.add('offline');
                }
                DOM.setText('connectionText', 'Disconnected');
            });
            
            this.socket.on('connect_error', (error) => {
                console.warn('Socket connection error:', error.message);
                // Don't show error to user unless it's critical
                if (error.type === 'TransportError') {
                    console.log('Socket transport error, will retry...');
                }
            });
            
            this.socket.on('notification', (data) => {
                this.handleNotification(data);
            });
            
            // Store socket reference if State is available
            if (typeof State !== 'undefined' && State.setSocket) {
                State.setSocket(this.socket);
            }
            
        } catch (error) {
            console.error('Socket initialization error:', error);
            // Don't fail the entire app initialization if socket fails
            console.warn('Application will continue without real-time updates');
        }
    },
    
    // Initialize notifications
    initializeNotifications() {
        const bell = DOM.get('notificationBell');
        const dropdown = DOM.get('notificationDropdown');
        
        if (bell && dropdown && !bell.dataset.initialized) {
            bell.dataset.initialized = 'true';
            
            bell.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
            
            // Close on outside click
            document.addEventListener('click', () => {
                dropdown.classList.remove('active');
            });
            
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // Mark all as read
        const markAllBtn = DOM.get('markAllRead');
        if (markAllBtn && !markAllBtn.dataset.initialized) {
            markAllBtn.dataset.initialized = 'true';
            markAllBtn.addEventListener('click', () => {
                if (typeof NotificationsComponent !== 'undefined') {
                    NotificationsComponent.markAllAsRead();
                }
            });
        }
    },
    
    // Initialize user menu
    initializeUserMenu() {
        const trigger = DOM.get('userMenuTrigger');
        const dropdown = DOM.get('userDropdown');
        
        if (trigger && dropdown && !trigger.dataset.initialized) {
            trigger.dataset.initialized = 'true';
            
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
            
            // Close on outside click
            document.addEventListener('click', () => {
                dropdown.classList.remove('active');
            });
            
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    },
    
    // Initialize sidebar
    initializeSidebar() {
        // Add active class to current route
        const currentHash = window.location.hash || '#/dashboard';
        const currentRoute = currentHash.substring(1); // Remove #
        
        document.querySelectorAll('.menu-link').forEach(link => {
            // Check if already initialized
            if (link.dataset.initialized) return;
            link.dataset.initialized = 'true';
            
            const route = link.getAttribute('data-route');
            if (route && currentRoute.includes(route)) {
                link.classList.add('active');
            }
            
            // Add click handler
            link.addEventListener('click', (e) => {
                // Remove active from all
                document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
                // Add active to clicked
                link.classList.add('active');
            });
        });
        
        // Sidebar toggle functionality if needed
        const toggleBtn = DOM.query('.sidebar-toggle');
        if (toggleBtn && !toggleBtn.dataset.initialized) {
            toggleBtn.dataset.initialized = 'true';
            toggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
            });
        }
        
        // Restore sidebar state
        if (localStorage.getItem('sidebarCollapsed') === 'true') {
            document.body.classList.add('sidebar-collapsed');
        }
    },
    
    // Update UI for user role
    updateUIForRole(role) {
        console.log('Updating UI for role:', role);
        
        // Remove all role classes
        document.body.classList.remove('admin-mode', 'pm-mode', 'installer-mode', 'ops-mode');
        
        // Add role-specific class
        switch(role) {
            case 'admin':
                document.body.classList.add('admin-mode');
                break;
            case 'project_manager':
                document.body.classList.add('pm-mode');
                break;
            case 'installation_company':
                document.body.classList.add('installer-mode');
                break;
            case 'operations':
                document.body.classList.add('ops-mode');
                break;
        }
        
        // Show/hide role-specific elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = role === 'admin' ? '' : 'none';
        });
        
        document.querySelectorAll('.pm-only').forEach(el => {
            el.style.display = role === 'project_manager' ? '' : 'none';
        });
        
        document.querySelectorAll('.contractor-only').forEach(el => {
            const isContractor = ['installation_company', 'operations'].includes(role);
            el.style.display = isContractor ? '' : 'none';
        });
    },
    
    // Handle window resize
    handleResize() {
        // Auto-collapse sidebar on mobile
        if (window.innerWidth < 768) {
            document.body.classList.add('sidebar-collapsed');
        }
    },
    
    // Handle notifications
    handleNotification(data) {
        console.log('Received notification:', data);
        
        // Show toast
        this.showToast(data.title || 'Notification', data.message, data.type || 'info');
        
        // Update notification count
        const count = DOM.get('notificationCount');
        if (count) {
            const currentCount = parseInt(count.textContent) || 0;
            count.textContent = currentCount + 1;
            count.style.display = currentCount >= 0 ? 'flex' : 'none';
        }
        
        // Add to notification list if component is available
        if (typeof NotificationsComponent !== 'undefined') {
            NotificationsComponent.addNotification(data);
        }
    },
    
    // Logout
    async logout() {
        try {
            this.showLoading(true);
            await Auth.logout();
            
            // Disconnect socket
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            
            // Reset state
            if (typeof State !== 'undefined' && State.clear) {
                State.clear();
            }
            this.initialized = false;
            this.currentUser = null;
            this.currentRoute = null;
            
            // Reset form initialization flags
            const loginForm = DOM.get('loginForm');
            if (loginForm) {
                loginForm.dataset.initialized = 'false';
            }
            
            // Show login page
            this.showLoginPage();
            
            this.showSuccess('You have been logged out successfully');
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Logout failed');
        } finally {
            this.showLoading(false);
        }
    },
    
    // Show loading overlay
    showLoading(show = true) {
        const overlay = DOM.get('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    },
    
    // Show toast notification
    showToast(title, message, type = 'info') {
        const container = DOM.get('toastContainer');
        if (!container) return;
        
        const toastId = `toast-${Date.now()}`;
        const toast = DOM.create('div', {
            id: toastId,
            className: `toast toast-${type} animate__animated animate__fadeInRight`
        });
        
        toast.innerHTML = `
            <div class="toast-header">
                <strong>${title}</strong>
                <button class="btn-icon toast-close" onclick="App.removeToast('${toastId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="toast-body">${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            this.removeToast(toastId);
        }, 5000);
    },
    
    // Remove toast
    removeToast(toastId) {
        const toast = DOM.get(toastId);
        if (toast) {
            toast.classList.add('animate__fadeOutRight');
            setTimeout(() => {
                toast.remove();
            }, 500);
        }
    },
    
    // Show success message
    showSuccess(message) {
        this.showToast('Success', message, 'success');
    },
    
    // Show error message
    showError(message) {
        this.showToast('Error', message, 'danger');
    },
    
    // Show warning message
    showWarning(message) {
        this.showToast('Warning', message, 'warning');
    },
    
    // Show info message
    showInfo(message) {
        this.showToast('Information', message, 'info');
    }
};

// Make App globally available
window.App = App;

// Only initialize once when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Small delay to ensure all scripts are loaded
        setTimeout(() => {
            App.init();
        }, 100);
    });
} else {
    // DOM is already loaded, but still add small delay for other scripts
    setTimeout(() => {
        App.init();
    }, 100);
}