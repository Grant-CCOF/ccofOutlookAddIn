// Capital Choice Platform - Rating Modal

const RatingModal = {
    // Show rating modal for project completion
    showCompletionRatingModal(project, onSuccess) {
        const content = this.getRatingForm(project);
        const modalId = this.createModal('Complete Project & Rate Installer', content, {
            confirmText: 'Complete Project',
            size: 'medium'
        });
        
        // Initialize star ratings
        this.initializeStarRatings();
        
        // Handle form submission
        DOM.on('ratingForm', 'submit', async (e) => {
            e.preventDefault();
            await this.handleRatingSubmit(project.id, project.awarded_to, onSuccess);
        });
    },
    
    // Get rating form HTML
    getRatingForm(project) {
        return `
            <form id="ratingForm">
                <div class="rating-intro mb-4">
                    <p>Please rate the installer's performance for <strong>${project.title}</strong>.</p>
                    <p class="text-muted">Your feedback helps maintain quality standards on our platform.</p>
                </div>
                
                <div class="rating-categories">
                    <!-- Price/Value Rating -->
                    <div class="rating-category mb-3">
                        <label class="rating-label">Price/Value</label>
                        <div class="star-rating" data-rating="price">
                            ${this.renderStars('price')}
                        </div>
                        <small class="text-muted">Was the pricing fair and competitive?</small>
                    </div>
                    
                    <!-- Speed/Timeliness Rating -->
                    <div class="rating-category mb-3">
                        <label class="rating-label">Speed/Timeliness</label>
                        <div class="star-rating" data-rating="speed">
                            ${this.renderStars('speed')}
                        </div>
                        <small class="text-muted">Was the project completed on time?</small>
                    </div>
                    
                    <!-- Quality Rating -->
                    <div class="rating-category mb-3">
                        <label class="rating-label">Quality of Work</label>
                        <div class="star-rating" data-rating="quality">
                            ${this.renderStars('quality')}
                        </div>
                        <small class="text-muted">How was the quality of installation?</small>
                    </div>
                    
                    <!-- Responsiveness Rating -->
                    <div class="rating-category mb-3">
                        <label class="rating-label">Responsiveness</label>
                        <div class="star-rating" data-rating="responsiveness">
                            ${this.renderStars('responsiveness')}
                        </div>
                        <small class="text-muted">How responsive was the installer to communications?</small>
                    </div>
                    
                    <!-- Customer Satisfaction Rating -->
                    <div class="rating-category mb-3">
                        <label class="rating-label">Overall Satisfaction</label>
                        <div class="star-rating" data-rating="customer_satisfaction">
                            ${this.renderStars('customer_satisfaction')}
                        </div>
                        <small class="text-muted">Overall, how satisfied are you?</small>
                    </div>
                </div>
                
                <!-- Comments -->
                <div class="form-group mt-4">
                    <label>Additional Comments (Optional)</label>
                    <textarea class="form-control" 
                              name="comments" 
                              rows="3"
                              placeholder="Share any additional feedback about your experience..."></textarea>
                </div>
                
                <div class="alert alert-info mt-3">
                    <i class="fas fa-info-circle"></i>
                    Completing this project will finalize the transaction and notify the installer.
                </div>
            </form>
        `;
    },
    
    // Render star rating HTML
    renderStars(category) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `
                <i class="fas fa-star star-icon" 
                   data-category="${category}" 
                   data-value="${i}"
                   onclick="RatingModal.setRating('${category}', ${i})"></i>
            `;
        }
        return stars + `<input type="hidden" name="${category}" value="5" id="rating-${category}">`;
    },
    
    // Set rating value
    setRating(category, value) {
        // Update hidden input
        DOM.setValue(`rating-${category}`, value);
        
        // Update star display
        const stars = document.querySelectorAll(`[data-category="${category}"]`);
        stars.forEach((star, index) => {
            if (index < value) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    },
    
    // Initialize star ratings
    initializeStarRatings() {
        // Set default ratings to 5 stars
        ['price', 'speed', 'quality', 'responsiveness', 'customer_satisfaction'].forEach(category => {
            this.setRating(category, 5);
        });
        
        // Add hover effects
        document.querySelectorAll('.star-icon').forEach(star => {
            star.addEventListener('mouseenter', (e) => {
                const category = e.target.dataset.category;
                const value = parseInt(e.target.dataset.value);
                
                // Temporarily show hover state
                const stars = document.querySelectorAll(`[data-category="${category}"]`);
                stars.forEach((s, index) => {
                    if (index < value) {
                        s.classList.add('hover');
                    } else {
                        s.classList.remove('hover');
                    }
                });
            });
            
            star.addEventListener('mouseleave', (e) => {
                const category = e.target.dataset.category;
                // Remove hover state
                document.querySelectorAll(`[data-category="${category}"]`).forEach(s => {
                    s.classList.remove('hover');
                });
            });
        });
    },
    
    // Handle rating submission
    async handleRatingSubmit(projectId, awardedTo, onSuccess) {
        try {
            const formData = new FormData(DOM.get('ratingForm'));
            const rating = {
                price: parseInt(formData.get('price')),
                speed: parseInt(formData.get('speed')),
                quality: parseInt(formData.get('quality')),
                responsiveness: parseInt(formData.get('responsiveness')),
                customer_satisfaction: parseInt(formData.get('customer_satisfaction')),
                comments: formData.get('comments')
            };
            
            App.showLoading(true);
            
            // Complete project with rating
            await API.post(`/projects/${projectId}/complete`, { rating });
            
            App.showSuccess('Project completed and installer rated successfully!');
            this.closeModal();
            
            if (onSuccess) {
                onSuccess();
            }
            
        } catch (error) {
            App.showError('Failed to complete project');
        } finally {
            App.showLoading(false);
        }
    },
    
    // Create modal helper
    createModal(title, content, options = {}) {
        const {
            size = 'medium',
            confirmText = 'Submit',
            cancelText = 'Cancel'
        } = options;
        
        const modalId = `modal-${Date.now()}`;
        
        const modalHTML = `
            <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-${size}">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="close" onclick="RatingModal.closeModal('${modalId}')">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            ${content}
                        </div>
                        <div class="modal-footer">
                            <button type="submit" form="ratingForm" class="btn btn-primary">
                                ${confirmText}
                            </button>
                            <button type="button" class="btn btn-outline" onclick="RatingModal.closeModal('${modalId}')">
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
        
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
    }
};

// Register globally
window.RatingModal = RatingModal;