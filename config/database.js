// Database configuration
const path = require('path');

module.exports = {
    development: {
        dialect: 'sqlite',
        storage: path.join(__dirname, '..', 'database.sqlite'),
        logging: console.log,
        pool: {
            max: 5,
            min: 0,
            idle: 10000
        }
    },
    
    production: {
        dialect: 'sqlite',
        storage: process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite'),
        logging: false,
        pool: {
            max: 10,
            min: 2,
            idle: 10000
        }
    },
    
    test: {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
    },
    
    // MySQL configuration (alternative)
    mysql: {
        dialect: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        database: process.env.DB_NAME || 'capital_choice',
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        pool: {
            max: 10,
            min: 2,
            idle: 10000
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false
    },
    
    // PostgreSQL configuration (alternative)
    postgresql: {
        dialect: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'capital_choice',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        pool: {
            max: 10,
            min: 2,
            idle: 10000
        },
        logging: process.env.NODE_ENV === 'development' ? console.log : false
    }
};