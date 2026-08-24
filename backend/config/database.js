/**
 * Database connection configuration
 * Manages PostgreSQL connection pool
 */

const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error if connection takes longer than 2 seconds
});

// Event handlers for monitoring
pool.on('connect', () => {
    console.log('🔌 New database connection established');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

// Helper function to execute queries with error handling
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log(`✓ Query executed in ${duration}ms:`, text.substring(0, 50));
        return result;
    } catch (error) {
        console.error('❌ Query error:', error.message);
        console.error('Query:', text);
        throw error;
    }
}

// Helper function to get a client for transactions
async function getClient() {
    return await pool.connect();
}

// Test database connection
async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
        console.log('✅ Database connection successful');
        console.log('   Time:', result.rows[0].current_time);
        console.log('   PostgreSQL version:', result.rows[0].postgres_version.split(',')[0]);
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Graceful shutdown
async function close() {
    await pool.end();
    console.log('🔌 Database connection pool closed');
}

module.exports = {
    query,
    getClient,
    pool,
    testConnection,
    close
};
