const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const logger = require('../utils/logger');

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
}

module.exports = new MicrosoftEmailService();