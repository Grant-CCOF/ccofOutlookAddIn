const RatingsComponent = {
    // Initialize ratings component
    async init() {
        // Check permissions first
        if (!Auth.canViewRatings()) {
            Notification.error('You do not have permission to view ratings');
            Router.navigate('/dashboard');
            return;
        }
        
        await this.loadRatings();
    },
    
    // Load ratings for display
    async loadRatings() {
        try {
            // Only load if user has permission
            if (!Auth.canViewRatings()) {
                return;
            }
            
            const ratings = await API.get('/api/ratings');
            this.renderRatings(ratings);
        } catch (error) {
            console.error('Error loading ratings:', error);
            Notification.error('Failed to load ratings');
        }
    },
    
    // Submit a new rating
    async submitRating(projectId, userId, ratingData) {
        // Check permission
        if (!Auth.canSubmitRatings()) {
            Notification.error('You do not have permission to submit ratings');
            return;
        }
        
        try {
            const response = await API.post('/api/ratings', {
                project_id: projectId,
                rated_user_id: userId,
                ...ratingData
            });
            
            Notification.success('Rating submitted successfully');
            return response;
        } catch (error) {
            console.error('Error submitting rating:', error);
            Notification.error('Failed to submit rating');
            throw error;
        }
    },
    
    // Render rating form (only for those with permission)
    renderRatingForm(projectId, userId) {
        if (!Auth.canSubmitRatings()) {
            return '';
        }
        
        return `
            <div class="rating-form">
                <h5>Rate Contractor Performance</h5>
                <form id="ratingForm" data-project="${projectId}" data-user="${userId}">
                    <div class="rating-category">
                        <label>Price Competitiveness</label>
                        <div class="star-rating" data-rating="price">
                            ${this.renderStarInput('price')}
                        </div>
                    </div>
                    <div class="rating-category">
                        <label>Speed of Completion</label>
                        <div class="star-rating" data-rating="speed">
                            ${this.renderStarInput('speed')}
                        </div>
                    </div>
                    <div class="rating-category">
                        <label>Quality of Work</label>
                        <div class="star-rating" data-rating="quality">
                            ${this.renderStarInput('quality')}
                        </div>
                    </div>
                    <div class="rating-category">
                        <label>Responsiveness</label>
                        <div class="star-rating" data-rating="responsiveness">
                            ${this.renderStarInput('responsiveness')}
                        </div>
                    </div>
                    <div class="rating-category">
                        <label>Customer Satisfaction</label>
                        <div class="star-rating" data-rating="customer_satisfaction">
                            ${this.renderStarInput('customer_satisfaction')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Comments (Optional)</label>
                        <textarea class="form-control" name="comment" rows="3"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Submit Rating</button>
                </form>
            </div>
        `;
    },
    
    renderStarInput(name) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `
                <input type="radio" name="${name}" value="${i}" id="${name}_${i}">
                <label for="${name}_${i}">
                    <i class="fas fa-star"></i>
                </label>
            `;
        }
        return stars;
    }
};