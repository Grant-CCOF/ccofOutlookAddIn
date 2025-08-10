const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialize();
    }
    
    initialize() {
        if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT) || 587,
                secure: process.env.EMAIL_PORT === '465',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
            
            // Verify connection
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('Email service initialization failed:', error);
                } else {
                    logger.info('Email service initialized successfully');
                }
            });
        } else {
            logger.warn('Email service not configured - emails will not be sent');
        }
    }
    
    async sendEmail(to, subject, html, text = null) {
        if (!this.transporter) {
            logger.warn('Email not sent - service not configured');
            return false;
        }
        
        try {
            const info = await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to,
                subject,
                text: text || subject,
                html
            });
            
            logger.info('Email sent:', info.messageId);
            return true;
        } catch (error) {
            logger.error('Email sending failed:', error);
            return false;
        }
    }
    
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
                        <p>&copy; 2024 Capital Choice. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return this.sendEmail(user.email, subject, html);
    }
    
    async sendApprovalEmail(user) {
        const subject = 'Account Approved - Capital Choice';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f4f4f4; }
                    .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 10px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Account Approved!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${user.name},</h2>
                        <p>Great news! Your account has been approved.</p>
                        <p>You can now log in to the Capital Choice Bidding Platform using your credentials.</p>
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button">Log In Now</a>
                        </p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Capital Choice. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return this.sendEmail(user.email, subject, html);
    }
    
    async sendBidNotification(projectManager, project, bid, bidder) {
        const subject = `New Bid Received - ${project.title}`;
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f4f4f4; }
                    .bid-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .footer { text-align: center; padding: 10px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>New Bid Received</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${projectManager.name},</h2>
                        <p>A new bid has been submitted for your project:</p>
                        <div class="bid-details">
                            <h3>${project.title}</h3>
                            <p><strong>Company:</strong> ${bidder.company || bidder.name}</p>
                            <p><strong>Bid Amount:</strong> $${bid.amount.toLocaleString()}</p>
                            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                            ${bid.comments ? `<p><strong>Comments:</strong> ${bid.comments}</p>` : ''}
                        </div>
                        <p>Log in to the platform to review all bids and make a decision.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Capital Choice. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return this.sendEmail(projectManager.email, subject, html);
    }
    
    async sendPasswordResetEmail(user, resetToken) {
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        const subject = 'Password Reset Request - Capital Choice';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f4f4f4; }
                    .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 10px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${user.name},</h2>
                        <p>We received a request to reset your password.</p>
                        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </p>
                        <p>If you didn't request this, please ignore this email.</p>
                        <p><small>Link: ${resetUrl}</small></p>
                    </div>
                    <div class="footer">
                        <p>&copy; 2024 Capital Choice. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return this.sendEmail(user.email, subject, html);
    }
}

module.exports = new EmailService();