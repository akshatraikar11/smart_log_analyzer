/**
 * Live Log Stream Simulator
 *
 * Sends a continuous stream of realistic logs to the backend API every 1-3 seconds,
 * occasionally injecting anomalies (bursts, rare errors, deadlocks) so you can watch
 * the live WebSocket detection and UI updates in real time.
 */

const http = require('http');
const https = require('https');

const targetArg = process.argv[2] || process.env.API_URL || 'https://smart-log-analyzer-backend.onrender.com';
const parsedUrl = new URL(targetArg.startsWith('http') ? targetArg : `http://${targetArg}`);
const isHttps = parsedUrl.protocol === 'https:';
const client = isHttps ? https : http;

const API_HOST = parsedUrl.hostname;
const API_PORT = parsedUrl.port || (isHttps ? 443 : 80);
const API_PATH = parsedUrl.pathname.replace(/\/+$/, '') + '/api/logs/ingest';

const SOURCES = ['auth-service', 'payment-gateway', 'order-processor', 'inventory-db', 'api-gateway', 'email-worker'];
const NORMAL_EVENTS = ['USER_LOGIN', 'ORDER_CREATED', 'PAYMENT_PROCESSED', 'TOKEN_REFRESHED', 'CACHE_HIT', 'HEARTBEAT'];

const ANOMALY_TEMPLATES = [
    {
        event_type: 'DATABASE_DEADLOCK',
        severity: 'CRITICAL',
        source: 'payment-gateway',
        message: 'Fatal: deadlock detected on table "orders_lock" during checkout transaction'
    },
    {
        event_type: 'AUTH_BURST_FAILURE',
        severity: 'ERROR',
        source: 'auth-service',
        message: 'Multiple failed password attempts for user admin from IP 198.51.100.42'
    },
    {
        event_type: 'MEMORY_LIMIT_EXCEEDED',
        severity: 'CRITICAL',
        source: 'order-processor',
        message: 'Heap out of memory: heap used 1.8GB / limit 2.0GB'
    },
    {
        event_type: 'RARE_SECURITY_ALERT',
        severity: 'WARNING',
        source: 'api-gateway',
        message: 'Unusual HTTP method PROPFIND received from untrusted subnet'
    }
];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sendLog(logData) {
    const payload = JSON.stringify(logData);

    const req = client.request(
        {
            hostname: API_HOST,
            port: API_PORT,
            path: API_PATH.startsWith('/api') ? API_PATH : `/api${API_PATH}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        },
        (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const isAnomaly = logData.severity === 'CRITICAL' || logData.severity === 'ERROR';
                    const icon = isAnomaly ? '🚨 [ANOMALY SENT]' : '📝 [NORMAL LOG]';
                    console.log(`${icon} (${logData.severity}) ${logData.source} -> ${logData.event_type}`);
                } else {
                    console.error(`❌ Ingestion error (${res.statusCode}):`, body);
                }
            });
        }
    );

    req.on('error', (err) => {
        console.error(`⚠️ Failed to connect to API on port ${API_PORT}:`, err.message);
    });

    req.write(payload);
    req.end();
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           🚀 Live Log Stream Simulator Started                 ║');
console.log('║                                                                ║');
console.log('║  Streaming logs to http://localhost:3000/api/logs/ingest       ║');
console.log('║  Watch your browser at http://localhost:5173 for live updates! ║');
console.log('║  Press Ctrl+C to stop stream.                                  ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

let counter = 0;

function tick() {
    counter++;
    const isAnomalyTick = counter % 4 === 0; // Trigger an anomaly every ~4 logs

    let log;
    if (isAnomalyTick) {
        const template = getRandomItem(ANOMALY_TEMPLATES);
        log = {
            timestamp: new Date().toISOString(),
            ...template
        };
    } else {
        const severity = Math.random() > 0.8 ? 'WARNING' : 'INFO';
        const source = getRandomItem(SOURCES);
        const event_type = getRandomItem(NORMAL_EVENTS);
        log = {
            timestamp: new Date().toISOString(),
            event_type,
            severity,
            source,
            message: `Normal operational event: ${event_type} handled successfully`
        };
    }

    sendLog(log);

    // Random delay between 1.5s and 3.5s for natural streaming feel
    const nextDelay = Math.floor(Math.random() * 2000) + 1500;
    setTimeout(tick, nextDelay);
}

// Start simulation loop
tick();
