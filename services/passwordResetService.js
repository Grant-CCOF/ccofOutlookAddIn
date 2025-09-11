const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const PasswordResetModel = require('../models/passwordReset');
const UserModel = require('../models/user');
const microsoftEmailService = require('./microsoftEmailService');
const AuthService = require('./authService');
const logger = require('../utils/logger');

class PasswordResetService {
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
    
    // Create reset request
    static async createResetRequest(email, ipAddress, userAgent) {
        try {
            // Find user by email
            const user = await UserModel.getByEmail(email);
            
            if (!user) {
                // Log attempt but don't reveal user doesn't exist
                logger.info(`Password reset attempted for non-existent email: ${email}`);
                return { success: true, exists: false };
            }
            
            // Check rate limiting (max 3 attempts per hour)
            const recentAttempts = await PasswordResetModel.getRecentAttempts(user.id, 1);
            if (recentAttempts >= 3) {
                logger.warn(`Rate limit exceeded for password reset: ${email}`);
                return { success: false, error: 'Too many reset attempts. Please try again later.' };
            }
            
            // Invalidate any existing tokens for this user
            await PasswordResetModel.invalidateAllUserTokens(user.id);
            
            // Generate new token and code
            const token = this.generateSecureToken();
            const tokenHash = this.hashToken(token);
            const verificationCode = this.generateVerificationCode();
            
            // Save to database
            await PasswordResetModel.create({
                user_id: user.id,
                token_hash: tokenHash,
                verification_code: verificationCode,
                ip_address: ipAddress,
                user_agent: userAgent
            });
            
            // Send email
            await this.sendResetEmail(user, token, verificationCode);
            
            logger.info(`Password reset email sent to: ${email}`);
            
            return { 
                success: true, 
                exists: true,
                // Only for testing - remove in production
                debug: process.env.NODE_ENV === 'development' ? { token, code: verificationCode } : undefined
            };
            
        } catch (error) {
            logger.error('Error in createResetRequest:', error);
            throw error;
        }
    }
    
