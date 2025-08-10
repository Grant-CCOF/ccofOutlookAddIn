// Capital Choice Platform - Email Templates (Frontend Preview)

const EmailTemplates = {
    // Get template preview
    getTemplatePreview(type, data = {}) {
        const templates = {
            welcome: this.getWelcomeTemplate,
            projectCreated: this.getProjectCreatedTemplate,
            bidReceived: this.getBidReceivedTemplate,
            bidAccepted: this.getBidAcceptedTemplate,
            bidRejected: this.getBidRejectedTemplate,
            projectAwarded: this.getProjectAwardedTemplate,
            projectCompleted: this.getProjectCompletedTemplate,
            userApproved: this.getUserApprovedTemplate,
            passwordReset: this.getPasswordResetTemplate
        };
        
        const templateFunc = templates[type];
        if (!templateFunc) {
            return this.getDefaultTemplate(data);
        }
        
        return templateFunc.call(this, data);
    },
    
    // Base template wrapper
    wrapTemplate(content, data = {}) {
        return `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 20px;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            padding: 30px; 
                            text-align: center; 
                            border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">
                        Capital Choice Platform
                    </h1>
                </div>
                
                <!-- Content -->
                <div style="background: white; 
                            padding: 30px; 
                            border: 1px solid #e2e8f0; 
                            border-top: none;
                            border-radius: 0 0 10px 10px;">
                    ${content}
                </div>
                
                <!-- Footer -->
                <div style="text-align: center; 
                            padding: 20px; 
                            color: #718096; 
                            font-size: 12px;">
                    <p style="margin: 5px 0;">
                        © ${new Date().getFullYear()} Capital Choice Platform. All rights reserved.
                    </p>
                    <p style="margin: 5px 0;">
                        This is an automated message. Please do not reply to this email.
                    </p>
                </div>
            </div>
        `;
    },
    
    // Welcome template
    getWelcomeTemplate(data) {
        const content = `
            <h2 style="color: #2d3748; margin-bottom: 20px;">
                Welcome to Capital Choice Platform!
            </h2>
            
            <p style="color: #4a5568; line-height: 1.6;">
                Hi ${data.name || 'there'},
            </p>
            
            <p style="color: #4a5568; line-height: 1.6;">
                Your account has been successfully created. Here are your login details:
            </p>
            
            <div style="background: #f7fafc; 
                        padding: 20px; 
                        border-radius: 8px; 
                        margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Username:</strong> ${data.username || ''}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${data.email || ''}</p>
                ${data.tempPassword ? `
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${data.tempPassword}</p>
                ` : ''}
            </div>
            
            ${data.needsApproval ? `
                <div style="background: #fff5f5; 
                            border-left: 4px solid #fc8181; 
                            padding: 15px; 
                            margin: 20px 0;">
                    <p style="color: #c53030; margin: 0;">
                        <strong>Note:</strong> Your account is pending approval. 
                        You'll receive an email once your account has been approved.
                    </p>
                </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.loginUrl || '#'}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 12px 30px; 
                          text-decoration: none; 
                          border-radius: 5px;">
                    Login to Your Account
                </a>
            </div>
        `;
        
        return this.wrapTemplate(content, data);
    },
    
    // Project created template
    getProjectCreatedTemplate(data) {
        const content = `
            <h2 style="color: #2d3748; margin-bottom: 20px;">
                New Project Available for Bidding
            </h2>
            
            <p style="color: #4a5568; line-height: 1.6;">
                A new project has been posted that matches your profile:
            </p>
            
            <div style="background: #f7fafc; 
                        padding: 20px; 
                        border-radius: 8px; 
                        margin: 20px 0;">
                <h3 style="color: #2d3748; margin-top: 0;">
                    ${data.projectTitle || 'Project Title'}
                </h3>
                <p style="color: #4a5568; margin: 10px 0;">
                    ${data.projectDescription || 'Project description...'}
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                <p style="margin: 5px 0;">
                    <strong>Location:</strong> ${data.location || 'N/A'}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Bid Due Date:</strong> ${data.bidDueDate || 'N/A'}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Delivery Date:</strong> ${data.deliveryDate || 'N/A'}
                </p>
                ${data.maxBid ? `
                    <p style="margin: 5px 0;">
                        <strong>Maximum Bid:</strong> ${data.maxBid}
                    </p>
                ` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.projectUrl || '#'}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 12px 30px; 
                          text-decoration: none; 
                          border-radius: 5px;">
                    View Project & Place Bid
                </a>
            </div>
        `;
        
        return this.wrapTemplate(content, data);
    },
    
    // Bid received template
    getBidReceivedTemplate(data) {
        const content = `
            <h2 style="color: #2d3748; margin-bottom: 20px;">
                New Bid Received
            </h2>
            
            <p style="color: #4a5568; line-height: 1.6;">
                You've received a new bid for your project:
            </p>
            
            <div style="background: #f7fafc; 
                        padding: 20px; 
                        border-radius: 8px; 
                        margin: 20px 0;">
                <h3 style="color: #2d3748; margin-top: 0;">
                    ${data.projectTitle || 'Project Title'}
                </h3>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                <p style="margin: 5px 0;">
                    <strong>Bidder:</strong> ${data.bidderName || 'N/A'}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Company:</strong> ${data.bidderCompany || 'N/A'}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Bid Amount:</strong> 
                    <span style="color: #48bb78; font-size: 18px; font-weight: bold;">
                        ${data.bidAmount || '$0.00'}
                    </span>
                </p>
                <p style="margin: 5px 0;">
                    <strong>Proposed Delivery:</strong> ${data.deliveryDate || 'N/A'}
                </p>
            </div>
            
            ${data.bidCount ? `
                <p style="color: #4a5568; text-align: center;">
                    You now have <strong>${data.bidCount}</strong> bid(s) for this project.
                </p>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.projectUrl || '#'}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 12px 30px; 
                          text-decoration: none; 
                          border-radius: 5px;">
                    Review All Bids
                </a>
            </div>
        `;
        
        return this.wrapTemplate(content, data);
    },
    
    // Bid accepted template
    getBidAcceptedTemplate(data) {
        const content = `
            <h2 style="color: #48bb78; margin-bottom: 20px;">
                🎉 Congratulations! Your Bid Was Accepted
            </h2>
            
            <p style="color: #4a5568; line-height: 1.6;">
                Great news! Your bid has been accepted for the following project:
            </p>
            
            <div style="background: #f0fff4; 
                        padding: 20px; 
                        border-radius: 8px; 
                        border: 1px solid #9ae6b4;
                        margin: 20px 0;">
                <h3 style="color: #2d3748; margin-top: 0;">
                    ${data.projectTitle || 'Project Title'}
                </h3>
                <hr style="border: none; border-top: 1px solid #9ae6b4; margin: 15px 0;">
                <p style="margin: 5px 0;">
                    <strong>Your Bid Amount:</strong> 
                    <span style="color: #48bb78; font-size: 18px; font-weight: bold;">
                        ${data.bidAmount || '$0.00'}
                    </span>
                </p>
                <p style="margin: 5px 0;">
                    <strong>Delivery Date:</strong> ${data.deliveryDate || 'N/A'}
                </p>
                <p style="margin: 5px 0;">
                    <strong>Project Location:</strong> ${data.location || 'N/A'}
                </p>
            </div>
            
            <h3 style="color: #2d3748; margin-top: 30px;">Next Steps:</h3>
            <ol style="color: #4a5568; line-height: 1.8;">
                <li>Review the project requirements and specifications</li>
                <li>Contact the project manager for any clarifications</li>
                <li>Begin preparation for project delivery</li>
                <li>Ensure timely completion by the delivery date</li>
            </ol>
            
            ${data.projectManagerContact ? `
                <div style="background: #f7fafc; 
                            padding: 15px; 
                            border-radius: 8px; 
                            margin: 20px 0;">
                    <p style="margin: 5px 0;">
                        <strong>Project Manager:</strong> ${data.projectManagerName || 'N/A'}
                    </p>
                    <p style="margin: 5px 0;">
                        <strong>Contact:</strong> ${data.projectManagerContact}
                    </p>
                </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.projectUrl || '#'}" 
                   style="display: inline-block; 
                          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 12px 30px; 
                          text-decoration: none; 
                          border-radius: 5px;">
                    View Project Details
                </a>
            </div>
        `;
        
        return this.wrapTemplate(content, data);
    },
    
    // Default template
    getDefaultTemplate(data) {
        const content = `
            <h2 style="color: #2d3748; margin-bottom: 20px;">
                ${data.title || 'Notification'}
            </h2>
            
            <p style="color: #4a5568; line-height: 1.6;">
                ${data.message || 'You have a new notification from Capital Choice Platform.'}
            </p>
            
            ${data.actionUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.actionUrl}" 
                       style="display: inline-block; 
                              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: white; 
                              padding: 12px 30px; 
                              text-decoration: none; 
                              border-radius: 5px;">
                        ${data.actionText || 'View Details'}
                    </a>
                </div>
            ` : ''}
        `;
        
        return this.wrapTemplate(content, data);
    },
    
    // Show template preview in modal
    showPreview(type, data = {}) {
        const template = this.getTemplatePreview(type, data);
        
        const modalHTML = `
            <div class="modal fade show" id="emailPreviewModal" tabindex="-1" style="display: block;">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Email Template Preview</h5>
                            <button type="button" class="close" onclick="EmailTemplates.closePreview()">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
                                ${template}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline" onclick="EmailTemplates.closePreview()">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show" id="emailPreviewBackdrop"></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.classList.add('modal-open');
    },
    
    // Close preview modal
    closePreview() {
        const modal = DOM.get('emailPreviewModal');
        const backdrop = DOM.get('emailPreviewBackdrop');
        
        if (modal) modal.remove();
        if (backdrop) backdrop.remove();
        
        document.body.classList.remove('modal-open');
    }
};

// Register globally
window.EmailTemplates = EmailTemplates;