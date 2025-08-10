// Capital Choice Platform - Frontend Router
// Fixed version with proper state handling

const Router = {
    // Routes configuration
    routes: {
        '/': 'dashboard',
        '/dashboard': 'dashboard',
        '/projects': 'projects',
        '/projects/:id': 'projectDetail',
        '/bids': 'bids',
        '/bids/:id': 'bidDetail',
        '/users': 'users',
        '/users/:id': 'userDetail',
        '/profile': 'profile',
        '/settings': 'settings',
        '/notifications': 'notifications',
        '/reports': 'reports',
        '/ratings': 'ratings',
        '/help': 'help',
        '/404': 'notFound'
    },
    
    // Current route
    currentRoute: null,
    currentParams: {},
    
    // Route handlers
    handlers: {},
    
    // Initialize router
    init() {
        console.log('Initializing router...');
        
        // Register route handlers
        this.registerHandlers();
        
        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
        
        // Listen for popstate (browser back/forward)
        window.addEventListener('popstate', () => {
            this.handleRouteChange();
        });
        
        // Handle initial route
        this.handleRouteChange();
    },
    
    // Register route handlers
    registerHandlers() {
        this.handlers = {
            dashboard: () => {
                if (typeof DashboardComponent !== 'undefined') {
                    DashboardComponent.render();
                } else {
                    console.warn('DashboardComponent not loaded');
                    this.renderPlaceholder('Dashboard');
                }
            },
            projects: () => {
                if (typeof ProjectsComponent !== 'undefined') {
                    ProjectsComponent.render();
                } else {
                    console.warn('ProjectsComponent not loaded');
                    this.renderPlaceholder('Projects');
                }
            },
            projectDetail: (params) => {
                if (typeof ProjectsComponent !== 'undefined') {
                    ProjectsComponent.renderDetail(params.id);
                } else {
                    this.renderPlaceholder('Project Details');
                }
            },
            bids: () => {
                if (typeof BidsComponent !== 'undefined') {
                    BidsComponent.render();
                } else {
                    this.renderPlaceholder('Bids');
                }
            },
            bidDetail: (params) => {
                if (typeof BidsComponent !== 'undefined') {
                    BidsComponent.renderDetail(params.id);
                } else {
                    this.renderPlaceholder('Bid Details');
                }
            },
            users: () => {
                if (typeof UsersComponent !== 'undefined') {
                    UsersComponent.render();
                } else {
                    this.renderPlaceholder('Users');
                }
            },
            userDetail: (params) => {
                if (typeof UsersComponent !== 'undefined') {
                    UsersComponent.renderDetail(params.id);
                } else {
                    this.renderPlaceholder('User Details');
                }
            },
            profile: () => {
                if (typeof ProfileComponent !== 'undefined') {
                    ProfileComponent.render();
                } else {
                    this.renderPlaceholder('Profile');
                }
            },
            settings: () => this.renderSettings(),
            notifications: () => {
                if (typeof NotificationsComponent !== 'undefined') {
                    NotificationsComponent.render();
                } else {
                    this.renderPlaceholder('Notifications');
                }
            },
            reports: () => this.renderReports(),
            ratings: () => this.renderRatings(),
            help: () => this.renderHelp(),
            notFound: () => this.render404()
        };
    },
    
    // Handle route change
    handleRouteChange() {
        const hash = window.location.hash || '#/dashboard';
        const path = hash.substring(1); // Remove #
        
        this.navigate(path, false);
    },
    
    // Navigate to route
    navigate(path, updateHistory = true) {
        console.log('Navigating to:', path);
        
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        // Find matching route
        const routeData = this.matchRoute(path);
        
        if (!routeData) {
            // Route not found
            console.warn('Route not found:', path);
            this.navigate('/404', false);
            return;
        }
        
        const { route, params } = routeData;
        
        // Check if route requires authentication
        if (!Auth.isAuthenticated() && route !== '/login') {
            console.warn('Not authenticated, redirecting to login');
            window.location.href = '/';
            return;
        }
        
        // Check route permissions
        if (!this.checkRoutePermissions(route)) {
            this.navigate('/dashboard', false);
            if (typeof App !== 'undefined' && App.showError) {
                App.showError('You do not have permission to access this page');
            }
            return;
        }
        
        // Update current route
        this.currentRoute = route;
        this.currentParams = params;
        
        // Update URL if needed
        if (updateHistory) {
            window.location.hash = path;
        }
        
        // Update UI
        this.updateUI(route, path);
        
        // Call route handler
        const handlerName = this.routes[route];
        const handler = this.handlers[handlerName];
        
        if (handler) {
            try {
                handler(params);
            } catch (error) {
                console.error('Route handler error:', error);
                this.render404();
            }
        } else {
            console.error('No handler for route:', route);
            this.render404();
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Track navigation
        this.trackNavigation(path);
    },
    
    // Match route pattern
    matchRoute(path) {
        // Try exact match first
        if (this.routes[path]) {
            return { route: path, params: {} };
        }
        
        // Try pattern matching
        for (const pattern in this.routes) {
            const regex = this.patternToRegex(pattern);
            const match = path.match(regex);
            
            if (match) {
                // Extract params
                const params = this.extractParams(pattern, path);
                return { route: pattern, params };
            }
        }
        
        return null;
    },
    
    // Convert route pattern to regex
    patternToRegex(pattern) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const withParams = escaped.replace(/:(\w+)/g, '([^/]+)');
        return new RegExp('^' + withParams + '$');
    },
    
    // Extract params from path
    extractParams(pattern, path) {
        const params = {};
        const patternParts = pattern.split('/');
        const pathParts = path.split('/');
        
        patternParts.forEach((part, index) => {
            if (part.startsWith(':')) {
                const paramName = part.substring(1);
                params[paramName] = pathParts[index];
            }
        });
        
        return params;
    },
    
    // Check route permissions
    checkRoutePermissions(route) {
        const userRole = Auth.getUserRole();
        
        // Admin-only routes
        const adminRoutes = ['/users'];
        if (adminRoutes.includes(route) && userRole !== 'admin') {
            return false;
        }
        
        // Project manager routes
        const pmRoutes = ['/ratings'];
        if (pmRoutes.includes(route) && !['admin', 'project_manager'].includes(userRole)) {
            return false;
        }
        
        return true;
    },
    
    // Update UI for route
    updateUI(route, path) {
        // Update active nav items
        document.querySelectorAll('.nav-link, .menu-link').forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            if (linkRoute) {
                const isActive = path.startsWith('/' + linkRoute);
                link.classList.toggle('active', isActive);
            }
        });
        
        // Update page title
        const routeName = this.routes[route];
        const title = this.getPageTitle(routeName);
        
        if (DOM && DOM.setText) {
            DOM.setText('pageTitle', title);
        }
        document.title = `${title} - Capital Choice`;
        
        // Update breadcrumb
        this.updateBreadcrumb(route, path);
        
        // Update app state if App exists and is initialized
        if (typeof App !== 'undefined' && App.currentRoute !== undefined) {
            App.currentRoute = path;
        }
    },
    
    // Get page title
    getPageTitle(routeName) {
        const titles = {
            dashboard: 'Dashboard',
            projects: 'Projects',
            projectDetail: 'Project Details',
            bids: 'My Bids',
            bidDetail: 'Bid Details',
            users: 'Users',
            userDetail: 'User Details',
            profile: 'My Profile',
            settings: 'Settings',
            notifications: 'Notifications',
            reports: 'Reports',
            ratings: 'Ratings',
            help: 'Help & Support',
            notFound: 'Page Not Found'
        };
        
        return titles[routeName] || 'Capital Choice';
    },
    
    // Update breadcrumb
    updateBreadcrumb(route, path) {
        const breadcrumb = DOM.get('breadcrumb');
        const currentPage = DOM.get('currentPage');
        
        if (!breadcrumb || !currentPage) return;
        
        // Build breadcrumb trail
        const parts = path.split('/').filter(p => p);
        let breadcrumbHtml = '<li class="breadcrumb-item"><a href="#/dashboard">Home</a></li>';
        
        if (parts.length > 0) {
            parts.forEach((part, index) => {
                const isLast = index === parts.length - 1;
                const partPath = '/' + parts.slice(0, index + 1).join('/');
                const partTitle = this.formatBreadcrumbPart(part);
                
                if (isLast) {
                    currentPage.textContent = partTitle;
                } else {
                    breadcrumbHtml += `<li class="breadcrumb-item"><a href="#${partPath}">${partTitle}</a></li>`;
                }
            });
        } else {
            currentPage.textContent = 'Dashboard';
        }
        
        const breadcrumbList = breadcrumb.querySelector('.breadcrumb-list');
        if (breadcrumbList) {
            breadcrumbList.innerHTML = breadcrumbHtml + 
                `<li class="breadcrumb-item active">${currentPage.textContent}</li>`;
        }
    },
    
    // Format breadcrumb part
    formatBreadcrumbPart(part) {
        // Handle special cases
        if (part === 'bids') return 'Bids';
        if (part === 'users') return 'Users';
        if (part === 'projects') return 'Projects';
        
        // Capitalize first letter
        return part.charAt(0).toUpperCase() + part.slice(1);
    },
    
    // Track navigation (analytics)
    trackNavigation(path) {
        // Log navigation
        if (typeof Config !== 'undefined' && Config.log) {
            Config.log('Navigation:', path);
        }
        
        // Send to analytics if configured
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                page_path: path
            });
        }
    },
    
    // Render placeholder for components not yet loaded
    renderPlaceholder(componentName) {
        const content = `
            <div class="card">
                <div class="card-body">
                    <div class="text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="sr-only">Loading...</span>
                        </div>
                        <p>Loading ${componentName}...</p>
                    </div>
                </div>
            </div>
        `;
        
        if (DOM && DOM.setHTML) {
            DOM.setHTML('pageContent', content);
        }
    },
    
    // Helper methods
    back() {
        window.history.back();
    },
    
    forward() {
        window.history.forward();
    },
    
    reload() {
        this.handleRouteChange();
    },
    
    getParam(name) {
        return this.currentParams[name];
    },
    
    getQueryParams() {
        const hash = window.location.hash;
        const queryIndex = hash.indexOf('?');
        
        if (queryIndex === -1) {
            return {};
        }
        
        const queryString = hash.substring(queryIndex + 1);
        const params = new URLSearchParams(queryString);
        const result = {};
        
        for (const [key, value] of params) {
            result[key] = value;
        }
        
        return result;
    },
    
    // Render methods for simple pages
    renderSettings() {
        const content = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Settings</h3>
                </div>
                <div class="card-body">
                    <p>Settings page coming soon...</p>
                </div>
            </div>
        `;
        
        if (DOM && DOM.setHTML) {
            DOM.setHTML('pageContent', content);
        }
    },
    
    renderReports() {
        const content = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Reports</h3>
                </div>
                <div class="card-body">
                    <p>Reports page coming soon...</p>
                </div>
            </div>
        `;
        
        if (DOM && DOM.setHTML) {
            DOM.setHTML('pageContent', content);
        }
    },
    
    renderRatings() {
        const content = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Ratings</h3>
                </div>
                <div class="card-body">
                    <p>Ratings page coming soon...</p>
                </div>
            </div>
        `;
        
        if (DOM && DOM.setHTML) {
            DOM.setHTML('pageContent', content);
        }
    },
    
    renderHelp() {
        const content = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Help & Support</h3>
                </div>
                <div class="card-body">
                    <p>Need help? Contact us at support@capitalchoice.com</p>
                </div>
            </div>
        `;
        
        if (DOM && DOM.setHTML) {
            DOM.setHTML('pageContent', content);
        }
    },
    
    render404() {
        const content = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 class="empty-state-title">Page Not Found</h2>
                <p class="empty-state-description">
                    The page you're looking for doesn't exist or you don't have permission to access it.
                </p>
                <button class="btn btn-primary" onclick="Router.navigate('/dashboard')">
                    Go to Dashboard
                </button>
            </div>
        `;
        
        if (DOM && DOM.setHTML) {
            DOM.setHTML('pageContent', content);
        }
    }
};

// Make Router globally available
window.Router = Router;