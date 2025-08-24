const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', process.env.DATABASE_PATH || 'database.sqlite');
        this.initializePromise = null; // Track initialization state
    }

    async initialize() {
        // Prevent double initialization
        if (this.initializePromise) {
            logger.info('Database initialization already in progress, waiting...');
            return this.initializePromise;
        }

        // Create and store the initialization promise
        this.initializePromise = this._doInitialize();
        return this.initializePromise;
    }

    async _doInitialize() {
        try {
            // First, open the database connection
            await this._openDatabase();
            
            // Then create tables
            await this.createTables();
            
            // Finally seed data
            await this.seedDefaultData();
            
            logger.info('Database initialization completed successfully');
        } catch (error) {
            logger.error('Database initialization failed:', error);
            this.initializePromise = null; // Reset so it can be retried
            throw error;
        }
    }

    _openDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Error opening database:', err);
                    reject(err);
                } else {
                    logger.info('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async createTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                role TEXT CHECK(role IN ('admin', 'project_manager', 'installation_company', 'operations')) NOT NULL,
                company TEXT,
                phone TEXT,
                position TEXT,
                approved INTEGER DEFAULT 0,
                suspended INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME
            )`,
            
            `CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                project_manager_id INTEGER,
                zip_code TEXT,
                delivery_date DATE,
                delivery_time TEXT,
                bid_due_date DATETIME,
                max_bid DECIMAL(10,2),
                show_max_bid INTEGER DEFAULT 1,
                site_conditions TEXT,
                custom_fields TEXT,
                awarded_to INTEGER,
                awarded_amount DECIMAL(10,2),
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_manager_id) REFERENCES users(id),
                FOREIGN KEY (awarded_to) REFERENCES users(id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS bids (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                comments TEXT,
                alternate_delivery_date DATE,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(project_id, user_id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                type TEXT,
                data TEXT,
                read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_name TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                mime_type TEXT,
                uploaded_by INTEGER NOT NULL,
                project_id INTEGER,
                bid_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (bid_id) REFERENCES bids(id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                rated_user_id INTEGER NOT NULL,
                rated_by_user_id INTEGER NOT NULL,
                price INTEGER CHECK(price >= 1 AND price <= 5),
                speed INTEGER CHECK(speed >= 1 AND speed <= 5),
                quality INTEGER CHECK(quality >= 1 AND quality <= 5),
                responsiveness INTEGER CHECK(responsiveness >= 1 AND responsiveness <= 5),
                customer_satisfaction INTEGER CHECK(customer_satisfaction >= 1 AND customer_satisfaction <= 5),
                comments TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (rated_user_id) REFERENCES users(id),
                FOREIGN KEY (rated_by_user_id) REFERENCES users(id),
                UNIQUE(project_id, rated_user_id, rated_by_user_id)
            )`,
            
            `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
            `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
            `CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`,
            `CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id)`,
            `CREATE INDEX IF NOT EXISTS idx_bids_project ON bids(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_bids_user ON bids(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id)`,
            `CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(rated_user_id)`
        ];

        for (const query of queries) {
            await this.run(query);
        }
        
        logger.info('Database tables created successfully');
    }

    async seedDefaultData() {
        try {
            logger.info('Starting seed data process...');
            
            // Use a transaction to ensure atomicity
            await this.run('BEGIN TRANSACTION');
            
            try {
                // Check if admin exists by username OR email
                const adminCheck = await this.get(
                    'SELECT id, username, email FROM users WHERE username = ? OR email = ?', 
                    ['admin', 'admin@capitalchoice.com']
                );
                
                if (!adminCheck) {
                    logger.info('No admin user found, creating default admin...');
                    
                    const hashedPassword = await bcrypt.hash(
                        process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 
                        10
                    );
                    
                    await this.run(
                        `INSERT INTO users (username, password, name, email, role, approved, suspended) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        ['admin', hashedPassword, 'System Administrator', 'admin@capitalchoice.com', 'admin', 1, 0]
                    );
                    
                    logger.info('Default admin user created successfully');
                    logger.info('Login with username: admin, password: admin123');
                } else {
                    logger.info(`Admin user already exists (username: ${adminCheck.username}, email: ${adminCheck.email})`);
                }
                
                await this.run('COMMIT');
                
            } catch (error) {
                await this.run('ROLLBACK');
                throw error;
            }
            
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT') {
                logger.info('Admin user already exists in database - skipping creation');
            } else {
                logger.warn('Non-critical error during data seeding:', error.message);
            }
        }
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    logger.error('Database run error:', err);
                    logger.error('Stack trace:', new Error().stack);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    logger.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Database all error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }
            
            this.db.close((err) => {
                if (err) {
                    logger.error('Error closing database:', err);
                    reject(err);
                } else {
                    logger.info('Database connection closed');
                    this.db = null;
                    this.initializePromise = null;
                    resolve();
                }
            });
        });
    }
}

module.exports = new Database();