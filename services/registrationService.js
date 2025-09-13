const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const RegistrationTokenModel = require('../models/registrationToken');
const UserModel = require('../models/user');
const microsoftEmailService = require('./microsoftEmailService');
const logger = require('../utils/logger');

class RegistrationService {
    // Generate secure random token
    static generateSecureToken() {
        return crypto.randomBytes(32).toString('base64url');
    }
    
    // Generate 6-digit verification code
    static generateVerificationCode() {
        return crypto.randomInt(100000, 999999).toString();
    }
    
    // Hash token for storage
    static hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    
    // Create registration request
    static async createRegistrationRequest(email, ipAddress, userAgent) {
        try {
            // Check if email already exists
            const existingUser = await UserModel.getByEmail(email);
            if (existingUser) {
                return { 
                    success: false, 
                    error: 'This email is already registered. Please login or reset your password.' 
                };
            }
            
            // Check rate limiting (max 3 attempts per hour)
            const recentAttempts = await RegistrationTokenModel.getRecentAttempts(email, 1);
            if (recentAttempts >= 3) {
                logger.warn(`Rate limit exceeded for registration: ${email}`);
                return { 
                    success: false, 
                    error: 'Too many registration attempts. Please try again later.' 
                };
            }
            
            // Invalidate any existing tokens for this email
            await RegistrationTokenModel.invalidateAllEmailTokens(email);
            
            // Generate new token and code
            const token = this.generateSecureToken();
            const tokenHash = this.hashToken(token);
            const verificationCode = this.generateVerificationCode();
            
            // Save to database
            await RegistrationTokenModel.create({
                email: email,
                token_hash: tokenHash,
                verification_code: verificationCode,
                ip_address: ipAddress,
                user_agent: userAgent
            });
            
            // Send email
            await this.sendRegistrationEmail(email, token, verificationCode);
            
            logger.info(`Registration email sent to: ${email}`);
            
            return { 
                success: true,
                message: 'Registration email sent. Please check your inbox.',
                // Only for testing in development
                debug: process.env.NODE_ENV === 'development' ? 
                    { token, code: verificationCode } : undefined
            };
            
        } catch (error) {
            logger.error('Error in createRegistrationRequest:', error);
            throw error;
        }
    }
    