    // Send reset email using Microsoft Email Service
    static async sendResetEmail(user, token, verificationCode) {
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password.html?token=${token}`;
        
        const subject = 'Password Reset Request - Capital Choice';
        
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
                        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 300;
                    }
                    .content { 
                        padding: 30px; 
                        background-color: #f8f9fa; 
                    }
                    .code-box {
                        background: white;
                        border: 2px solid #dc3545;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                        text-align: center;
                    }
                    .code {
                        font-size: 32px;
                        font-weight: bold;
                        color: #dc3545;
                        letter-spacing: 8px;
                        font-family: 'Courier New', monospace;
                    }
                    .button { 
                        display: inline-block; 
                        padding: 12px 30px; 
                        background-color: #dc3545; 
                        color: white; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: 500;
                        margin: 20px 0;
                    }
                    .button:hover {
                        background-color: #c82333;
                    }
                    .warning {
                        background-color: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 20px 0;
                    }
                    .footer { 
                        text-align: center; 
                        padding: 20px; 
                        color: #6c757d; 
                        font-size: 14px;
                        background-color: #f8f9fa;
                        border-top: 1px solid #dee2e6;
                    }
                    .small-text {
                        font-size: 12px;
                        color: #6c757d;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔒 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hello <strong>${user.name}</strong>,</p>
                        
                        <p>We received a request to reset the password for your Capital Choice account associated with <strong>${user.email}</strong>.</p>
                        
                        <div class="code-box">
                            <p style="margin: 0 0 10px 0; color: #6c757d;">Your verification code is:</p>
                            <div class="code">${verificationCode}</div>
                            <p style="margin: 10px 0 0 0; color: #6c757d; font-size: 14px;">This code expires in 1 hour</p>
                        </div>
                        
                        <center>
                            <a href="${resetUrl}" class="button">Reset Your Password</a>
                        </center>
                        
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong><br>
                            If you did not request this password reset, please ignore this email and your password will remain unchanged. 
                            Consider changing your password if you suspect unauthorized access attempts.
                        </div>
                        
                        <div class="small-text">
                            <p><strong>Having trouble?</strong></p>
                            <p>Copy and paste this link into your browser:</p>
                            <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Capital Choice Platform</p>
                        <p>&copy; ${new Date().getFullYear()} Capital Choice. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        const textContent = `
Password Reset Request - Capital Choice

Hello ${user.name},

We received a request to reset the password for your Capital Choice account.

Your verification code is: ${verificationCode}

This code expires in 1 hour.

Click here to reset your password: ${resetUrl}

If you did not request this password reset, please ignore this email.

Capital Choice Platform
        `;
        
        return await microsoftEmailService.sendEmail(
            user.email,
            subject,
            htmlContent,
            textContent
        );
    }
    
    // Verify token and code
    static async verifyTokenAndCode(token, code) {
        try {
            const tokenHash = this.hashToken(token);
            const resetToken = await PasswordResetModel.verifyCode(tokenHash, code);
            
            if (!resetToken) {
                return { valid: false, error: 'Invalid or expired token/code combination' };
            }
            
            // Generate temporary auth token for password reset
            const tempToken = jwt.sign(
                { 
                    resetTokenId: resetToken.id,
                    userId: resetToken.user_id,
                    type: 'password_reset_temp'
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '15m' }
            );
            
            // Store temp token in database
            await PasswordResetModel.setTempToken(resetToken.id, tempToken);
            
            return { 
                valid: true, 
                tempToken,
                email: resetToken.email // Return masked email for display
            };
            
        } catch (error) {
            logger.error('Error verifying token and code:', error);
            return { valid: false, error: 'Verification failed' };
        }
    }
    
    // Reset password
    static async resetPassword(tempToken, newPassword) {
        try {
            // Verify temp token
            const decoded = jwt.verify(
                tempToken, 
                process.env.JWT_SECRET || 'your-secret-key'
            );
            
            if (decoded.type !== 'password_reset_temp') {
                return { success: false, error: 'Invalid token type' };
            }
            
            // Get reset token from database
            const resetToken = await PasswordResetModel.findByTempToken(tempToken);
            
            if (!resetToken) {
                return { success: false, error: 'Invalid or expired token' };
            }
            
            // Validate password strength
            const validation = AuthService.validatePasswordStrength(newPassword);
            if (!validation.valid) {
                return { success: false, error: validation.errors.join(', ') };
            }
            
            // Hash new password
            const hashedPassword = await AuthService.hashPassword(newPassword);
            
            // Update user password
            await UserModel.updatePassword(resetToken.user_id, hashedPassword);
            
            // Mark token as used
            await PasswordResetModel.markAsUsed(resetToken.id);
            
            // Invalidate all other reset tokens for this user
            await PasswordResetModel.invalidateAllUserTokens(resetToken.user_id);
            
            // Send confirmation email
            await this.sendPasswordChangedEmail(resetToken);
            
            logger.info(`Password reset successful for user: ${resetToken.username}`);
            
            return { success: true };
            
        } catch (error) {
            logger.error('Error resetting password:', error);
            return { success: false, error: 'Password reset failed' };
        }
    }
    
    // Send password changed confirmation
    static async sendPasswordChangedEmail(resetToken) {
        const subject = 'Password Changed Successfully - Capital Choice';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f8f9fa; }
                    .footer { text-align: center; padding: 10px; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Password Changed Successfully</h1>
                    </div>
                    <div class="content">
                        <p>Hello ${resetToken.name},</p>
                        <p>Your password has been successfully changed.</p>
                        <p><strong>Details:</strong></p>
                        <ul>
                            <li>Date: ${new Date().toLocaleString()}</li>
                            <li>IP Address: ${resetToken.ip_address || 'Unknown'}</li>
                        </ul>
                        <p>If you did not make this change, please contact support immediately.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Capital Choice. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        await microsoftEmailService.sendEmail(
            resetToken.email,
            subject,
            htmlContent
        );
    }
}

// Cleanup expired tokens periodically
setInterval(() => {
    PasswordResetModel.cleanupExpired().catch(err => 
        logger.error('Error in cleanup job:', err)
    );
}, 60 * 60 * 1000); // Every hour

module.exports = PasswordResetService;