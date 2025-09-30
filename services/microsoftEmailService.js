const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const logger = require('../utils/logger');
const db = require('../models/database');

class MicrosoftEmailService {
    constructor() {
        this.client = null;
        this.isEnabled = false;
        this.fromEmail = null;
        this.initialize();
    }
    
    initialize() {
        try {
            // Check if email should be disabled
            if (process.env.DISABLE_EMAIL === 'true') {
                logger.info('Email service is disabled (DISABLE_EMAIL=true)');
                this.isEnabled = false;
                return;
            }
            
            // Check for required Microsoft configuration
            const tenantId = process.env.MICROSOFT_TENANT_ID;
            const clientId = process.env.MICROSOFT_CLIENT_ID;
            const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
            this.fromEmail = process.env.EMAIL_FROM || 'noreply@ccofficefurniture.com';
            
            if (!tenantId || !clientId || !clientSecret) {
                logger.warn('Microsoft email configuration missing - running in mock mode');
                logger.warn('Required: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET');
                this.isEnabled = false;
                return;
            }
            
            // Create credential using Azure Identity
            const credential = new ClientSecretCredential(
                tenantId,
                clientId,
                clientSecret
            );
            
            // Create Microsoft Graph client
            this.client = Client.initWithMiddleware({
                authProvider: {
                    getAccessToken: async () => {
                        const token = await credential.getToken('https://graph.microsoft.com/.default');
                        return token.token;
                    }
                }
            });
            
            this.isEnabled = true;
            logger.info('Microsoft Email service initialized successfully');
            logger.info(`Emails will be sent from: ${this.fromEmail}`);
            
        } catch (error) {
            logger.error('Microsoft Email service initialization failed:', error);
            this.isEnabled = false;
        }
    }
    
