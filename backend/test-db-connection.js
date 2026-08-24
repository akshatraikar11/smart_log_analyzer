/**
 * Quick Database Connection Test
 * Run: node test-db-connection.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
    console.log('🔍 Testing database connection...\n');
    console.log('Connection string:', process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@'));
    console.log('');

    try {
        // Test 1: Basic connection
        console.log('Test 1: Basic Connection');
        const result = await pool.query('SELECT NOW() as time, version() as version');
        console.log('✅ Connected successfully!');
        console.log('   Time:', result.rows[0].time);
        console.log('   PostgreSQL:', result.rows[0].version.split(',')[0]);
        console.log('');

        // Test 2: Check if database exists
        console.log('Test 2: Database Check');
        const dbCheck = await pool.query("SELECT current_database() as db");
        console.log('✅ Connected to database:', dbCheck.rows[0].db);
        console.log('');

        // Test 3: Check if tables exist
        console.log('Test 3: Tables Check');
        const tablesCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        if (tablesCheck.rows.length === 0) {
            console.log('⚠️  No tables found! Run: npm run db:init');
        } else {
            console.log('✅ Tables found:');
            tablesCheck.rows.forEach(row => {
                console.log('   -', row.table_name);
            });
        }
        console.log('');

        // Test 4: Check sample data
        console.log('Test 4: Sample Data Check');
        const logsCount = await pool.query('SELECT COUNT(*) as count FROM logs');
        const flagsCount = await pool.query('SELECT COUNT(*) as count FROM anomaly_flags');
        
        console.log('✅ Data found:');
        console.log('   - Logs:', logsCount.rows[0].count);
        console.log('   - Anomaly Flags:', flagsCount.rows[0].count);
        console.log('');

        // Test 5: Sample query
        console.log('Test 5: Sample Query');
        const sampleLogs = await pool.query('SELECT timestamp, severity, source FROM logs ORDER BY timestamp DESC LIMIT 3');
        console.log('✅ Recent logs:');
        sampleLogs.rows.forEach((log, i) => {
            console.log(`   ${i+1}. ${log.timestamp.toISOString().split('T')[1].split('.')[0]} - ${log.severity} - ${log.source}`);
        });
        console.log('');

        console.log('═══════════════════════════════════════');
        console.log('🎉 ALL TESTS PASSED!');
        console.log('Your database is connected and ready!');
        console.log('═══════════════════════════════════════');

    } catch (error) {
        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('❌ CONNECTION FAILED!');
        console.log('═══════════════════════════════════════');
        console.log('');
        console.log('Error:', error.message);
        console.log('');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Fix: PostgreSQL is not running');
            console.log('   Run: net start postgresql');
        } else if (error.code === '3D000') {
            console.log('💡 Fix: Database does not exist');
            console.log('   Run: psql -U postgres -c "CREATE DATABASE log_analyzer;"');
        } else if (error.code === '42P01') {
            console.log('💡 Fix: Tables do not exist');
            console.log('   Run: npm run db:init');
        } else if (error.code === '28P01') {
            console.log('💡 Fix: Wrong password');
            console.log('   Check your .env file DATABASE_URL');
        }
        
        console.log('');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testConnection();
