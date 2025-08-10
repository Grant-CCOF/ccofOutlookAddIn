// Capital Choice Platform - Authentication Service

const Auth = {
    // Login user
    async login(username, password, remember = false) {
        try {
            const response = await API.auth.login(username, password);
            
            if (response.token) {
                // Store tokens
                this.setToken(response.token);
                this.setRefreshToken(response.refreshToken);
                
                // Store user data
                if (response.user) {
                    this.setUser(response.user);
                }
                
                // Handle remember me
                if (remember) {
                    localStorage.setItem('rememberMe', 'true');
                    localStorage.setItem('rememberedUsername', username);
                } else {
                    sessionStorage.setItem('sessionActive', 'true');
                }
                
                return { success: true, user: response.user };
            }
            
            return { success: false, message: response.error || 'Login failed' };
        } catch (error) {
            Config.error('Login error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Logout user
    async logout() {
        try {
            // Call logout endpoint
            await API.auth.logout().catch(() => {});
            
            // Clear local storage
            this.clearAuth();
            
            // Redirect to login
            window.location.href = '/';
        } catch (error) {
            Config.error('Logout error:', error);
            // Clear auth anyway
            this.clearAuth();
            window.location.href = '/';
        }
    },
    
    // Register new user
    async register(userData) {
        try {
            const response = await API.auth.register(userData);
            
            if (response.userId) {
                return { success: true, message: response.message };
            }
            
            return { success: false, message: response.error || 'Registration failed' };
        } catch (error) {
            Config.error('Registration error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Get current user
    async getCurrentUser() {
        try {
            // Check if we have a stored user
            const storedUser = this.getUser();
            if (storedUser) {
                return storedUser;
            }
            
            // Fetch from API
            const user = await API.auth.me();
            if (user) {
                this.setUser(user);
                return user;
            }
            
            return null;
        } catch (error) {
            Config.error('Get current user error:', error);
            return null;
        }
    },
    
    // Refresh auth token
    async refreshToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
                return false;
            }
            
            const response = await API.auth.refresh(refreshToken);
            
            if (response.token) {
                this.setToken(response.token);
                this.setRefreshToken(response.refreshToken);
                return true;
            }
            
            return false;
        } catch (error) {
            Config.error('Token refresh error:', error);
            return false;
        }
    },
    
    // Check if user is authenticated
    isAuthenticated() {
        const token = this.getToken();
        if (!token) {
            return false;
        }
        
        // Check if token is expired
        if (this.isTokenExpired(token)) {
            // Try to refresh
            this.refreshToken();
            return false;
        }
        
        return true;
    },
    
    // Check if token is expired
    isTokenExpired(token) {
        try {
            const payload = this.parseJWT(token);
            if (!payload || !payload.exp) {
                return true;
            }
            
            // Check if expired (with 5 minute buffer)
            const expirationTime = payload.exp * 1000;
            const currentTime = Date.now();
            const buffer = 5 * 60 * 1000; // 5 minutes
            
            return currentTime > (expirationTime - buffer);
        } catch (error) {
            return true;
        }
    },
    
    // Parse JWT token
    parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            Config.error('Failed to parse JWT:', error);
            return null;
        }
    },
    
    // Get user role
    getUserRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },
    
    // Check if user has role
    hasRole(role) {
        const userRole = this.getUserRole();
        
        if (Array.isArray(role)) {
            return role.includes(userRole);
        }
        
        return userRole === role;
    },
    
    // Check if user is admin
    isAdmin() {
        return this.hasRole('admin');
    },
    
    // Check if user is project manager
    isProjectManager() {
        return this.hasRole('project_manager');
    },
    
    // Check if user is contractor
    isContractor() {
        return this.hasRole(['installation_company', 'operations']);
    },
    
    // Storage methods
    getToken() {
        return localStorage.getItem(Config.TOKEN_KEY) || 
               sessionStorage.getItem(Config.TOKEN_KEY);
    },
    
    setToken(token) {
        if (localStorage.getItem('rememberMe') === 'true') {
            localStorage.setItem(Config.TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(Config.TOKEN_KEY, token);
        }
    },
    
    getRefreshToken() {
        return localStorage.getItem(Config.REFRESH_TOKEN_KEY) || 
               sessionStorage.getItem(Config.REFRESH_TOKEN_KEY);
    },
    
    setRefreshToken(token) {
        if (localStorage.getItem('rememberMe') === 'true') {
            localStorage.setItem(Config.REFRESH_TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(Config.REFRESH_TOKEN_KEY, token);
        }
    },
    
    getUser() {
        const userStr = localStorage.getItem(Config.USER_KEY) || 
                       sessionStorage.getItem(Config.USER_KEY);
        
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        
        return null;
    },
    
    setUser(user) {
        const userStr = JSON.stringify(user);
        
        if (localStorage.getItem('rememberMe') === 'true') {
            localStorage.setItem(Config.USER_KEY, userStr);
        } else {
            sessionStorage.setItem(Config.USER_KEY, userStr);
        }
    },
    
    clearAuth() {
        // Clear tokens
        localStorage.removeItem(Config.TOKEN_KEY);
        localStorage.removeItem(Config.REFRESH_TOKEN_KEY);
        localStorage.removeItem(Config.USER_KEY);
        sessionStorage.removeItem(Config.TOKEN_KEY);
        sessionStorage.removeItem(Config.REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(Config.USER_KEY);
        sessionStorage.removeItem('sessionActive');
        
        // Keep remember me preference
        // localStorage.removeItem('rememberMe');
        // localStorage.removeItem('rememberedUsername');
    },
    
    // Password management
    async changePassword(currentPassword, newPassword) {
        try {
            const response = await API.auth.changePassword(currentPassword, newPassword);
            return { success: true, message: response.message };
        } catch (error) {
            Config.error('Change password error:', error);
            return { success: false, message: error.message };
        }
    },
    
    async forgotPassword(email) {
        try {
            const response = await API.auth.forgotPassword(email);
            return { success: true, message: response.message };
        } catch (error) {
            Config.error('Forgot password error:', error);
            return { success: false, message: error.message };
        }
    },
    
    async resetPassword(token, newPassword) {
        try {
            const response = await API.auth.resetPassword(token, newPassword);
            return { success: true, message: response.message };
        } catch (error) {
            Config.error('Reset password error:', error);
            return { success: false, message: error.message };
        }
    },
    
    // Session management
    checkSession() {
        // Check if session is still valid
        if (!this.isAuthenticated()) {
            this.clearAuth();
            return false;
        }
        
        // Refresh token if needed
        const token = this.getToken();
        if (this.isTokenExpired(token)) {
            this.refreshToken();
        }
        
        return true;
    },
    
    // Initialize auth check interval
    initSessionCheck() {
        // Check session every 5 minutes
        setInterval(() => {
            this.checkSession();
        }, 5 * 60 * 1000);
        
        // Check on window focus
        window.addEventListener('focus', () => {
            this.checkSession();
        });
    }
};

// Initialize session check
Auth.initSessionCheck();