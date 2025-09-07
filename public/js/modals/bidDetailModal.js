// Capital Choice Platform - Bid Detail Modal (Fixed)
(function() {
    'use strict';
    
    const BidDetailModal = {
        // Show bid detail modal
        async showBidDetail(bidId, options = {}) {
            try {
                App.showLoading(true);
                
                // Fetch bid details
                const bid = await API.bids.getById(bidId);
                
                if (!bid) {
                    App.showError('Bid not found');
                    // Refresh the current view
                    const currentHash = window.location.hash;
                    if (currentHash.includes('/projects/') && window.ProjectsComponent) {
                        const projectId = currentHash.split('/projects/')[1];
                        await ProjectsComponent.renderDetail(projectId);
                    } else if (window.BidsComponent) {
                        await BidsComponent.loadBids();
                    }
                    return;
                }
                
                // Check if bid has been withdrawn
                if (bid.status === 'withdrawn') {
                    App.showWarning('This bid has been withdrawn');
                    // Refresh and return
                    const currentHash = window.location.hash;
                    if (currentHash.includes('/projects/') && window.ProjectsComponent) {
                        const projectId = bid.project_id || currentHash.split('/projects/')[1];
                        await ProjectsComponent.renderDetail(projectId);
                    } else if (window.BidsComponent) {
                        await BidsComponent.loadBids();
                    }
                    return;
                }
                
                // Create modal content
                const content = this.getBidDetailContent(bid, options);
                const modalId = this.createModal('Bid Details', content, {
                    size: 'large',
                    showAwardButton: options.showAwardButton
                });
                
                // Initialize any interactive elements
                this.initializeInteractions(bid, options);
                
            } catch (error) {
                console.error('Error loading bid details:', error);
                App.showError('Failed to load bid details');
                
                // Refresh the current view on error
                const currentHash = window.location.hash;
                if (currentHash.includes('/projects/') && window.ProjectsComponent) {
                    const projectId = currentHash.split('/projects/')[1];
                    await ProjectsComponent.renderDetail(projectId);
                } else if (window.BidsComponent) {
                    await BidsComponent.loadBids();
                }
            } finally {
                App.showLoading(false);
            }
        },
            
        // Get bid detail content
        getBidDetailContent(bid, options = {}) {
            const user = State.getUser();
            const isManager = user.role === 'project_manager' || user.role === 'admin';
            const isBidder = bid.user_id === user.id;
            
            return `
                <div class="bid-detail-container">
                    <!-- Project and Amount Summary -->
                    <div class="bid-summary-row mb-4">
                        <div class="row">
                            <div class="col-md-8">
                                <h5 class="mb-1">${bid.project.title}</h5>
                                <p class="text-muted mb-0">Project #${bid.project_id}</p>
                            </div>
                            <div class="col-md-4 text-right">
                                <label class="text-muted small">Bid Amount</label>
                                <h3 class="text-primary mb-0">${Formatter.currency(bid.amount)}</h3>
                            </div>
                        </div>
                    </div>

                    ${bid.status === 'won' && bid.award_comment ? `
                        <div class="alert alert-success mt-3">
                            <h6><i class="fas fa-trophy"></i> Award Comment from Project Manager</h6>
                            <p class="mb-0">${bid.award_comment}</p>
                        </div>
                    ` : ''}

                    ${bid.status === 'won' && !bid.award_comment ? `
                        <div class="alert alert-success mt-3">
                            <i class="fas fa-trophy"></i>
                            <strong>Congratulations!</strong> Your bid was accepted for this project.
                        </div>
                    ` : ''}

                    ${bid.status === 'lost' ? `
                        <div class="alert alert-danger mt-3">
                            <i class="fas fa-times-circle"></i>
                            Unfortunately, your bid was not selected for this project.
                        </div>
                    ` : ''}
                    
                    <hr>
                    
                    <!-- Bid Information Grid -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="detail-section">
                                <h5>Bid Information</h5>
                                <dl class="detail-list">
                                    <dt>Status</dt>
                                    <dd><span class="badge badge-${this.getStatusColor(bid.status)}">${bid.status}</span></dd>
                                    
                                    <dt>Submitted</dt>
                                    <dd>${Formatter.datetime(bid.created_at)}</dd>
                                    
                                    <dt>Last Updated</dt>
                                    <dd>${Formatter.datetime(bid.updated_at)}</dd>
                                    
                                    <dt>Proposed Delivery</dt>
                                    <dd>${Formatter.datetime(bid.alternate_delivery_date || bid.project.delivery_date)}</dd>
                                    
                                    ${bid.alternate_delivery_time ? `
                                        <dt>Delivery Time</dt>
                                        <dd>${bid.alternate_delivery_time}</dd>
                                    ` : ''}
                                </dl>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="detail-section">
                                <h5>Bidder Information</h5>
                                <dl class="detail-list">
                                    <dt>Name</dt>
                                    <dd>
                                        ${isManager ? `
                                            <a href="#/users/${bid.bidder.id}" 
                                                class="bidder-link"
                                                onclick="BidDetailModal.closeModal(); Router.navigate('/users/${bid.bidder.id}'); return false;"
                                                title="View ${bid.bidder.name}'s profile">
                                                ${bid.bidder.name}
                                            </a>
                                        ` : bid.bidder.name}
                                    </dd>
                                    
                                    <dt>Company</dt>
                                    <dd>${bid.bidder.company || 'N/A'}</dd>
                                    
                                    ${bid.bidder.position ? `
                                        <dt>Position</dt>
                                        <dd>${bid.bidder.position}</dd>
                                    ` : ''}
                                    
                                    ${isManager && bid.bidder.email ? `
                                        <dt>Email</dt>
                                        <dd>${bid.bidder.email}</dd>
                                    ` : ''}
                                    
                                    ${isManager && bid.bidder.phone ? `
                                        <dt>Phone</dt>
                                        <dd>${bid.bidder.phone}</dd>
                                    ` : ''}
                                </dl>
                                ${isManager ? `
                                    <div class="mt-3">
                                        <a href="#/users/${bid.bidder.id}" 
                                        class="btn btn-sm btn-outline-primary"
                                        onclick="BidDetailModal.closeModal(); Router.navigate('/users/${bid.bidder.id}'); return false;">
                                            <i class="fas fa-user"></i> View Full Profile
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Ratings Section -->
                    ${bid.ratings && bid.ratings.count > 0 ? `
                        <div class="detail-section mt-4">
                            <h5>Bidder Ratings</h5>
                            <div class="rating-overview">
                                <div class="row">
                                    <div class="col-md-3 text-center">
                                        <div class="overall-rating">
                                            <h2 class="mb-0">${((bid.ratings.avg_price + bid.ratings.avg_speed + bid.ratings.avg_quality + bid.ratings.avg_responsiveness + bid.ratings.avg_customer_satisfaction) / 5).toFixed(1)}</h2>
                                            <div class="star-rating">
                                                ${this.renderStars((bid.ratings.avg_price + bid.ratings.avg_speed + bid.ratings.avg_quality + bid.ratings.avg_responsiveness + bid.ratings.avg_customer_satisfaction) / 5)}
                                            </div>
                                            <small class="text-muted">Based on ${bid.ratings.count} reviews</small>
                                        </div>
                                    </div>
                                    <div class="col-md-9">
                                        <div class="rating-breakdown">
                                            ${this.renderRatingBar('Price/Value', bid.ratings.avg_price)}
                                            ${this.renderRatingBar('Speed', bid.ratings.avg_speed)}
                                            ${this.renderRatingBar('Quality', bid.ratings.avg_quality)}
                                            ${this.renderRatingBar('Responsiveness', bid.ratings.avg_responsiveness)}
                                            ${this.renderRatingBar('Satisfaction', bid.ratings.avg_customer_satisfaction)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="detail-section mt-4">
                            <h5>Bidder Ratings</h5>
                            <p class="text-muted">No ratings available for this bidder yet.</p>
                        </div>
                    `}
                    
                    <!-- Comments Section -->
                    ${bid.comments ? `
                        <div class="detail-section mt-4">
                            <h5>Bid Comments</h5>
                            <div class="comments-box">
                                ${bid.comments}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Files Section -->
                    ${bid.files && bid.files.length > 0 ? `
                        <div class="detail-section mt-4">
                            <h5>Attached Files (${bid.files.length})</h5>
                            <div class="files-list">
                                ${bid.files.map(file => this.renderFileItem(file)).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Project Comparison -->
                    ${bid.project.max_bid && isManager ? `
                        <div class="detail-section mt-4">
                            <h5>Bid Comparison</h5>
                            <div class="comparison-info">
                                <div class="row">
                                    <div class="col-md-6">
                                        <label>This Bid</label>
                                        <div class="h4">${Formatter.currency(bid.amount)}</div>
                                    </div>
                                    <div class="col-md-6">
                                        <label>Maximum Budget</label>
                                        <div class="h4">${Formatter.currency(bid.project.max_bid)}</div>
                                    </div>
                                </div>
                                <div class="progress mt-3">
                                    <div class="progress-bar ${bid.amount <= bid.project.max_bid ? 'bg-success' : 'bg-warning'}" 
                                         style="width: ${Math.min(100, (bid.amount / bid.project.max_bid) * 100)}%">
                                        ${((bid.amount / bid.project.max_bid) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Action Buttons -->
                    <div class="modal-actions mt-4">
                        ${this.getActionButtons(bid, options)}
                    </div>
                </div>
            `;
        },
        
        // Get action buttons
        getActionButtons(bid, options) {
            const user = State.getUser();
            const buttons = [];
            
            // Award button for project managers
            if (options.showAwardButton && bid.project.status === 'reviewing' && bid.status === 'pending') {
                buttons.push(`
                    <button class="btn btn-success" onclick="BidDetailModal.awardBid(${bid.project_id}, ${bid.id})">
                        <i class="fas fa-trophy"></i> Award This Bid
                    </button>
                `);
            }
            
            // Edit button for bidder
            if (bid.user_id === user.id && bid.status === 'pending' && bid.project.status === 'bidding') {
                buttons.push(`
                    <button class="btn btn-primary" onclick="BidDetailModal.editBid(${bid.id})">
                        <i class="fas fa-edit"></i> Edit Bid
                    </button>
                `);
            }
            
            // Withdraw button for bidder
            if (bid.user_id === user.id && bid.status === 'pending') {
                buttons.push(`
                    <button class="btn btn-danger" onclick="BidDetailModal.withdrawBid(${bid.id})">
                        <i class="fas fa-times"></i> Withdraw Bid
                    </button>
                `);
            }
            
            return buttons.join(' ');
        },
        
        // Render star rating - FIXED
        renderStars(rating) {
            const fullStars = Math.floor(rating);
            const hasHalfStar = rating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0); // Fixed line
            
            let stars = '';
            for (let i = 0; i < fullStars; i++) {
                stars += '<i class="fas fa-star text-warning"></i>';
            }
            if (hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt text-warning"></i>';
            }
            for (let i = 0; i < emptyStars; i++) {
                stars += '<i class="far fa-star text-warning"></i>';
            }
            
            return stars;
        },
        
        // Render rating bar
        renderRatingBar(label, value) {
            const percentage = (value / 5) * 100;
            return `
                <div class="rating-bar-item mb-2">
                    <div class="d-flex justify-content-between mb-1">
                        <small>${label}</small>
                        <small>${value.toFixed(1)}/5</small>
                    </div>
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar bg-primary" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        },
        
        // Render file item
        renderFileItem(file) {
            const icon = this.getFileIcon(file.filename || file.original_name);
            const fileName = file.original_name || file.filename || 'Unknown File';
            const fileSize = file.file_size || file.size || 0;
            
            return `
                <div class="file-item-row">
                    <div class="file-icon">
                        <i class="${icon}"></i>
                    </div>
                    <div class="file-details">
                        <div class="file-name">${fileName}</div>
                        ${fileSize > 0 ? `<small class="file-size text-muted">${this.formatFileSize(fileSize)}</small>` : ''}
                    </div>
                    <div class="file-actions">
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="API.files.download(${file.id}, '${fileName.replace(/'/g, "\\'")}').catch(err => App.showError('Failed to download file'))">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                </div>
            `;
        },
        
        // Format file size
        formatFileSize(bytes) {
            if (!bytes || bytes === 0) return '';
            
            const units = ['B', 'KB', 'MB', 'GB'];
            const k = 1024;
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
        },
        
        // Get file icon based on extension
        getFileIcon(filename) {
            if (!filename) return 'fas fa-file text-muted';
            
            const ext = filename.split('.').pop().toLowerCase();
            const icons = {
                pdf: 'fas fa-file-pdf text-danger',
                doc: 'fas fa-file-word text-primary',
                docx: 'fas fa-file-word text-primary',
                xls: 'fas fa-file-excel text-success',
                xlsx: 'fas fa-file-excel text-success',
                ppt: 'fas fa-file-powerpoint text-warning',
                pptx: 'fas fa-file-powerpoint text-warning',
                jpg: 'fas fa-file-image text-info',
                jpeg: 'fas fa-file-image text-info',
                png: 'fas fa-file-image text-info',
                gif: 'fas fa-file-image text-info',
                zip: 'fas fa-file-archive text-secondary',
                rar: 'fas fa-file-archive text-secondary',
                txt: 'fas fa-file-alt text-secondary',
                csv: 'fas fa-file-csv text-success'
            };
            
            return icons[ext] || 'fas fa-file text-muted';
        },
        
        // Get status color
        getStatusColor(status) {
            const colors = {
                pending: 'warning',
                won: 'success',
                lost: 'danger',
                withdrawn: 'secondary'
            };
            
            return colors[status] || 'secondary';
        },
        
        // Initialize interactions
        initializeInteractions(bid, options) {
            // Add any event listeners or initialize plugins here
        },
        
        // Award bid
        async awardBid(projectId, bidId) {
            // Create modal content
            const content = `
                <div class="award-confirmation">
                    <p>Are you sure you want to award this bid?</p>
                    <div class="form-group mt-3">
                        <label>Award Comment (Optional)</label>
                        <textarea class="form-control" 
                                id="awardCommentModal" 
                                rows="3" 
                                placeholder="Add a comment for the winning bidder"></textarea>
                    </div>
                    <div class="alert alert-warning mt-3">
                        <i class="fas fa-exclamation-triangle"></i>
                        This action cannot be undone.
                    </div>
                </div>
            `;
            
            // Create a custom modal for award confirmation
            const modalId = `modal-award-${Date.now()}`;
            
            const modalHTML = `
                <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block;">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Award Bid</h5>
                                <button type="button" class="close" onclick="BidDetailModal.closeModal('${modalId}')">
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                ${content}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-success" 
                                        onclick="BidDetailModal.confirmAward(${projectId}, ${bidId}, '${modalId}')">
                                    Award
                                </button>
                                <button type="button" class="btn btn-outline" 
                                        onclick="BidDetailModal.closeModal('${modalId}')">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-backdrop fade show" id="${modalId}-backdrop"></div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            document.body.classList.add('modal-open');
        },

        // Add this new method to handle the award confirmation:
        async confirmAward(projectId, bidId, modalId) {
            const comment = document.getElementById('awardCommentModal')?.value.trim() || '';
            
            try {
                await API.projects.award(projectId, { bidId, comment });
                App.showSuccess('Bid awarded successfully!');
                
                // Close both modals
                this.closeModal(modalId);
                this.closeModal(); // Close the bid detail modal too
                
                // Refresh the page
                if (window.ProjectsComponent) {
                    ProjectsComponent.renderDetail(projectId);
                }
            } catch (error) {
                App.showError('Failed to award bid');
            }
        },
        
        // Edit bid
        editBid(bidId) {
            this.closeModal();
            if (window.BidsComponent) {
                BidsComponent.editBid(bidId);
            }
        },
        
        // Withdraw bid - Updated to refresh all views
        async withdrawBid(bidId) {
            if (!confirm('Are you sure you want to withdraw this bid?')) {
                return;
            }
            
            try {
                await API.bids.withdraw(bidId);
                App.showSuccess('Bid withdrawn successfully');
                this.closeModal();
                
                // Refresh based on current page/view
                const currentHash = window.location.hash;
                
                // Check if we're in project detail view
                if (currentHash.includes('/projects/') && window.ProjectsComponent) {
                    // Extract project ID from URL hash
                    const projectId = currentHash.split('/projects/')[1];
                    if (projectId) {
                        // Refresh project detail view
                        await ProjectsComponent.renderDetail(projectId);
                    }
                } 
                // Check if we're in projects list view
                else if (currentHash.includes('#/projects') && window.ProjectsComponent) {
                    // Refresh projects list
                    await ProjectsComponent.loadProjects();
                    // Re-render the current tab/filter if applicable
                    if (ProjectsComponent.render) {
                        await ProjectsComponent.render();
                    }
                }
                // Default to refreshing bids view
                else if (window.BidsComponent) {
                    await BidsComponent.loadBids();
                }
                
            } catch (error) {
                App.showError('Failed to withdraw bid');
                
                // Still refresh the appropriate view on error to ensure UI consistency
                const currentHash = window.location.hash;
                
                if (currentHash.includes('/projects/') && window.ProjectsComponent) {
                    const projectId = currentHash.split('/projects/')[1];
                    if (projectId) {
                        await ProjectsComponent.renderDetail(projectId);
                    }
                } else if (currentHash.includes('#projects') && window.ProjectsComponent) {
                    await ProjectsComponent.loadProjects();
                    if (ProjectsComponent.render) {
                        await ProjectsComponent.render();
                    }
                } else if (window.BidsComponent) {
                    await BidsComponent.loadBids();
                }
            }
        },
        
        // Create modal helper
        createModal(title, content, options = {}) {
            const {
                size = 'large',
                showAwardButton = false
            } = options;
            
            const modalId = `modal-${Date.now()}`;
            
            const modalHTML = `
                <div class="modal fade show" id="${modalId}" tabindex="-1" style="display: block;">
                    <div class="modal-dialog modal-${size}">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="close" onclick="BidDetailModal.closeModal('${modalId}')">
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div class="modal-body">
                                ${content}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-outline" onclick="BidDetailModal.closeModal('${modalId}')">
                                    Close
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
    
    // Register globally - only if not already defined
    if (typeof window.BidDetailModal === 'undefined') {
        window.BidDetailModal = BidDetailModal;
    }
})();