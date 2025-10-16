const express = require('express');
const router = express.Router();
const ProjectModel = require('../models/project');
const BidModel = require('../models/bid');
const UserModel = require('../models/user');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get dashboard data based on user role
router.get('/', authenticateToken, async (req, res) => {
    try {
        const dashboardData = {
            user: {
                id: req.user.id,
                name: req.user.name,
                role: req.user.role,
                company: req.user.company
            }
        };
        
        switch (req.user.role) {
            case 'admin':
                dashboardData.stats = await getAdminStats();
                dashboardData.recentActivity = await getAdminRecentActivity();
                break;
                
            case 'project_manager':
                dashboardData.stats = await getProjectManagerStats(req.user.id);
                dashboardData.recentActivity = await getProjectManagerRecentActivity(req.user.id);
                break;
                
            case 'installation_company':
            case 'operations':
                dashboardData.stats = await getInstallationCompanyStats(req.user.id);
                dashboardData.recentActivity = await getInstallationCompanyRecentActivity(req.user.id);
                break;
                
            default:
                return res.status(400).json({ error: 'Invalid user role' });
        }
        
        // Get notifications count (simplified)
        dashboardData.unreadNotifications = 0; // Placeholder until NotificationModel is implemented
        
        res.json(dashboardData);
    } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get admin statistics
async function getAdminStats() {
    try {
        return {
            totalUsers: await UserModel.getCount(),
            pendingApprovals: await UserModel.getCountPending(),
            totalProjects: await ProjectModel.getCount(),
            activeProjects: await ProjectModel.getCountByStatus('bidding'),
            completedProjects: await ProjectModel.getCountByStatus('completed'),
            totalBids: await BidModel.getCount(),
            newUsersThisMonth: await UserModel.getGrowthByPeriod(30),
            newProjectsThisMonth: await ProjectModel.getCountByPeriod(30),
            usersByRole: {
                admin: await UserModel.getCountByRole('admin'),
                project_manager: await UserModel.getCountByRole('project_manager'),
                installation_company: await UserModel.getCountByRole('installation_company'),
                operations: await UserModel.getCountByRole('operations')
            }
        };
    } catch (error) {
        logger.error('Error getting admin stats:', error);
        throw error;
    }
}

// Get project manager statistics - FIXED to use actual methods
async function getProjectManagerStats(userId) {
    try {
        const totalProjects = await ProjectModel.getCountByManager(userId);
        const completedProjects = await ProjectModel.getCountByManagerAndStatus(userId, 'completed');
        const completionRate = await ProjectModel.getCompletionRate(userId);
        
        return {
            // Main stats
            totalProjects: totalProjects,
            activeProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'bidding'),
            totalBidsReceived: await BidModel.getCountForManagerProjects(userId),
            completionRate: Math.round(completionRate),
            
            // Project status breakdown for overview
            draftProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'draft'),
            reviewingProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'reviewing'),
            awardedProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'awarded'),
            completedProjects: completedProjects,
            
            // Additional stats
            projectsThisMonth: await ProjectModel.getCountByPeriod(30)
        };
    } catch (error) {
        logger.error('Error getting project manager stats:', error);
        throw error;
    }
}

// Get installation company statistics
async function getInstallationCompanyStats(userId) {
    try {
        const totalBids = await BidModel.getCountByUser(userId);
        const wonBids = await BidModel.getCountByUserAndStatus(userId, 'won');
        const lostBids = await BidModel.getCountByUserAndStatus(userId, 'lost');
        const winRate = await BidModel.getWinRate(userId);
        
        return {
            totalBids: totalBids,
            pendingBids: await BidModel.getCountByUserAndStatus(userId, 'pending'),
            wonBids: wonBids,
            lostBids: lostBids,
            winRate: Math.round(winRate),
            averageBidAmount: await BidModel.getAverageAmountByUser(userId),
            bidsThisMonth: await BidModel.getCountByPeriod(30),
            averageRating: await UserModel.getAverageRating(userId),
            totalRatings: await UserModel.getRatingCount(userId)
        };
    } catch (error) {
        logger.error('Error getting installation company stats:', error);
        throw error;
    }
}