    // Send registration email
    static async sendRegistrationEmail(email, token, verificationCode) {
        const registrationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/register.html?token=${token}`;
        
        const subject = 'Complete Your Registration - Capital Choice';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    .container { 
                        background-color: #ffffff;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        overflow: hidden;
                    }
                    .header { 
                        background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                    }
                    .content { 
                        padding: 30px; 
                    }
                    .code-box {
                        background: #f8f9fa;
                        border: 2px dashed #4a90e2;
                        padding: 20px;
                        text-align: center;
                        margin: 20px 0;
                        border-radius: 5px;
                    }
                    .code {
                        font-size: 32px;
                        font-weight: bold;
                        color: #4a90e2;
                        letter-spacing: 5px;
                    }
                    .button {
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #4a90e2;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                    }
                    .footer { 
                        text-align: center; 
                        padding: 20px; 
                        color: #666; 
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Capital Choice!</h1>
                        <p>Complete your installation company registration</p>
                    </div>
                    <div class="content">
                        <p>Thank you for your interest in joining the Capital Choice bidding platform.</p>
                        
                        <p>To continue with your registration, please click the button below and enter the verification code:</p>
                        
                        <div class="code-box">
                            <p style="margin: 0 0 10px 0;">Your verification code is:</p>
                            <div class="code">${verificationCode}</div>
                        </div>
                        
                        <center style="margin: 30px 0;">
                            <a href="${registrationUrl}" class="button">Complete Registration</a>
                        </center>
                        
                        <p><strong>Important:</strong></p>
                        <ul>
                            <li>This link will expire in 1 hour</li>
                            <li>You'll need to provide company information</li>
                            <li>Admin approval is required before you can access the platform</li>
                            <li>You'll be notified by email once approved</li>
                        </ul>
                        
                        <p>If you didn't request this registration, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>Capital Choice Office Furniture<br>
                        This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const textContent = `
Welcome to Capital Choice!

Complete your installation company registration

Thank you for your interest in joining the Capital Choice bidding platform.

Your verification code is: ${verificationCode}

To continue registration, visit: ${registrationUrl}

Important:
- This link will expire in 1 hour
- You'll need to provide company information
- Admin approval is required before you can access the platform
- You'll be notified by email once approved

If you didn't request this registration, please ignore this email.

Capital Choice Office Furniture
        `;
        
        return await microsoftEmailService.sendEmail(
            email,
            subject,
            htmlContent,
            textContent
        );
    }
    
    // Verify token and code
    static async verifyTokenAndCode(token, code) {
        try {
            const tokenHash = this.hashToken(token);
            const result = await RegistrationTokenModel.verifyCode(tokenHash, code);
            
            if (!result.valid) {
                return result;
            }
            
            // Generate temporary JWT for form completion
            const tempToken = jwt.sign(
                { 
                    registrationTokenId: result.token.id,
                    email: result.token.email,
                    type: 'registration_temp'
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '1h' }
            );
            
            return {
                valid: true,
                tempToken,
                email: result.token.email
            };
            
        } catch (error) {
            logger.error('Token verification error:', error);
            return { valid: false, error: 'Verification failed' };
        }
    }
    
    // Complete registration
    static async completeRegistration(tempToken, registrationData) {
        try {
            // Verify temp token
            const decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'your-secret-key');
            
            if (!decoded || decoded.type !== 'registration_temp') {
                return { success: false, error: 'Invalid or expired session' };
            }
            
            // Get registration token
            const regToken = await RegistrationTokenModel.getById(decoded.registrationTokenId);
            
            if (!regToken || !regToken.verified_at) {
                return { success: false, error: 'Invalid registration session' };
            }
            
            // Check if already completed
            if (regToken.completed_at) {
                return { success: false, error: 'Registration already completed' };
            }
            
            // Verify email matches
            if (registrationData.email !== regToken.email) {
                return { success: false, error: 'Email mismatch' };
            }
            
            // Check if username already exists
            const existingUsername = await UserModel.getByUsername(registrationData.username);
            if (existingUsername) {
                return { success: false, error: 'Username already taken' };
            }
            
            // Check if email already exists (double check)
            const existingEmail = await UserModel.getByEmail(registrationData.email);
            if (existingEmail) {
                return { success: false, error: 'Email already registered' };
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(registrationData.password, 10);
            
            // Create user (not approved yet)
            const userId = await UserModel.create({
                username: registrationData.username,
                password: hashedPassword,
                name: registrationData.name,
                email: registrationData.email,
                role: 'installation_company', // Always installation company for this flow
                company: registrationData.company,
                phone: registrationData.phone,
                position: registrationData.position,
                approved: 0, // Requires admin approval
                suspended: 0
            });
            
            // Mark registration as completed
            await RegistrationTokenModel.markAsCompleted(regToken.id);
            
            // Get the created user
            const newUser = await UserModel.getById(userId);
            
            // Notify admins
            await this.notifyAdminsOfNewRegistration(newUser);
            
            logger.info(`New installation company registered: ${registrationData.username} (${registrationData.email})`);
            
            return { 
                success: true, 
                message: 'Registration successful! Your account is pending admin approval. You will receive an email once approved.' 
            };
            
        } catch (error) {
            logger.error('Registration completion error:', error);
            return { success: false, error: 'Failed to complete registration' };
        }
    }
    
    // Notify all admins of new registration
    static async notifyAdminsOfNewRegistration(user) {
        try {
            // Get all admin users
            const admins = await UserModel.db.all(
                'SELECT * FROM users WHERE role = ? AND approved = 1 AND suspended = 0',
                ['admin']
            );
            
            const subject = 'New Installation Company Registration - Approval Required';
            
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            line-height: 1.6; 
                            color: #333; 
                        }
                        .container { 
                            max-width: 600px; 
                            margin: 0 auto; 
                            padding: 20px; 
                        }
                        .header { 
                            background: #ffc107;
                            color: #333; 
                            padding: 20px; 
                            text-align: center; 
                            border-radius: 5px 5px 0 0;
                        }
                        .content { 
                            padding: 20px; 
                            background-color: #f9f9f9;
                            border: 1px solid #ddd;
                            border-radius: 0 0 5px 5px;
                        }
                        .info-box {
                            background: white;
                            padding: 15px;
                            border-left: 4px solid #ffc107;
                            margin: 15px 0;
                        }
                        .button { 
                            display: inline-block; 
                            padding: 10px 20px; 
                            background-color: #28a745; 
                            color: white; 
                            text-decoration: none; 
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h2>New Registration Pending Approval</h2>
                        </div>
                        <div class="content">
                            <p>A new installation company has registered and requires admin approval.</p>
                            
                            <div class="info-box">
                                <h3>Registration Details:</h3>
                                <p><strong>Company:</strong> ${user.company}</p>
                                <p><strong>Name:</strong> ${user.name}</p>
                                <p><strong>Position:</strong> ${user.position || 'Not specified'}</p>
                                <p><strong>Email:</strong> ${user.email}</p>
                                <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
                                <p><strong>Username:</strong> ${user.username}</p>
                                <p><strong>Registration Time:</strong> ${new Date().toLocaleString()}</p>
                            </div>
                            
                            <p>Please review this registration and approve or reject the account.</p>
                            
                            <center style="margin-top: 20px;">
                                <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/users" class="button">
                                    Review Registration
                                </a>
                            </center>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            // Send email to each admin
            const results = [];
            for (const admin of admins) {
                if (admin.email) {
                    try {
                        await microsoftEmailService.sendEmail(
                            admin.email,
                            subject,
                            htmlContent
                        );
                        results.push({ admin: admin.email, success: true });
                    } catch (error) {
                        logger.error(`Failed to notify admin ${admin.email}:`, error);
                        results.push({ admin: admin.email, success: false });
                    }
                }
            }
            
            logger.info(`Notified ${results.filter(r => r.success).length} admins of new registration`);
            return results;
            
        } catch (error) {
            logger.error('Failed to notify admins:', error);
            return false;
        }
    }
    
    // Send approval email to user
    static async sendApprovalEmail(user) {
        const subject = 'Account Approved - Welcome to Capital Choice!';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                    }
                    .container { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 20px; 
                    }
                    .header { 
                        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                        border-radius: 5px 5px 0 0;
                    }
                    .content { 
                        padding: 30px; 
                        background-color: #ffffff;
                        border: 1px solid #e1e4e8;
                        border-radius: 0 0 5px 5px;
                    }
                    .button { 
                        display: inline-block; 
                        padding: 12px 30px; 
                        background-color: #28a745; 
                        color: white; 
                        text-decoration: none; 
                        border-radius: 5px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Account Approved!</h1>
                        <p>Welcome to Capital Choice Bidding Platform</p>
                    </div>
                    <div class="content">
                        <h2>Hello ${user.name},</h2>
                        
                        <p>Great news! Your account has been approved by our admin team.</p>
                        
                        <p>You can now log in and start:</p>
                        <ul>
                            <li>Viewing available projects</li>
                            <li>Submitting bids on projects</li>
                            <li>Managing your bids</li>
                            <li>Communicating with project managers</li>
                            <li>Building your reputation through successful projects</li>
                        </ul>
                        
                        <center style="margin: 30px 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button">
                                Log In Now
                            </a>
                        </center>
                        
                        <p><strong>Your Login Credentials:</strong></p>
                        <p>Username: ${user.username}<br>
                        Password: (the password you created during registration)</p>
                        
                        <p>If you have any questions, please don't hesitate to contact our support team.</p>
                        
                        <p>We look forward to working with you!</p>
                        
                        <p>Best regards,<br>
                        The Capital Choice Team</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await microsoftEmailService.sendEmail(
            user.email,
            subject,
            htmlContent
        );
    }
}

// Cleanup expired tokens periodically
setInterval(() => {
    RegistrationTokenModel.cleanupExpired().catch(err => 
        logger.error('Error in registration cleanup job:', err)
    );
}, 60 * 60 * 1000); // Every hour

module.exports = RegistrationService;