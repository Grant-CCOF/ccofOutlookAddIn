// Capital Choice Platform - API Service

const API = {
    // Make GET request
    async get(endpoint, params = {}) {
        const url = new URL(Config.API_BASE_URL + endpoint);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return this.request('GET', url.toString());
    },
    
    // Make POST request
    async post(endpoint, data = {}) {
        return this.request('POST', Config.API_BASE_URL + endpoint, data);
    },
    
    // Make PUT request
    async put(endpoint, data = {}) {
        return this.request('PUT', Config.API_BASE_URL + endpoint, data);
    },
    
    // Make PATCH request
    async patch(endpoint, data = {}) {
        return this.request('PATCH', Config.API_BASE_URL + endpoint, data);
    },
    
    // Make DELETE request
    async delete(endpoint) {
        return this.request('DELETE', Config.API_BASE_URL + endpoint);
    },
    
    // Upload file
    async upload(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional data to form
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });
        
        return this.request('POST', Config.API_BASE_URL + endpoint, formData, {
            'Content-Type': 'multipart/form-data'
        });
    },
    
    // Upload multiple files
    async uploadMultiple(endpoint, files, additionalData = {}) {
        const formData = new FormData();
        
        // Add files to form
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });
        
        // Add additional data to form
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });
        
        return this.request('POST', Config.API_BASE_URL + endpoint, formData, {
            'Content-Type': 'multipart/form-data'
        });
    },
    
    // Base request method
    async request(method, url, data = null, customHeaders = {}) {
        const headers = {
            ...this.getDefaultHeaders(),
            ...customHeaders
        };
        
        // Don't set Content-Type for FormData
        if (data instanceof FormData) {
            delete headers['Content-Type'];
        }
        
        const options = {
            method,
            headers,
            credentials: 'same-origin'
        };
        
        // Add body for non-GET requests
        if (data && method !== 'GET') {
            if (data instanceof FormData) {
                options.body = data;
            } else {
                options.body = JSON.stringify(data);
            }
        }
        
        try {
            // Add timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), Config.API_TIMEOUT);
            options.signal = controller.signal;
            
            const response = await fetch(url, options);
            clearTimeout(timeoutId);
            
            // Handle response
            return this.handleResponse(response);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            
            Config.error('API request failed:', error);
            throw error;
        }
    },
    
    // Get default headers
    getDefaultHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // Add auth token if available
        const token = Auth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    },
    
    // Handle API response
    async handleResponse(response) {
        // Check if response is ok
        if (!response.ok) {
            // Handle specific error codes
            if (response.status === 401) {
                // Unauthorized - try to refresh token
                const refreshed = await Auth.refreshToken();
                if (!refreshed) {
                    // Redirect to login
                    Auth.logout();
                    throw new Error('Session expired');
                }
                
                // Retry the request (implement retry logic)
                throw new Error('Token refreshed, please retry');
            }
            
            if (response.status === 403) {
                throw new Error('Access denied');
            }
            
            if (response.status === 404) {
                throw new Error('Resource not found');
            }
            
            if (response.status === 429) {
                throw new Error('Too many requests. Please try again later.');
            }
            
            if (response.status >= 500) {
                throw new Error('Server error. Please try again later.');
            }
            
            // Try to get error message from response
            try {
                const errorData = await response.json();
                // Check for different error message formats
                const errorMessage = errorData.error || 
                                errorData.message || 
                                errorData.error?.message || 
                                'Request failed';
                throw new Error(errorMessage);
            } catch (parseError) {
                // If we can't parse the error, throw a generic one
                throw new Error(`Request failed with status ${response.status}`);
            }
        }
        
        // Parse response
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        
        // Return text for non-JSON responses
        return response.text();
    },
    
    // Paginated request helper
    async getPaginated(endpoint, page = 1, limit = Config.DEFAULT_PAGE_SIZE, additionalParams = {}) {
        const params = {
            page,
            limit,
            ...additionalParams
        };
        
        const response = await this.get(endpoint, params);
        
        // Standardize paginated response
        return {
            data: response.data || response.items || response.results || [],
            total: response.total || response.totalCount || 0,
            page: response.page || response.currentPage || page,
            limit: response.limit || response.pageSize || limit,
            totalPages: response.totalPages || Math.ceil((response.total || 0) / limit),
            hasNext: response.hasNext || false,
            hasPrev: response.hasPrev || false
        };
    },
    
    // Batch request helper
    async batch(requests) {
        const promises = requests.map(req => {
            const { method, endpoint, data } = req;
            
            switch (method.toUpperCase()) {
                case 'GET':
                    return this.get(endpoint, data);
                case 'POST':
                    return this.post(endpoint, data);
                case 'PUT':
                    return this.put(endpoint, data);
                case 'DELETE':
                    return this.delete(endpoint);
                default:
                    return Promise.reject(new Error(`Unknown method: ${method}`));
            }
        });
        
        return Promise.all(promises);
    },
    
    // Retry helper
    async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries === 0) {
                throw error;
            }
            
            Config.log(`Retrying request... (${retries} attempts remaining)`);
            await this.sleep(delay);
            return this.retry(fn, retries - 1, delay * 2);
        }
    },
    
    // Sleep helper
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Cancel all pending requests
    cancelAll() {
        // Implementation depends on how we track requests
        Config.log('Cancelling all pending requests');
    },

    // Request registration (send email)
    async requestRegistration(email) {
        return this.request('/api/auth/request-registration', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },

    // Verify registration code
    async verifyRegistrationCode(token, code) {
        return this.request('/api/auth/verify-registration-code', {
            method: 'POST',
            body: JSON.stringify({ token, code })
        });
    },

    // Complete registration
    async completeRegistration(data) {
        return this.request('/api/auth/complete-registration', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // Validate registration token
    async validateRegistrationToken(token) {
        return this.request(`/api/auth/validate-registration-token?token=${encodeURIComponent(token)}`);
    }
};

// API endpoint shortcuts
API.auth = {
    login: (username, password) => API.post('/auth/login', { username, password }),
    logout: () => API.post('/auth/logout'),
    register: (data) => API.post('/auth/register', data),
    refresh: (refreshToken) => API.post('/auth/refresh', { refreshToken }),
    me: () => API.get('/auth/me'),
    changePassword: (currentPassword, newPassword) => 
        API.post('/auth/change-password', { currentPassword, newPassword }),
    forgotPassword: (email) => API.post('/auth/forgot-password', { email }),
    verifyResetCode: (token, code) => 
        API.post('/auth/verify-reset-code', { token, code }),
    resetPassword: (tempToken, newPassword) => 
        API.post('/auth/reset-password', { tempToken, newPassword })
};

API.projects = {
    getAll: (params) => API.get('/projects', params),
    getById: (id) => API.get(`/projects/${id}`),
    create: (data) => API.post('/projects', data),
    update: (id, data) => API.put(`/projects/${id}`, data),
    delete: (id) => API.delete(`/projects/${id}`),
    startBidding: (id) => API.post(`/projects/${id}/start-bidding`),
    award: (id, data) => API.post(`/projects/${id}/award`, { 
        bidId: parseInt(data.bidId, 10),
        comment: data.comment || ""  // Add comment support
    }),
    complete: (id) => API.post(`/projects/${id}/complete`)
};

API.bids = {
    getAll: (params) => API.get('/bids', params),
    getMyBids: (params) => API.get('/bids/my-bids', params),
    getById: (id) => API.get(`/bids/${id}`),
    getProjectBids: (projectId) => API.get(`/bids/project/${projectId}`),
    submit: (data) => API.post('/bids', data),
    update: (id, data) => API.put(`/bids/${id}`, data),
    withdraw: (id) => API.delete(`/bids/${id}`)
};

API.users = {
    getAll: (params) => API.get('/users', params),
    getById: (id) => API.get(`/users/${id}`),
    create: (data) => API.post('/users/create', data),
    update: (id, data) => API.put(`/users/${id}`, data),
    delete: (id) => API.delete(`/users/${id}`),
    approve: (id) => API.post(`/users/${id}/approve`),
    suspend: (id, reason) => API.post(`/users/${id}/suspend`, { reason }),
    unsuspend: (id) => API.post(`/users/${id}/unsuspend`),
    changeRole: (id, role) => API.post(`/users/${id}/change-role`, { role }),
    getStats: (id) => API.get(`/users/${id}/stats`)
};

API.notifications = {
    getAll: (params) => API.get('/notifications', params),
    getById: (id) => API.get(`/notifications/${id}`),
    markAsRead: (id) => API.put(`/notifications/${id}/read`),
    markAllAsRead: () => API.put('/notifications/read-all'),
    delete: (id) => API.delete(`/notifications/${id}`),
    clearAll: () => API.delete('/notifications/clear-all'),
    getUnreadCount: () => API.get('/notifications/count/unread')
};

API.files = {
    upload: (file, data) => API.upload('/files/upload', file, data),
    uploadMultiple: (files, data) => API.uploadMultiple('/files/multiple', files, data),
    getById: (id) => API.get(`/files/${id}`),
    getDownloadUrl: (id) => `${Config.API_BASE_URL}/files/${id}/download`,
    download: async (id, filename) => {
        try {
            const response = await fetch(`${Config.API_BASE_URL}/files/${id}/download`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Download failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    },
    delete: (id) => API.delete(`/files/${id}`),
    getProjectFiles: (projectId) => API.get(`/files/project/${projectId}/list`),
    getBidFiles: (bidId) => API.get(`/files/bid/${bidId}/list`),
    uploadCertification: (file, description) => {
        const formData = new FormData();
        formData.append('file', file);
        if (description) {
            formData.append('description', description);
        }
        return API.upload('/files/certification', file, { description });
    },
    getUserCertifications: (userId) => API.get(`/files/user/${userId}/certifications`),
    deleteCertification: (id) => API.delete(`/files/certification/${id}`)
};

API.ratings = {
    getUserRatings: (userId) => API.get(`/ratings/user/${userId}`),
    getProjectRatings: (projectId) => API.get(`/ratings/project/${projectId}`),
    submit: (data) => API.post('/ratings', data),
    getUserSummary: (userId) => API.get(`/ratings/user/${userId}/summary`),
    delete: (id) => API.delete(`/ratings/${id}`)
};

API.dashboard = {
    getData: () => API.get('/dashboard'),
    getChart: (type, params) => API.get(`/dashboard/charts/${type}`, params)
};

API.reports = {
    generate: (type, params) => API.post(`/reports/${type}`, params),
    download: (id) => `${Config.API_BASE_URL}/reports/${id}/download`,
    getAll: () => API.get('/reports'),
    delete: (id) => API.delete(`/reports/${id}`)
};

API.upload = async function(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional data
    Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
    });
    
    const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
    }
    
    return response.json();
};

API.uploadMultiple = async function(endpoint, files, additionalData = {}) {
    const formData = new FormData();
    
    // Add all files
    files.forEach(file => {
        formData.append('files', file);
    });
    
    // Add additional data
    Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
    });
    
    const response = await fetch(`${Config.API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${Auth.getToken()}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
    }
    
    return response.json();
};