/**
 * Database initialization script
 * Run this once to create tables and indexes
 * Usage: node database/init.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔌 Connected to PostgreSQL database');
        
        // Read the schema SQL file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('📝 Executing schema creation...');
        
        // Execute the schema SQL
        await client.query(schemaSql);
        
        console.log('✅ Database schema created successfully!');
        console.log('📊 Tables created:');
        console.log('   - logs');
        console.log('   - anomaly_flags');
        console.log('   - flagged_logs_view (view)');
        console.log('🎯 Sample data inserted for testing');
        
    } catch (error) {
        console.error('❌ Error initializing database:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
        console.log('🔌 Database connection closed');
    }
}

// Run initialization
initDatabase();
