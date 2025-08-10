// Email template definitions for the Capital Choice Platform

const getBaseTemplate = (content) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
                background-color: #f5f5f5;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
            }
            .header p {
                margin: 5px 0 0;
                opacity: 0.9;
                font-size: 14px;
            }
            .content {
                padding: 30px 20px;
            }
            .content h2 {
                color: #333;
                font-size: 22px;
                margin-top: 0;
            }
            .content p {
                margin: 15px 0;
                color: #555;
            }
            .button {
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: 600;
                margin: 20px 0;
            }
            .button:hover {
                opacity: 0.9;
            }
            .info-box {
                background-color: #f8f9fa;
                border-left: 4px solid #667eea;
                padding: 15px;
                margin: 20px 0;
            }
            .info-box p {
                margin: 5px 0;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #666;
                font-size: 12px;
            }
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            .social-links {
                margin: 10px 0;
            }
            .social-links a {
                margin: 0 10px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            th, td {
                padding: 10px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            th {
                background-color: #f8f9fa;
                font-weight: 600;
            }
            .status-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 3px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }
            .status-pending { background-color: #ffc107; color: #000; }
            .status-approved { background-color: #28a745; color: #fff; }
            .status-rejected { background-color: #dc3545; color: #fff; }
            .status-completed { background-color: #17a2b8; color: #fff; }
        </style>
    </head>
    <body>
        <div class="container">
            ${content}
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Capital Choice Office Furniture. All rights reserved.</p>
                <p>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}">Visit Platform</a> |
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/help">Help Center</a> |
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/contact">Contact Us</a>
                </p>
                <div class="social-links">
                    <a href="#">LinkedIn</a>
                    <a href="#">Twitter</a>
                    <a href="#">Facebook</a>
                </div>
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

const templates = {
    welcome: (user) => {
        const content = `
            <div class="header">
                <h1>Welcome to Capital Choice!</h1>
                <p>Your trusted platform for office furniture installation bidding</p>
            </div>
            <div class="content">
                <h2>Hello ${user.name},</h2>
                <p>Welcome to the Capital Choice Bidding Platform! Your account has been successfully created.</p>
                
                <div class="info-box">
                    <p><strong>Account Details:</strong></p>
                    <p>Username: ${user.username}</p>
                    <p>Email: ${user.email}</p>
                    <p>Role: ${user.role.replace('_', ' ').toUpperCase()}</p>
                    <p>Company: ${user.company || 'Not specified'}</p>
                </div>
                
                <p>Your account is currently <span class="status-badge status-pending">pending approval</span>. An administrator will review your account shortly.</p>
                
                <p>Once approved, you'll be able to:</p>
                <ul>
                    <li>Access your personalized dashboard</li>
                    <li>Submit and manage bids</li>
                    <li>View project details</li>
                    <li>Communicate with project managers</li>
                    <li>Track your performance metrics</li>
                </ul>
                
                <p>You'll receive an email notification once your account is approved.</p>
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}" class="button">Visit Platform</a>
                </center>
            </div>
        `;
        return getBaseTemplate(content);
    },

    accountApproved: (user) => {
        const content = `
            <div class="header">
                <h1>Account Approved!</h1>
                <p>Your account is now active</p>
            </div>
            <div class="content">
                <h2>Congratulations ${user.name}!</h2>
                <p>Great news! Your account has been approved and is now fully active.</p>
                
                <p>You can now log in and start using all the features of the Capital Choice platform:</p>
                
                <ul>
                    <li>Browse available projects</li>
                    <li>Submit competitive bids</li>
                    <li>Manage your profile</li>
                    <li>Track your bid history</li>
                    <li>View analytics and reports</li>
                </ul>
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="button">Login Now</a>
                </center>
                
                <p>If you have any questions or need assistance, don't hesitate to contact our support team.</p>
            </div>
        `;
        return getBaseTemplate(content);
    },

    newBidReceived: (projectManager, project, bid, bidder) => {
        const content = `
            <div class="header">
                <h1>New Bid Received</h1>
                <p>A new bid has been submitted for your project</p>
            </div>
            <div class="content">
                <h2>Hello ${projectManager.name},</h2>
                <p>A new bid has been submitted for your project.</p>
                
                <div class="info-box">
                    <p><strong>Project Details:</strong></p>
                    <p>Title: ${project.title}</p>
                    <p>Location: ${project.zip_code}</p>
                    <p>Delivery Date: ${new Date(project.delivery_date).toLocaleDateString()}</p>
                </div>
                
                <table>
                    <tr>
                        <th>Bidder</th>
                        <th>Company</th>
                        <th>Bid Amount</th>
                        <th>Submitted</th>
                    </tr>
                    <tr>
                        <td>${bidder.name}</td>
                        <td>${bidder.company || 'N/A'}</td>
                        <td><strong>$${bid.amount.toLocaleString()}</strong></td>
                        <td>${new Date(bid.created_at).toLocaleDateString()}</td>
                    </tr>
                </table>
                
                ${bid.comments ? `
                <div class="info-box">
                    <p><strong>Bidder's Comments:</strong></p>
                    <p>${bid.comments}</p>
                </div>
                ` : ''}
                
                ${bid.alternate_delivery_date ? `
                <p><strong>Alternate Delivery Date Proposed:</strong> ${new Date(bid.alternate_delivery_date).toLocaleDateString()}</p>
                ` : ''}
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project.id}" class="button">View All Bids</a>
                </center>
                
                <p>You can review all bids and make a decision directly from your dashboard.</p>
            </div>
        `;
        return getBaseTemplate(content);
    },

    bidAccepted: (user, project, bid) => {
        const content = `
            <div class="header">
                <h1>Congratulations! Bid Accepted</h1>
                <p>Your bid has been selected</p>
            </div>
            <div class="content">
                <h2>Great news, ${user.name}!</h2>
                <p>Your bid has been accepted for the following project:</p>
                
                <div class="info-box">
                    <p><strong>Project Details:</strong></p>
                    <p>Title: ${project.title}</p>
                    <p>Location: ${project.zip_code}</p>
                    <p>Delivery Date: ${new Date(project.delivery_date).toLocaleDateString()}</p>
                    <p>Your Bid Amount: <strong>$${bid.amount.toLocaleString()}</strong></p>
                </div>
                
                <p>Next steps:</p>
                <ol>
                    <li>The project manager will contact you with additional details</li>
                    <li>Review and confirm all project requirements</li>
                    <li>Coordinate delivery and installation schedules</li>
                    <li>Complete the project by the specified deadline</li>
                </ol>
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project.id}" class="button">View Project Details</a>
                </center>
                
                <p>Thank you for your participation in the Capital Choice platform!</p>
            </div>
        `;
        return getBaseTemplate(content);
    },

    bidRejected: (user, project, bid) => {
        const content = `
            <div class="header">
                <h1>Bid Status Update</h1>
                <p>Your bid was not selected</p>
            </div>
            <div class="content">
                <h2>Hello ${user.name},</h2>
                <p>Thank you for submitting your bid for the following project:</p>
                
                <div class="info-box">
                    <p><strong>Project:</strong> ${project.title}</p>
                    <p><strong>Your Bid:</strong> $${bid.amount.toLocaleString()}</p>
                </div>
                
                <p>Unfortunately, your bid was not selected for this project. The project manager has chosen another contractor for this installation.</p>
                
                <p>Don't be discouraged! There are many more opportunities available on our platform. We encourage you to:</p>
                <ul>
                    <li>Continue submitting competitive bids</li>
                    <li>Ensure your profile is complete and up-to-date</li>
                    <li>Maintain high ratings on completed projects</li>
                    <li>Check the platform regularly for new projects</li>
                </ul>
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/projects" class="button">View Available Projects</a>
                </center>
                
                <p>Thank you for your continued participation!</p>
            </div>
        `;
        return getBaseTemplate(content);
    },

    projectCompleted: (user, project) => {
        const content = `
            <div class="header">
                <h1>Project Completed</h1>
                <p>Project has been marked as complete</p>
            </div>
            <div class="content">
                <h2>Project Completion Notice</h2>
                <p>Hello ${user.name},</p>
                
                <p>The following project has been marked as completed:</p>
                
                <div class="info-box">
                    <p><strong>Project:</strong> ${project.title}</p>
                    <p><strong>Location:</strong> ${project.zip_code}</p>
                    <p><strong>Completion Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                ${user.role === 'project_manager' ? `
                <p>As the project manager, you can now:</p>
                <ul>
                    <li>Rate the contractor's performance</li>
                    <li>Download project reports</li>
                    <li>Archive project documentation</li>
                </ul>
                ` : `
                <p>Thank you for your excellent work on this project. The project manager may provide a rating for your performance.</p>
                `}
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/projects/${project.id}" class="button">View Project</a>
                </center>
            </div>
        `;
        return getBaseTemplate(content);
    },

    passwordReset: (user, resetToken) => {
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        const content = `
            <div class="header">
                <h1>Password Reset Request</h1>
                <p>Reset your account password</p>
            </div>
            <div class="content">
                <h2>Hello ${user.name},</h2>
                <p>We received a request to reset your password for your Capital Choice account.</p>
                
                <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
                
                <center>
                    <a href="${resetUrl}" class="button">Reset Password</a>
                </center>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 3px;">
                    ${resetUrl}
                </p>
                
                <p><strong>If you didn't request this password reset, please ignore this email.</strong> Your password will remain unchanged.</p>
                
                <p>For security reasons, this link will expire in 1 hour.</p>
            </div>
        `;
        return getBaseTemplate(content);
    },

    newRating: (user, rating, project, rater) => {
        const overallRating = (
            (rating.price + rating.speed + rating.quality + rating.responsiveness + rating.customer_satisfaction) / 5
        ).toFixed(1);
        
        const content = `
            <div class="header">
                <h1>New Rating Received</h1>
                <p>You've received a performance rating</p>
            </div>
            <div class="content">
                <h2>Hello ${user.name},</h2>
                <p>You've received a new rating for your work on a recent project.</p>
                
                <div class="info-box">
                    <p><strong>Project:</strong> ${project.title}</p>
                    <p><strong>Rated by:</strong> ${rater.name}</p>
                    <p><strong>Overall Rating:</strong> ⭐ ${overallRating}/5.0</p>
                </div>
                
                <table>
                    <tr>
                        <th>Category</th>
                        <th>Rating</th>
                    </tr>
                    <tr>
                        <td>Price Competitiveness</td>
                        <td>⭐ ${rating.price}/5</td>
                    </tr>
                    <tr>
                        <td>Speed of Delivery</td>
                        <td>⭐ ${rating.speed}/5</td>
                    </tr>
                    <tr>
                        <td>Quality of Work</td>
                        <td>⭐ ${rating.quality}/5</td>
                    </tr>
                    <tr>
                        <td>Responsiveness</td>
                        <td>⭐ ${rating.responsiveness}/5</td>
                    </tr>
                    <tr>
                        <td>Customer Satisfaction</td>
                        <td>⭐ ${rating.customer_satisfaction}/5</td>
                    </tr>
                </table>
                
                ${rating.comments ? `
                <div class="info-box">
                    <p><strong>Comments:</strong></p>
                    <p>${rating.comments}</p>
                </div>
                ` : ''}
                
                <p>Ratings help build your reputation on the platform and can improve your chances of winning future bids.</p>
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/profile" class="button">View Your Profile</a>
                </center>
            </div>
        `;
        return getBaseTemplate(content);
    },

    weeklyReport: (user, stats) => {
        const content = `
            <div class="header">
                <h1>Weekly Activity Report</h1>
                <p>Your performance summary for the week</p>
            </div>
            <div class="content">
                <h2>Hello ${user.name},</h2>
                <p>Here's your weekly activity summary for the week ending ${new Date().toLocaleDateString()}:</p>
                
                <div class="info-box">
                    <p><strong>This Week's Statistics:</strong></p>
                    ${user.role === 'project_manager' ? `
                        <p>Projects Created: ${stats.projectsCreated || 0}</p>
                        <p>Projects Completed: ${stats.projectsCompleted || 0}</p>
                        <p>Total Bids Received: ${stats.bidsReceived || 0}</p>
                        <p>Projects Awarded: ${stats.projectsAwarded || 0}</p>
                    ` : `
                        <p>Bids Submitted: ${stats.bidsSubmitted || 0}</p>
                        <p>Bids Won: ${stats.bidsWon || 0}</p>
                        <p>Win Rate: ${stats.winRate || 0}%</p>
                        <p>Average Rating: ⭐ ${stats.averageRating || 'N/A'}/5</p>
                    `}
                </div>
                
                <p>Keep up the great work! Regular activity on the platform helps you achieve better results.</p>
                
                <center>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard" class="button">View Full Dashboard</a>
                </center>
            </div>
        `;
        return getBaseTemplate(content);
    }
};

module.exports = templates;