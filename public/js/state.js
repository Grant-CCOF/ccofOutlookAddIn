// Capital Choice Platform - State Management

const State = {
    // Application state
    data: {
        user: null,
        projects: [],
        bids: [],
        notifications: [],
        users: [],
        socket: null,
        filters: {
            projects: {},
            bids: {},
            users: {}
        },
        cache: new Map(),
        ui: {
            sidebarCollapsed: false,
            theme: 'light',
            notificationsOpen: false,
            modalOpen: false,
            loading: false
        }
    },
    
    // State observers
    observers: new Map(),
    
    // Get state value
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.data;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    },
    
    // Set state value
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let obj = this.data;
        
        for (const key of keys) {
            if (!(key in obj) || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }
        
        const oldValue = obj[lastKey];
        obj[lastKey] = value;
        
        // Notify observers
        this.notifyObservers(path, value, oldValue);
        
        // Persist certain state values
        this.persistState(path, value);
    },
    
    // Update state (merge)
    update(path, updates) {
        const current = this.get(path, {});
        const merged = { ...current, ...updates };
        this.set(path, merged);
    },
    
    // Push to array
    push(path, item) {
        const array = this.get(path, []);
        array.push(item);
        this.set(path, array);
    },
    
    // Remove from array
    remove(path, predicate) {
        const array = this.get(path, []);
        const filtered = array.filter(item => !predicate(item));
        this.set(path, filtered);
    },
    
    // Subscribe to state changes
    subscribe(path, callback) {
        if (!this.observers.has(path)) {
            this.observers.set(path, new Set());
        }
        
        this.observers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const observers = this.observers.get(path);
            if (observers) {
                observers.delete(callback);
            }
        };
    },
    
    // Notify observers
    notifyObservers(path, newValue, oldValue) {
        // Notify direct observers
        const observers = this.observers.get(path);
        if (observers) {
            observers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    Config.error('Observer error:', error);
                }
            });
        }
        
        // Notify parent path observers
        const parentPath = path.split('.').slice(0, -1).join('.');
        if (parentPath) {
            this.notifyObservers(parentPath, this.get(parentPath), null);
        }
    },
    
    // Persist state to localStorage
    persistState(path, value) {
        const persistPaths = [
            'ui.theme',
            'ui.sidebarCollapsed',
            'filters'
        ];
        
        if (persistPaths.some(p => path.startsWith(p))) {
            try {
                localStorage.setItem(`state.${path}`, JSON.stringify(value));
            } catch (error) {
                Config.error('Failed to persist state:', error);
            }
        }
    },
    
    // Load persisted state
    loadPersistedState() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('state.'));
        
        keys.forEach(key => {
            try {
                const path = key.substring(6); // Remove 'state.' prefix
                const value = JSON.parse(localStorage.getItem(key));
                this.set(path, value);
            } catch (error) {
                Config.error('Failed to load persisted state:', error);
            }
        });
    },
    
    // Cache management
    cache: {
        set(key, value, ttl = 5 * 60 * 1000) { // Default 5 minutes
            State.data.cache.set(key, {
                value,
                expires: Date.now() + ttl
            });
        },
        
        get(key) {
            const cached = State.data.cache.get(key);
            
            if (!cached) {
                return null;
            }
            
            if (Date.now() > cached.expires) {
                State.data.cache.delete(key);
                return null;
            }
            
            return cached.value;
        },
        
        delete(key) {
            State.data.cache.delete(key);
        },
        
        clear() {
            State.data.cache.clear();
        },
        
        has(key) {
            const cached = State.data.cache.get(key);
            return cached && Date.now() <= cached.expires;
        }
    },
    
    // User state helpers
    setUser(user) {
        this.set('user', user);
    },
    
    getUser() {
        return this.get('user');
    },
    
    getUserId() {
        const user = this.getUser();
        return user ? user.id : null;
    },
    
    getUserRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },
    
    // Socket state
    setSocket(socket) {
        this.set('socket', socket);
    },
    
    getSocket() {
        return this.get('socket');
    },
    
    // Projects state
    setProjects(projects) {
        this.set('projects', projects);
    },
    
    getProjects() {
        return this.get('projects', []);
    },
    
    getProjectById(id) {
        const projects = this.getProjects();
        return projects.find(p => p.id === parseInt(id));
    },
    
    updateProject(id, updates) {
        const projects = this.getProjects();
        const index = projects.findIndex(p => p.id === parseInt(id));
        
        if (index !== -1) {
            projects[index] = { ...projects[index], ...updates };
            this.set('projects', [...projects]);
        }
    },
    
    // Bids state
    setBids(bids) {
        this.set('bids', bids);
    },
    
    getBids() {
        return this.get('bids', []);
    },
    
    getBidById(id) {
        const bids = this.getBids();
        return bids.find(b => b.id === parseInt(id));
    },
    
    // Notifications state
    setNotifications(notifications) {
        this.set('notifications', notifications);
    },
    
    getNotifications() {
        return this.get('notifications', []);
    },
    
    addNotification(notification) {
        this.push('notifications', notification);
    },
    
    markNotificationRead(id) {
        const notifications = this.getNotifications();
        const index = notifications.findIndex(n => n.id === id);
        
        if (index !== -1) {
            notifications[index].read = true;
            this.set('notifications', [...notifications]);
        }
    },
    
    // UI state helpers
    setTheme(theme) {
        this.set('ui.theme', theme);
        document.body.setAttribute('data-theme', theme);
    },
    
    getTheme() {
        return this.get('ui.theme', 'light');
    },
    
    toggleSidebar() {
        const collapsed = !this.get('ui.sidebarCollapsed', false);
        this.set('ui.sidebarCollapsed', collapsed);
        document.body.classList.toggle('sidebar-collapsed', collapsed);
    },
    
    setLoading(loading) {
        this.set('ui.loading', loading);
    },
    
    isLoading() {
        return this.get('ui.loading', false);
    },
    
    // Filter state
    setFilter(type, filters) {
        this.set(`filters.${type}`, filters);
    },
    
    getFilter(type) {
        return this.get(`filters.${type}`, {});
    },
    
    updateFilter(type, key, value) {
        const filters = this.getFilter(type);
        filters[key] = value;
        this.setFilter(type, filters);
    },
    
    clearFilter(type) {
        this.set(`filters.${type}`, {});
    },
    
    // Reset state
    reset() {
        // Preserve UI state
        const uiState = this.get('ui');
        
        // Reset data
        this.data = {
            user: null,
            projects: [],
            bids: [],
            notifications: [],
            users: [],
            socket: null,
            filters: {
                projects: {},
                bids: {},
                users: {}
            },
            cache: new Map(),
            ui: uiState
        };
        
        // Clear cache
        this.cache.clear();
    },
    
    // Debug helpers
    debug() {
        console.log('Current State:', this.data);
    },
    
    export() {
        return JSON.stringify(this.data, null, 2);
    },
    
    import(stateJson) {
        try {
            const imported = JSON.parse(stateJson);
            this.data = imported;
            Config.log('State imported successfully');
        } catch (error) {
            Config.error('Failed to import state:', error);
        }
    }
};

// Initialize persisted state
State.loadPersistedState();

// Export for global access
window.State = State;