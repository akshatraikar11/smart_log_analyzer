const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
        console.log('uuid-ossp extension created');
    } catch (e) {
        console.error('Extension error:', e.message);
    }
    await pool.end();
}

main();
