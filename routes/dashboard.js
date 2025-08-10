const express = require('express');
const router = express.Router();
const ProjectModel = require('../models/project');
const BidModel = require('../models/bid');
const UserModel = require('../models/user');
const NotificationModel = require('../models/notification');
const { authenticateToken, requireRole } = require('../middleware/auth');
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
        
        // Get notifications count
        dashboardData.unreadNotifications = await NotificationModel.getUnreadCount(req.user.id);
        
        res.json(dashboardData);
    } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get admin statistics
async function getAdminStats() {
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
}

// Get project manager statistics
async function getProjectManagerStats(userId) {
    return {
        totalProjects: await ProjectModel.getCountByManager(userId),
        draftProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'draft'),
        activeProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'bidding'),
        reviewingProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'reviewing'),
        awardedProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'awarded'),
        completedProjects: await ProjectModel.getCountByManagerAndStatus(userId, 'completed'),
        totalBidsReceived: await BidModel.getCountForManagerProjects(userId),
        completionRate: await ProjectModel.getCompletionRate(userId),
        projectsThisMonth: await ProjectModel.getCountByPeriod(30)
    };
}

// Get installation company statistics
async function getInstallationCompanyStats(userId) {
    const stats = {
        totalBids: await BidModel.getCountByUser(userId),
        pendingBids: await BidModel.getCountByUserAndStatus(userId, 'pending'),
        wonBids: await BidModel.getCountByUserAndStatus(userId, 'won'),
        lostBids: await BidModel.getCountByUserAndStatus(userId, 'lost'),
        winRate: await BidModel.getWinRate(userId),
        averageBidAmount: await BidModel.getAverageAmountByUser(userId),
        bidsThisMonth: await BidModel.getCountByPeriod(30)
    };
    
    const ratings = await UserModel.getAverageRating(userId);
    if (ratings) {
        stats.averageRating = ratings;
        stats.totalRatings = await UserModel.getRatingCount(userId);
    }
    
    return stats;
}

// Get admin recent activity
async function getAdminRecentActivity() {
    return {
        recentUsers: await UserModel.getRecent(5),
        recentProjects: await ProjectModel.getRecent(5),
        recentBids: await BidModel.getRecent(5),
        pendingUsers: await UserModel.getAll().then(users => 
            users.filter(u => !u.approved).slice(0, 5)
        )
    };
}

// Get project manager recent activity
async function getProjectManagerRecentActivity(userId) {
    return {
        recentProjects: await ProjectModel.getRecentByManager(userId, 5),
        recentBids: await BidModel.getRecentForManagerProjects(userId, 10),
        projectsNeedingReview: await ProjectModel.getByManager(userId).then(projects =>
            projects.filter(p => p.status === 'reviewing').slice(0, 5)
        ),
        upcomingDeadlines: await ProjectModel.getByManager(userId).then(projects =>
            projects.filter(p => {
                const dueDate = new Date(p.bid_due_date);
                const now = new Date();
                const daysDiff = (dueDate - now) / (1000 * 60 * 60 * 24);
                return daysDiff > 0 && daysDiff <= 7;
            }).slice(0, 5)
        )
    };
}

// Get installation company recent activity
async function getInstallationCompanyRecentActivity(userId) {
    const recentBids = await BidModel.getRecentByUser(userId, 10);
    const availableProjects = await ProjectModel.getByStatus('bidding');
    
    return {
        recentBids,
        availableProjects: availableProjects.slice(0, 10),
        wonProjects: recentBids.filter(b => b.status === 'won').slice(0, 5),
        upcomingDeliveries: await ProjectModel.getAll().then(projects =>
            projects.filter(p => {
                const deliveryDate = new Date(p.delivery_date);
                const now = new Date();
                const daysDiff = (deliveryDate - now) / (1000 * 60 * 60 * 24);
                return p.awarded_to === userId && daysDiff > 0 && daysDiff <= 30;
            }).slice(0, 5)
        )
    };
}

// Get chart data
router.get('/charts/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const { period = '30' } = req.query;
        
        let chartData;
        
        switch (type) {
            case 'projects-timeline':
                chartData = await getProjectsTimelineData(req.user, parseInt(period));
                break;
                
            case 'bids-analysis':
                chartData = await getBidsAnalysisData(req.user, parseInt(period));
                break;
                
            case 'user-growth':
                if (req.user.role !== 'admin') {
                    return res.status(403).json({ error: 'Access denied' });
                }
                chartData = await getUserGrowthData(parseInt(period));
                break;
                
            case 'revenue-analysis':
                chartData = await getRevenueAnalysisData(req.user, parseInt(period));
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

// Chart data functions
async function getProjectsTimelineData(user, days) {
    // Implementation would fetch and format project data for charts
    // This is a simplified version
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const data = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        data.push({
            date: d.toISOString().split('T')[0],
            created: Math.floor(Math.random() * 5),
            completed: Math.floor(Math.random() * 3)
        });
    }
    
    return {
        labels: data.map(d => d.date),
        datasets: [
            {
                label: 'Projects Created',
                data: data.map(d => d.created)
            },
            {
                label: 'Projects Completed',
                data: data.map(d => d.completed)
            }
        ]
    };
}

async function getBidsAnalysisData(user, days) {
    // Implementation would fetch and format bid data for charts
    return {
        labels: ['Won', 'Lost', 'Pending'],
        datasets: [{
            label: 'Bids',
            data: [
                await BidModel.getCountByUserAndStatus(user.id, 'won'),
                await BidModel.getCountByUserAndStatus(user.id, 'lost'),
                await BidModel.getCountByUserAndStatus(user.id, 'pending')
            ]
        }]
    };
}

async function getUserGrowthData(days) {
    // Implementation would fetch and format user growth data
    const data = [];
    for (let i = days; i >= 0; i--) {
        data.push({
            date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            users: Math.floor(Math.random() * 10) + 1
        });
    }
    
    return {
        labels: data.map(d => d.date),
        datasets: [{
            label: 'New Users',
            data: data.map(d => d.users)
        }]
    };
}

async function getRevenueAnalysisData(user, days) {
    // Implementation would fetch and format revenue data
    return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [{
            label: 'Revenue',
            data: [45000, 52000, 48000, 61000]
        }]
    };
}

module.exports = router;