// Get admin recent activity
async function getAdminRecentActivity() {
    try {
        const users = await UserModel.getAll();
        const recentProjects = await ProjectModel.getRecent(5);
        const recentBids = await BidModel.getRecent(5);
        
        return {
            recentUsers: users.slice(0, 5), // Get first 5 users as "recent"
            recentProjects: recentProjects,
            recentBids: recentBids,
            pendingUsers: users.filter(u => !u.approved).slice(0, 5)
        };
    } catch (error) {
        logger.error('Error getting admin recent activity:', error);
        throw error;
    }
}

// Get project manager recent activity - FIXED to use actual methods
async function getProjectManagerRecentActivity(userId) {
    try {
        // Get the user's recent projects (last 3-5)
        const recentProjects = await ProjectModel.getRecentByManager(userId, 5);
        
        // Get recent bids for all of the manager's projects
        const recentBids = await BidModel.getRecentForManagerProjects(userId, 10);
        
        // Get projects that might need review (bidding phase ended)
        const allManagerProjects = await ProjectModel.getByManager(userId);
        const projectsNeedingReview = allManagerProjects.filter(p => {
            // Projects in bidding status where bid due date has passed
            if (p.status === 'bidding' && p.bid_due_date) {
                return new Date(p.bid_due_date) < new Date();
            }
            // Or projects in reviewing status
            return p.status === 'reviewing';
        }).slice(0, 5);
        
        // Get upcoming delivery deadlines
        const upcomingDeadlines = allManagerProjects.filter(p => {
            if (p.status === 'awarded' && p.delivery_date) {
                const deliveryDate = new Date(p.delivery_date);
                const daysDiff = (deliveryDate - new Date()) / (1000 * 60 * 60 * 24);
                return daysDiff > 0 && daysDiff <= 30; // Next 30 days
            }
            return false;
        }).sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date)).slice(0, 5);
        
        return {
            recentProjects: recentProjects,
            recentBids: recentBids,
            projectsNeedingReview: projectsNeedingReview,
            upcomingDeadlines: upcomingDeadlines
        };
    } catch (error) {
        logger.error('Error getting project manager recent activity:', error);
        // Return empty arrays as fallback
        return {
            recentProjects: [],
            recentBids: [],
            projectsNeedingReview: [],
            upcomingDeadlines: []
        };
    }
}

// Get installation company recent activity
async function getInstallationCompanyRecentActivity(userId) {
    try {
        const recentBids = await BidModel.getRecentByUser(userId, 10);
        const availableProjects = await ProjectModel.getByStatus('bidding');
        
        // Get all user bids and filter for won bids
        const allUserBids = await BidModel.getUserBids(userId);
        const wonBids = allUserBids.filter(b => b.status === 'won');
        const wonProjectIds = wonBids.map(b => b.project_id);
        const wonProjects = [];
        
        for (const projectId of wonProjectIds) {
            const project = await ProjectModel.getById(projectId);
            if (project) {
                wonProjects.push(project);
            }
        }
        
        // Get upcoming deliveries (won projects with future delivery dates)
        const upcomingDeliveries = wonProjects.filter(p => {
            if (p.delivery_date) {
                return new Date(p.delivery_date) > new Date();
            }
            return false;
        }).sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date)).slice(0, 5);
        
        return {
            recentBids: recentBids,
            availableProjects: availableProjects.slice(0, 10),
            wonProjects: wonProjects.slice(0, 5),
            upcomingDeliveries: upcomingDeliveries
        };
    } catch (error) {
        logger.error('Error getting installation company recent activity:', error);
        // Return empty arrays as fallback
        return {
            recentBids: [],
            availableProjects: [],
            wonProjects: [],
            upcomingDeliveries: []
        };
    }
}

module.exports = router;