    async sendEmail(to, subject, htmlContent, textContent = null) {
        // Always log email attempts
        logger.info(`Email ${this.isEnabled ? 'sending' : 'mock'}: To: ${to}, Subject: ${subject}`);
        
        if (!this.isEnabled || !this.client) {
            logger.debug('Email mock mode - email not actually sent');
            return { success: true, mock: true };
        }
        
        try {
            const message = {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: htmlContent
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: to
                        }
                    }
                ]
            };
            
            // Add text alternative if provided
            if (textContent) {
                message.body.content = htmlContent;
                // Note: Graph API primarily uses HTML, text alternative is in HTML
            }
            
            // Send the email using Microsoft Graph
            const response = await this.client.api(`/users/${this.fromEmail}/sendMail`)
                .post({
                    message: message,
                    saveToSentItems: true
                });
            
            logger.info(`Email sent successfully to ${to}`);
            return { success: true, response };
            
        } catch (error) {
            logger.error('Failed to send email via Microsoft Graph:', error);
            
            // Provide detailed error information
            if (error.statusCode) {
                logger.error(`Status Code: ${error.statusCode}`);
                logger.error(`Error Message: ${error.message}`);
            }
            
            return { success: false, error: error.message };
        }
    }
    
    // Test email function - sends a test email to verify configuration
    async sendTestEmail(testEmail = null) {
        const to = testEmail || process.env.TEST_EMAIL || 'grant@ccofficefurniture.com';
        const subject = 'Test Email - CC Bid Platform';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f4f4f4; }
                    .footer { text-align: center; padding: 10px; color: #666; }
                    .info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Email Configuration Test</h1>
                    </div>
                    <div class="content">
                        <h2>Success! Email is working</h2>
                        <p>This test email confirms that your Microsoft email service is properly configured.</p>
                        <div class="info">
                            <p><strong>Configuration Details:</strong></p>
                            <ul>
                                <li>From: ${this.fromEmail}</li>
                                <li>To: ${to}</li>
                                <li>Time: ${new Date().toLocaleString()}</li>
                                <li>Platform: CC Bid Platform (ccbidplatform.com)</li>
                            </ul>
                        </div>
                        <p>Your email service is ready to send notifications!</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Capital Choice Office Furniture</p>
                        <p>ccbidplatform.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await this.sendEmail(to, subject, html);
    }
    
    // Application startup notification
    async sendAppStartupNotification() {
        const to = process.env.ADMIN_EMAIL || 'grant@ccofficefurniture.com';
        const subject = `Application Started - CC Bid Platform - ${new Date().toLocaleDateString()}`;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f4f4f4; }
                    .info { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
                    .footer { text-align: center; padding: 10px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Application Started Successfully</h1>
                    </div>
                    <div class="content">
                        <p>The CC Bid Platform application has been started successfully.</p>
                        <div class="info">
                            <p><strong>Startup Information:</strong></p>
                            <ul>
                                <li>Time: ${new Date().toLocaleString()}</li>
                                <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
                                <li>Port: ${process.env.PORT || 3000}</li>
                                <li>URL: ${process.env.APP_URL || 'http://localhost:3000'}</li>
                                <li>Email Service: Microsoft Graph API</li>
                                <li>From Address: ${this.fromEmail}</li>
                            </ul>
                        </div>
                        <p>All systems are operational.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Capital Choice Office Furniture</p>
                        <p>ccbidplatform.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await this.sendEmail(to, subject, html);
    }
    
    // Keep compatibility with existing methods
    async sendWelcomeEmail(user) {
        const subject = 'Welcome to Capital Choice Bidding Platform';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f4f4f4; }
                    .footer { text-align: center; padding: 10px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Capital Choice!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${user.name},</h2>
                        <p>Your account has been created successfully.</p>
                        <p><strong>Username:</strong> ${user.username}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Role:</strong> ${user.role}</p>
                        <p>Please wait for admin approval before you can log in.</p>
                        <p>You will receive an email notification once your account is approved.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Capital Choice Office Furniture</p>
                        <p>ccbidplatform.com</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await this.sendEmail(user.email, subject, html);
    }

    async sendProjectCreationEmail(project, creator) {
        try {
            // Get all admin emails
            const admins = await db.all(
                'SELECT email, name FROM users WHERE role = ? AND approved = 1',
                ['admin']
            );
            
            const results = [];
            for (const admin of admins) {
                const subject = `New Project Created: ${project.title}`;
                const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { 
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                line-height: 1.6;
                                color: #1d1d1f;
                                background: #f5f5f7;
                            }
                            .container { 
                                max-width: 600px; 
                                margin: 40px auto; 
                                background: white;
                                border-radius: 12px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                            }
                            .header { 
                                background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                                color: white; 
                                padding: 30px; 
                                text-align: center;
                                border-radius: 12px 12px 0 0;
                            }
                            .content { 
                                padding: 30px;
                            }
                            .info-box {
                                background: #f8f9fa;
                                padding: 20px;
                                border-radius: 8px;
                                margin: 20px 0;
                            }
                            .button { 
                                display: inline-block;
                                background: #007bff; 
                                color: white; 
                                padding: 12px 30px; 
                                text-decoration: none; 
                                border-radius: 25px;
                                font-weight: 500;
                                margin: 20px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>New Project Created</h1>
                                <p>A new project has been added to the platform</p>
                            </div>
                            <div class="content">
                                <h2>${project.title}</h2>
                                
                                <div class="info-box">
                                    <p><strong>Created by:</strong> ${creator.name || creator.username}</p>
                                    <p><strong>Delivery Date:</strong> ${new Date(project.delivery_date).toLocaleDateString()}</p>
                                    <p><strong>Location:</strong> ${project.zip_code}</p>
                                    <p><strong>Max Budget:</strong> $${project.max_bid}</p>
                                    <p><strong>Bid Due Date:</strong> ${new Date(project.bid_due_date).toLocaleDateString()}</p>
                                </div>
                                
                                <p><strong>Description:</strong></p>
                                <p>${project.description}</p>
                                
                                <center>
                                    <a href="${process.env.APP_URL}/#/projects/${project.id}" class="button">
                                        View Project Details
                                    </a>
                                </center>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                
                const result = await this.sendEmail(admin.email, subject, html);
                results.push(result);
            }
            
            return { success: true, results };
        } catch (error) {
            logger.error('Error sending project creation emails:', error);
            return { success: false, error: error.message };
        }
    }

    // In services/microsoftEmailService.js
    async sendProjectCreationEmail(project, creator) {
        try {
            // Get all admins
            const admins = await db.all(
                'SELECT email, name, role FROM users WHERE role = ? AND approved = 1',
                ['admin']
            );
            
            // Get all approved installers
            const installers = await db.all(
                'SELECT email, name, company, role FROM users WHERE role = ? AND approved = 1',
                ['installation_company']
            );
            
            // Combine both groups
            const allRecipients = [
                ...admins,
                ...installers
            ];
            
            logger.info(`Sending project creation emails to ${admins.length} admins and ${installers.length} installers`);
            
            const results = [];
            let successCount = 0;
            let failureCount = 0;
            
            // Send individual email to each recipient
            for (const recipient of allRecipients) {
                try {
                    const subject = `New Project Available: ${project.title}`;
                    
                    // Customize content based on role
                    const isAdmin = recipient.role === 'admin';
                    const html = this.getProjectCreationEmailHtml(project, creator, recipient, isAdmin);
                    
                    const result = await this.sendEmail(recipient.email, subject, html);
                    
                    if (result.success) {
                        successCount++;
                        logger.info(`Email sent to ${recipient.email}`);
                    } else {
                        failureCount++;
                        logger.error(`Failed to send email to ${recipient.email}`);
                    }
                    
                    results.push({
                        email: recipient.email,
                        role: recipient.role,
                        ...result
                    });
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                } catch (error) {
                    failureCount++;
                    logger.error(`Error sending email to ${recipient.email}:`, error);
                    results.push({
                        email: recipient.email,
                        role: recipient.role,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            logger.info(`Project creation emails sent: ${successCount} successful, ${failureCount} failed`);
            
            return { 
                success: failureCount === 0, 
                results,
                summary: {
                    total: allRecipients.length,
                    successful: successCount,
                    failed: failureCount,
                    adminCount: admins.length,
                    installerCount: installers.length
                }
            };
            
        } catch (error) {
            logger.error('Error sending project creation emails:', error);
            return { success: false, error: error.message };
        }
    }

    // Separate method for HTML generation with role-based customization
    getProjectCreationEmailHtml(project, creator, recipient, isAdmin) {
        const greeting = isAdmin ? 
            `Hello ${recipient.name || 'Admin'},` : 
            `Hello ${recipient.name || recipient.company || 'Installer'},`;
        
        const introduction = isAdmin ?
            'A new project has been added to the platform and requires your attention.' :
            'A new project opportunity is now available for bidding!';
        
        const callToAction = isAdmin ?
            'Review Project Details' :
            'Submit Your Bid';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        line-height: 1.6;
                        color: #1d1d1f;
                        background: #f5f5f7;
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 40px auto; 
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    }
                    .header { 
                        background: linear-gradient(135deg, ${isAdmin ? '#007bff' : '#28a745'} 0%, ${isAdmin ? '#0056b3' : '#20c997'} 100%);
                        color: white; 
                        padding: 30px; 
                        text-align: center;
                        border-radius: 12px 12px 0 0;
                    }
                    .content { 
                        padding: 30px;
                    }
                    .info-box {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                    }
                    .button { 
                        display: inline-block;
                        background: ${isAdmin ? '#007bff' : '#28a745'}; 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 25px;
                        font-weight: 500;
                        margin: 20px 0;
                    }
                    .button:hover {
                        opacity: 0.9;
                    }
                    ${!isAdmin ? `
                    .urgency-banner {
                        background: #fff3cd;
                        border: 1px solid #ffc107;
                        padding: 15px;
                        border-radius: 8px;
                        margin: 20px 0;
                        text-align: center;
                    }
                    .bid-deadline {
                        color: #dc3545;
                        font-weight: bold;
                        font-size: 18px;
                    }
                    ` : ''}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${isAdmin ? 'New Project Created' : ' New Project Opportunity'}</h1>
                        <p>${isAdmin ? 'Administrative Notification' : 'Open for Bidding'}</p>
                    </div>
                    <div class="content">
                        <p>${greeting}</p>
                        <p>${introduction}</p>
                        
                        <h2>${project.title}</h2>
                        
                        <div class="info-box">
                            ${isAdmin ? `<p><strong>Created by:</strong> ${creator.name || creator.username}</p>` : ''}
                            <p><strong>Delivery Date:</strong> ${new Date(project.delivery_date).toLocaleDateString()}</p>
                            <p><strong>Location:</strong> ${project.zip_code}</p>
                            ${project.show_max_bid ? `<p><strong>Budget Range:</strong> Up to $${project.max_bid}</p>` : ''}
                            <p><strong>Bid Due Date:</strong> ${new Date(project.bid_due_date).toLocaleDateString()}</p>
                        </div>
                        
                        ${!isAdmin ? `
                        <div class="urgency-banner">
                            <p class="bid-deadline">Bidding Deadline: ${new Date(project.bid_due_date).toLocaleDateString()}</p>
                            <p>Don't miss this opportunity!</p>
                        </div>
                        ` : ''}
                        
                        <p><strong>Project Description:</strong></p>
                        <p>${project.description}</p>
                        
                        ${project.site_conditions ? `
                        <p><strong>Site Conditions:</strong></p>
                        <p>${project.site_conditions}</p>
                        ` : ''}
                        
                        <center>
                            <a href="${process.env.APP_URL}/projects/${project.id}" class="button">
                                ${callToAction}
                            </a>
                        </center>
                        
                        ${!isAdmin ? `
                        <p style="text-align: center; color: #6c757d; font-size: 14px;">
                            You are receiving this email because you are a registered installer on the Capital Choice Bid Platform.
                        </p>
                        ` : ''}
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    async sendBidClosingEmail(project, stats) {
        try {
            // Get project manager details
            const pm = await db.get(
                'SELECT email, name FROM users WHERE id = ?',
                [project.project_manager_id]
            );
            
            const subject = `Bidding Closed: ${project.title} - ${stats.total_bids} Bids Received`;
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        /* Previous styles */
                        .bid-summary {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            padding: 30px;
                            border-radius: 12px;
                            text-align: center;
                            margin: 20px 0;
                        }
                        .bid-count {
                            font-size: 48px;
                            font-weight: bold;
                            margin: 10px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Bidding Period Closed</h1>
                            <p>The bidding period for your project has ended</p>
                        </div>
                        <div class="content">
                            <h2>${project.title}</h2>
                            
                            <div class="bid-summary">
                                <div class="bid-count">${stats.total_bids}</div>
                                <p>Total Bids Received</p>
                            </div>
                            
                            ${stats.total_bids > 0 ? `
                            <div class="info-box">
                                <h3>Bid Statistics</h3>
                                <p><strong>Lowest Bid:</strong> $${stats.min_bid}</p>
                                <p><strong>Highest Bid:</strong> $${stats.max_bid}</p>
                                <p><strong>Average Bid:</strong> $${Math.round(stats.avg_bid)}</p>
                            </div>
                            ` : '<p>No bids were received for this project.</p>'}
                            
                            <center>
                                <a href="${process.env.APP_URL}/#/projects/${project.id}/bids" class="button">
                                    Review All Bids
                                </a>
                            </center>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            return await this.sendEmail(pm.email, subject, html);
        } catch (error) {
            logger.error('Error sending bid closing email:', error);
            return { success: false, error: error.message };
        }
    }

    async sendBidSubmissionEmail(project, bid, bidder) {
        try {
            const pm = await db.get(
                'SELECT email, name FROM users WHERE id = ?',
                [project.project_manager_id]
            );
            
            // Get current bid count
            const bidCount = await db.get(
                'SELECT COUNT(*) as count FROM bids WHERE project_id = ?',
                [project.id]
            );
            
            const subject = `New Bid Received: ${project.title}`;
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        /* Previous styles */
                        .bidder-card {
                            border: 2px solid #007bff;
                            border-radius: 12px;
                            padding: 20px;
                            margin: 20px 0;
                        }
                        .bidder-header {
                            display: flex;
                            align-items: center;
                            margin-bottom: 15px;
                        }
                        .bidder-avatar {
                            width: 60px;
                            height: 60px;
                            border-radius: 50%;
                            background: #007bff;
                            color: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 24px;
                            font-weight: bold;
                            margin-right: 15px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>New Bid Received</h1>
                            <p>Bid #${bidCount.count} for your project</p>
                        </div>
                        <div class="content">
                            <h2>${project.title}</h2>
                            
                            <div class="bidder-card">
                                <div class="bidder-header">
                                    <div class="bidder-avatar">
                                        ${(bidder.name || bidder.company || 'B')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h3>${bidder.name || bidder.company}</h3>
                                        <p>${bidder.position || 'Installation Company'}</p>
                                    </div>
                                </div>
                                
                                <div class="info-box">
                                    <p><strong>Bid Amount:</strong> $${bid.amount}</p>
                                    <p><strong>Delivery:</strong> ${bid.alternate_delivery_date ? 
                                        new Date(bid.alternate_delivery_date).toLocaleDateString() : 
                                        'As per project schedule'}</p>
                                    ${bid.comments ? `<p><strong>Comments:</strong> ${bid.comments}</p>` : ''}
                                </div>
                            </div>
                            
                            <center>
                                <a href="${process.env.APP_URL}/#/projects/${project.id}/bids" class="button">
                                    View All Bids
                                </a>
                            </center>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            return await this.sendEmail(pm.email, subject, html);
        } catch (error) {
            logger.error('Error sending bid submission email:', error);
            return { success: false, error: error.message };
        }
    }

    async sendBidAwardEmails(project, winningBid, allBids) {
        try {
            const results = [];
            
            for (const bid of allBids) {
                const bidder = await db.get(
                    'SELECT email, name, company FROM users WHERE id = ?',
                    [bid.user_id]
                );
                
                const isWinner = bid.id === winningBid.id;
                const subject = isWinner ? 
                    `🎉 Congratulations! You Won: ${project.title}` : 
                    `Bid Update: ${project.title}`;
                
                const html = isWinner ? 
                    this.getWinnerEmailHtml(project, bid, bidder) : 
                    this.getLoserEmailHtml(project, winningBid, bidder);
                
                const result = await this.sendEmail(bidder.email, subject, html);
                results.push(result);
            }
            
            return { success: true, results };
        } catch (error) {
            logger.error('Error sending award emails:', error);
            return { success: false, error: error.message };
        }
    }

    getWinnerEmailHtml(project, bid, bidder) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Previous styles */
                    .winner-header {
                        background: linear-gradient(135deg, #00c851 0%, #00ff88 100%);
                        color: white;
                    }
                    .trophy {
                        font-size: 72px;
                        text-align: center;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header winner-header">
                        <h1>🎉 Congratulations!</h1>
                        <p>Your bid has been selected</p>
                    </div>
                    <div class="content">
                        <div class="trophy">🏆</div>
                        
                        <h2>${project.title}</h2>
                        
                        <div class="info-box" style="background: #d4edda; border: 2px solid #28a745;">
                            <h3>Winning Details</h3>
                            <p><strong>Your Bid:</strong> $${bid.amount}</p>
                            <p><strong>Delivery Date:</strong> ${new Date(project.delivery_date).toLocaleDateString()}</p>
                            <p><strong>Location:</strong> ${project.zip_code}</p>
                        </div>
                        
                        <h3>Next Steps:</h3>
                        <ol>
                            <li>You will be contacted by the project manager within 24 hours</li>
                            <li>Review and confirm project requirements</li>
                            <li>Coordinate delivery and installation details</li>
                            <li>Begin work as per the agreed timeline</li>
                        </ol>
                        
                        <center>
                            <a href="${process.env.APP_URL}/#/projects/${project.id}" class="button">
                                View Project Details
                            </a>
                        </center>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    getLoserEmailHtml(project, winningBid, bidder) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Previous styles */
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Bid Update</h1>
                        <p>Project has been awarded</p>
                    </div>
                    <div class="content">
                        <h2>${project.title}</h2>
                        
                        <p>Thank you for submitting your bid for this project. After careful consideration, we have selected another vendor for this project.</p>
                        
                        <div class="info-box">
                            <p><strong>Winning Bid:</strong> $${winningBid.amount}</p>
                            <p><strong>Your Bid:</strong> Check your dashboard for details</p>
                        </div>
                        
                        <p>We appreciate your participation and encourage you to bid on future projects. Your competitive bids help ensure the best value for our clients.</p>
                        
                        <center>
                            <a href="${process.env.APP_URL}/#/projects" class="button">
                                View Other Projects
                            </a>
                        </center>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}

module.exports = new MicrosoftEmailService();