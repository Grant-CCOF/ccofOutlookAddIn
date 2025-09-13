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

            // Check if database is already initialized
            const userCount = await this.get('SELECT COUNT(*) as count FROM users');
            
            if (userCount && userCount.count > 0) {
                logger.info('Database already initialized, skipping seed');
                return true;
            }
            
            // Finally seed data
            await this.seedDefaultData();
            
            logger.info('Database initialization completed successfully');
            return true;
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
                    
                    // Configure SQLite for better concurrency and performance
                    this.db.serialize(() => {
                        // Enable WAL mode for better concurrent access
                        this.db.run("PRAGMA journal_mode = WAL", (err) => {
                            if (err) logger.warn('Could not set WAL mode:', err);
                            else logger.info('WAL mode enabled');
                        });
                        
                        // Set busy timeout to 5 seconds (5000ms)
                        this.db.run("PRAGMA busy_timeout = 5000", (err) => {
                            if (err) logger.warn('Could not set busy timeout:', err);
                            else logger.info('Busy timeout set to 5000ms');
                        });
                        
                        // Optimize SQLite performance
                        this.db.run("PRAGMA synchronous = NORMAL");
                        this.db.run("PRAGMA cache_size = -64000"); // 64MB cache
                        this.db.run("PRAGMA temp_store = MEMORY");
                        this.db.run("PRAGMA mmap_size = 30000000000"); // 30GB mmap
                        
                        // Foreign keys support
                        this.db.run("PRAGMA foreign_keys = ON");
                        
                        resolve();
                    });
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

            `CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                verification_code TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME,
                attempts INTEGER DEFAULT 0,
                ip_address TEXT,
                user_agent TEXT,
                temp_token TEXT,
                temp_token_expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`,
            
            `CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                project_manager_id INTEGER,
                zip_code TEXT,
                delivery_date DATETIME,
                delivery_time DATETIME,
                bid_due_date DATETIME,
                max_bid DECIMAL(10,2),
                show_max_bid INTEGER DEFAULT 1,
                site_conditions TEXT,
                custom_fields TEXT,
                special_instructions TEXT,
                training_requirements TEXT,
                access_control_info TEXT,
                product_care_info TEXT,
                scope_options TEXT,
                site_info_options TEXT,
                requirements_options TEXT,
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
                award_comment TEXT,
                bid_number INTEGER DEFAULT 1,
                is_test_bid INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(project_id, user_id, bid_number)
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
                user_id INTEGER,
                file_type TEXT DEFAULT 'general',
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (bid_id) REFERENCES bids(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
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
            `CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(rated_user_id)`,
            `CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash)`,
            `CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens(expires_at)`,
            `CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id)`
        ];

        for (const query of queries) {
            await this.run(query);
        }
        
        logger.info('Database tables created successfully');
    }

    async seedDefaultData() {
        try {
            logger.info('Starting seed data process...');
            
            // Add a small delay to ensure tables are created
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Use IMMEDIATE transaction to avoid lock conflicts
            await this.run('BEGIN IMMEDIATE TRANSACTION');
            
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
            } else if (error.code === 'SQLITE_BUSY') {
                logger.warn('Database busy during seeding, but this is non-critical');
            } else {
                logger.warn('Non-critical error during data seeding:', error.message);
            }
        }
    }

    run(sql, params = [], maxRetries = 3) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            
            const executeQuery = () => {
                this.db.run(sql, params, function(err) {
                    if (err) {
                        if (err.code === 'SQLITE_BUSY' && attempts < maxRetries) {
                            attempts++;
                            logger.warn(`Database busy, retrying... (attempt ${attempts}/${maxRetries})`);
                            setTimeout(executeQuery, 100 * attempts); // Exponential backoff
                        } else {
                            logger.error('Database run error:', err);
                            logger.error('SQL:', sql);
                            logger.error('Params:', params);
                            reject(err);
                        }
                    } else {
                        resolve({ id: this.lastID, changes: this.changes });
                    }
                });
            };
            
            executeQuery();
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