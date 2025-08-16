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

// Get admin statistics (simplified to use only existing methods)
async function getAdminStats() {
    try {
        return {
            totalUsers: await UserModel.getCount(),
            pendingApprovals: await UserModel.getCountPending(),
            totalProjects: await ProjectModel.getCount(),
            activeProjects: await ProjectModel.getCountByStatus('bidding'),
            completedProjects: await ProjectModel.getCountByStatus('completed'),
            totalBids: await BidModel.getCount(),
            // Simplified stats - using placeholder values for missing methods
            newUsersThisMonth: 0, // TODO: Implement UserModel.getGrowthByPeriod(30)
            newProjectsThisMonth: 0, // TODO: Implement ProjectModel.getCountByPeriod(30)
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

// Get project manager statistics (simplified)
async function getProjectManagerStats(userId) {
    try {
        // For now, return simplified stats since many methods don't exist yet
        return {
            totalProjects: 0, // TODO: Implement ProjectModel.getCountByManager(userId)
            draftProjects: 0, // TODO: Implement ProjectModel.getCountByManagerAndStatus(userId, 'draft')
            activeProjects: 0, // TODO: Implement ProjectModel.getCountByManagerAndStatus(userId, 'bidding')
            reviewingProjects: 0, // TODO: Implement ProjectModel.getCountByManagerAndStatus(userId, 'reviewing')
            awardedProjects: 0, // TODO: Implement ProjectModel.getCountByManagerAndStatus(userId, 'awarded')
            completedProjects: 0, // TODO: Implement ProjectModel.getCountByManagerAndStatus(userId, 'completed')
            totalBidsReceived: 0, // TODO: Implement BidModel.getCountForManagerProjects(userId)
            completionRate: 0, // TODO: Implement ProjectModel.getCompletionRate(userId)
            projectsThisMonth: 0 // TODO: Implement ProjectModel.getCountByPeriod(30)
        };
    } catch (error) {
        logger.error('Error getting project manager stats:', error);
        throw error;
    }
}

// Get installation company statistics (simplified)
async function getInstallationCompanyStats(userId) {
    try {
        return {
            totalBids: await BidModel.getCountByUser(userId),
            pendingBids: 0, // TODO: Implement BidModel.getCountByUserAndStatus(userId, 'pending')
            wonBids: 0, // TODO: Implement BidModel.getCountByUserAndStatus(userId, 'won')
            lostBids: 0, // TODO: Implement BidModel.getCountByUserAndStatus(userId, 'lost')
            winRate: await BidModel.getWinRate(userId),
            averageBidAmount: 0, // TODO: Implement BidModel.getAverageAmountByUser(userId)
            bidsThisMonth: 0, // TODO: Implement BidModel.getCountByPeriod(30)
            averageRating: 0, // TODO: Implement UserModel.getAverageRating(userId)
            totalRatings: 0 // TODO: Implement UserModel.getRatingCount(userId)
        };
    } catch (error) {
        logger.error('Error getting installation company stats:', error);
        throw error;
    }
}

// Get admin recent activity (simplified)
async function getAdminRecentActivity() {
    try {
        const users = await UserModel.getAll();
        return {
            recentUsers: users.slice(0, 5), // Get first 5 users as "recent"
            recentProjects: [], // TODO: Implement ProjectModel.getRecent(5)
            recentBids: [], // TODO: Implement BidModel.getRecent(5)
            pendingUsers: users.filter(u => !u.approved).slice(0, 5)
        };
    } catch (error) {
        logger.error('Error getting admin recent activity:', error);
        throw error;
    }
}

// Get project manager recent activity (simplified)
async function getProjectManagerRecentActivity(userId) {
    try {
        return {
            recentProjects: [], // TODO: Implement ProjectModel.getRecentByManager(userId, 5)
            recentBids: [], // TODO: Implement BidModel.getRecentForManagerProjects(userId, 10)
            projectsNeedingReview: [], // TODO: Implement logic for projects needing review
            upcomingDeadlines: [] // TODO: Implement logic for upcoming deadlines
        };
    } catch (error) {
        logger.error('Error getting project manager recent activity:', error);
        throw error;
    }
}

// Get installation company recent activity (simplified)
async function getInstallationCompanyRecentActivity(userId) {
    try {
        return {
            recentBids: [], // TODO: Implement BidModel.getRecentByUser(userId, 10)
            availableProjects: [], // TODO: Implement ProjectModel.getByStatus('bidding')
            wonProjects: [], // TODO: Implement logic for won projects
            upcomingDeliveries: [] // TODO: Implement logic for upcoming deliveries
        };
    } catch (error) {
        logger.error('Error getting installation company recent activity:', error);
        throw error;
    }
}

// Chart data endpoints (simplified)
router.get('/charts/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const { days = 30 } = req.query;
        
        let chartData;
        
        switch (type) {
            case 'projects':
                chartData = await getProjectsChartData(req.user, parseInt(days));
                break;
            case 'bids':
                chartData = await getBidsChartData(req.user, parseInt(days));
                break;
            case 'users':
                if (req.user.role !== 'admin') {
                    return res.status(403).json({ error: 'Access denied' });
                }
                chartData = await getUsersChartData(parseInt(days));
                break;
            case 'revenue':
                chartData = await getRevenueChartData(req.user, parseInt(days));
                break;
            default:
                return res.status(400).json({ error: 'Invalid chart type' });
        }
        
        res.json(chartData);
    } catch (error) {
        logger.error('Error fetching chart data:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
});

// Simplified chart data functions (placeholder data)
async function getProjectsChartData(user, days) {
    // Return sample data until proper implementation
    return {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Projects Created',
                data: [5, 3, 8, 2, 6, 4]
            },
            {
                label: 'Projects Completed', 
                data: [2, 5, 3, 7, 1, 8]
            }
        ]
    };
}

async function getBidsChartData(user, days) {
    // Return sample data until proper implementation
    return {
        labels: ['Won', 'Lost', 'Pending'],
        datasets: [{
            label: 'Bids',
            data: [12, 8, 5]
        }]
    };
}

async function getUsersChartData(days) {
    // Return sample data until proper implementation
    return {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
            label: 'New Users',
            data: [3, 7, 2, 5]
        }]
    };
}

async function getRevenueChartData(user, days) {
    // Return sample data until proper implementation
    return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [{
            label: 'Revenue',
            data: [45000, 52000, 48000, 61000]
        }]
    };
}

module.exports = router;