// Capital Choice Platform - Main Application Controller
// Final fixed version with proper initialization and state management

const App = {
    // Application state - properly initialized
    initialized: false,
    currentRoute: null, // Initialize as null to avoid undefined errors
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
            
            // Store user in state - CRITICAL: Set currentRoute BEFORE router init
            this.currentUser = user;
            this.currentRoute = '/dashboard'; // Initialize route before router
            State.setUser(user);
            
            // Hide login page
            DOM.hide('loginPage');
            
            // Show main application elements
            DOM.show('mainNav');
            DOM.show('sidebar');
            DOM.show('mainContent');
            
            console.log('Initializing components...');
            
            // Initialize components first
            this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize Socket.IO (with proper error handling)
            this.initializeSocket();
            
            // Update UI for user role
            this.updateUIForRole(user.role);
            
            // Update navigation with user info
            this.updateNavigation();
            
            // CRITICAL: Mark as initialized BEFORE router init to prevent race conditions
            this.initialized = true;
            
            // NOW initialize router - this order is critical
            Router.init();
            
            // Hide loading overlay
            this.showLoading(false);
            
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
    
    // Initialize components
    initializeComponents() {
        console.log('Initializing UI components...');
        
        // Initialize utility components
        if (typeof Utils !== 'undefined' && Utils.init) {
            Utils.init();
        }
        
        // Initialize state management
        if (typeof State !== 'undefined' && State.init) {
            State.init();
        }
        
        // Initialize notification system
        if (typeof NotificationManager !== 'undefined' && NotificationManager.init) {
            NotificationManager.init();
        }
        
        // Initialize modals
        if (typeof ModalManager !== 'undefined' && ModalManager.init) {
            ModalManager.init();
        }
        
        // Initialize forms
        if (typeof FormManager !== 'undefined' && FormManager.init) {
            FormManager.init();
        }
        
        // Initialize file uploader
        if (typeof FileUploader !== 'undefined' && FileUploader.init) {
            FileUploader.init();
        }
        
        console.log('UI components initialized');
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Logout button
        const logoutBtn = DOM.get('logoutBtn');
        if (logoutBtn && !logoutBtn.dataset.initialized) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.logout();
            });
            logoutBtn.dataset.initialized = 'true';
        }
        
        // Sidebar toggle
        const sidebarToggle = DOM.get('sidebarToggle');
        if (sidebarToggle && !sidebarToggle.dataset.initialized) {
            sidebarToggle.addEventListener('click', () => {
                document.body.classList.toggle('sidebar-collapsed');
                localStorage.setItem('sidebarCollapsed', 
                    document.body.classList.contains('sidebar-collapsed'));
            });
            sidebarToggle.dataset.initialized = 'true';
        }
        
        // Window resize handler
        if (!window.appResizeHandlerInitialized) {
            window.addEventListener('resize', () => this.handleResize());
            window.appResizeHandlerInitialized = true;
        }
        
        // Global error handler
        if (!window.appErrorHandlerInitialized) {
            window.addEventListener('error', (event) => {
                console.error('Global error:', event.error);
                this.showError('An unexpected error occurred');
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                console.error('Unhandled promise rejection:', event.reason);
                this.showError('An unexpected error occurred');
            });
            window.appErrorHandlerInitialized = true;
        }
        
        // Restore sidebar state
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (sidebarCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        }
    },
    
    // Initialize Socket.IO connection
    initializeSocket() {
        if (this.socket) {
            console.log('Socket already connected');
            return;
        }
        
        try {
            // Initialize Socket.IO with proper configuration
            this.socket = io(Config.SOCKET_URL, {
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 10000,
                forceNew: false
            });
            
            // Connection event handlers
            this.socket.on('connect', () => {
                console.log('Socket connected');
                
                // Join user room for notifications
                if (this.currentUser) {
                    this.socket.emit('join', {
                        userId: this.currentUser.id,
                        role: this.currentUser.role
                    });
                }
            });
            
            this.socket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason);
                if (reason === 'io server disconnect') {
                    // Server disconnected, try to reconnect
                    this.socket.connect();
                }
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
            
            // Application-specific event handlers
            this.socket.on('notification', (data) => this.handleNotification(data));
            this.socket.on('project_update', (data) => this.handleProjectUpdate(data));
            this.socket.on('bid_update', (data) => this.handleBidUpdate(data));
            this.socket.on('user_update', (data) => this.handleUserUpdate(data));
            
        } catch (error) {
            console.error('Socket initialization error:', error);
        }
    },
    
    // Handle successful login
    async handleLogin(username, password, remember = false) {
        try {
            this.showLoading(true);
            
            // Attempt login
            const result = await Auth.login(username, password, remember);
            
            if (result.success) {
                console.log('Login successful');
                
                // Initialize the main application
                await this.initializeApp();
                
                return { success: true };
            } else {
                this.showError(result.message || 'Login failed');
                return { success: false, message: result.message };
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showError(error.message || 'Login failed');
            return { success: false, message: error.message };
        } finally {
            this.showLoading(false);
        }
    },
    
    // Show login page
    showLoginPage() {
        // Hide main app elements
        DOM.hide('mainNav');
        DOM.hide('sidebar');
        DOM.hide('mainContent');
        
        // Show login page
        DOM.show('loginPage');
        
        // Clear any error states
        this.clearMessages();
        
        // Focus on username field
        const usernameField = DOM.get('loginUsername');
        if (usernameField) {
            setTimeout(() => usernameField.focus(), 100);
        }
        
        // Initialize login form if not already done
        this.initializeLoginForm();
        
        // Check for remembered credentials
        this.checkRememberedCredentials();
        
        console.log('Showing login page');
    },
    
    // Initialize login form
    initializeLoginForm() {
        const loginForm = DOM.get('loginForm');
        if (!loginForm || loginForm.dataset.initialized === 'true') {
            return;
        }
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = DOM.getValue('loginUsername');
            const password = DOM.getValue('loginPassword');
            const remember = DOM.isChecked('rememberMe');
            
            if (!username || !password) {
                this.showError('Please enter both username and password');
                return;
            }
            
            await this.handleLogin(username, password, remember);
        });
        
        loginForm.dataset.initialized = 'true';
    },
    
    // Check for remembered credentials
    checkRememberedCredentials() {
        const rememberMe = localStorage.getItem('rememberMe') === 'true';
        const rememberedUsername = localStorage.getItem('rememberedUsername');
        
        if (rememberMe && rememberedUsername) {
            DOM.setValue('loginUsername', rememberedUsername);
            DOM.setChecked('rememberMe', true);
        }
    },
    
    // Update navigation with user info
    updateNavigation() {
    const user = this.currentUser;
    if (!user) return;
    
    // Update user name in simplified navigation
    DOM.setText('userNameDisplay', user.name || 'User');
    
    // Log the user info for debugging
    console.log('Updated navigation for user:', user.name, 'Role:', user.role);
    },
    
    // Update UI based on user role
    updateUIForRole(role) {
        console.log('Updating UI for role:', role);
        
        // Show/hide elements based on role
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
    
    // Handle project updates
    handleProjectUpdate(data) {
        console.log('Project update received:', data);
        
        // Refresh projects component if visible
        if (typeof ProjectsComponent !== 'undefined' && 
            this.currentRoute && this.currentRoute.includes('/projects')) {
            ProjectsComponent.handleUpdate(data);
        }
        
        // Update dashboard if visible
        if (typeof DashboardComponent !== 'undefined' && 
            this.currentRoute === '/dashboard') {
            DashboardComponent.handleProjectUpdate(data);
        }
    },
    
    // Handle bid updates
    handleBidUpdate(data) {
        console.log('Bid update received:', data);
        
        // Refresh bids component if visible
        if (typeof BidsComponent !== 'undefined' && 
            this.currentRoute && this.currentRoute.includes('/bids')) {
            BidsComponent.handleUpdate(data);
        }
        
        // Update dashboard if visible
        if (typeof DashboardComponent !== 'undefined' && 
            this.currentRoute === '/dashboard') {
            DashboardComponent.handleBidUpdate(data);
        }
    },
    
    // Handle user updates
    handleUserUpdate(data) {
        console.log('User update received:', data);
        
        // If it's an update for the current user, refresh user data
        if (data.userId === this.currentUser?.id) {
            Auth.getCurrentUser().then(user => {
                if (user) {
                    this.currentUser = user;
                    State.setUser(user);
                    this.updateNavigation();
                }
            });
        }
        
        // Refresh users component if visible
        if (typeof UsersComponent !== 'undefined' && 
            this.currentRoute && this.currentRoute.includes('/users')) {
            UsersComponent.handleUpdate(data);
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
    
    // Show error message
    showError(message) {
        console.error('Error:', message);
        if (typeof Toast !== 'undefined') {
            Toast.show(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    },
    
    // Show success message
    showSuccess(message) {
        console.log('Success:', message);
        if (typeof Toast !== 'undefined') {
            Toast.show(message, 'success');
        }
    },
    
    // Show toast notification
    showToast(title, message, type = 'info') {
        if (typeof Toast !== 'undefined') {
            Toast.show(`${title}: ${message}`, type);
        }
    },
    
    // Clear all messages
    clearMessages() {
        // Clear any existing error/success messages
        const errorAlerts = document.querySelectorAll('.alert-danger');
        const successAlerts = document.querySelectorAll('.alert-success');
        
        [...errorAlerts, ...successAlerts].forEach(alert => {
            alert.remove();
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle page visibility changes (for socket reconnection)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && App.initialized && App.socket && !App.socket.connected) {
        console.log('Page became visible, reconnecting socket...');
        App.socket.connect();
    }
});