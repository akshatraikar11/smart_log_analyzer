/**
 * Synthetic log dataset generator.
 *
 * Produces ~200-500 mostly-normal entries plus injected anomalies for
 * anomaly-detection testing. Output is written to /data as JSON (default)
 * or CSV.
 *
 * Usage:
 *   node scripts/generate-dataset.js
 *   node scripts/generate-dataset.js --format csv
 *   node scripts/generate-dataset.js --count 400 --anomalies 20
 */

const fs = require('fs/promises');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../data');

const SOURCES = ['auth-service', 'api-service', 'worker-service', 'payment-service', 'cache-service'];
const NORMAL_EVENT_TYPES = [
    'USER_LOGIN',
    'USER_LOGOUT',
    'API_REQUEST',
    'DATABASE_QUERY',
    'CACHE_HIT',
    'CACHE_MISS',
    'HEALTH_CHECK',
    'JOB_COMPLETED',
    'PAYMENT_PROCESSED',
];
const NORMAL_SEVERITIES = ['INFO', 'INFO', 'INFO', 'INFO', 'WARNING', 'DEBUG'];

const MESSAGES = {
    USER_LOGIN: 'User authenticated successfully',
    USER_LOGOUT: 'User session ended',
    API_REQUEST: 'Request handled successfully',
    DATABASE_QUERY: 'Query executed',
    CACHE_HIT: 'Cache entry found',
    CACHE_MISS: 'Cache entry missing',
    HEALTH_CHECK: 'Service health check passed',
    JOB_COMPLETED: 'Background job finished',
    PAYMENT_PROCESSED: 'Payment captured successfully',
};

function parseArgs(argv) {
    const args = {
        format: 'json',
        count: 380,
        anomalies: 20,
        includeMalformed: true,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--format' && argv[i + 1]) {
            args.format = argv[++i];
        } else if (arg === '--count' && argv[i + 1]) {
            args.count = Number(argv[++i]);
        } else if (arg === '--anomalies' && argv[i + 1]) {
            args.anomalies = Number(argv[++i]);
        } else if (arg === '--no-malformed') {
            args.includeMalformed = false;
        }
    }

    return args;
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function businessHourTimestamp(baseDate, dayOffset = 0) {
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    date.setUTCHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
    return date.toISOString();
}

function offsetTimestamp(isoTimestamp, minutesOffset) {
    const date = new Date(isoTimestamp);
    date.setTime(date.getTime() + minutesOffset * 60 * 1000);
    return date.toISOString();
}

function createLogEntry({ timestamp, event_type, severity, source, message, metadata = {} }) {
    return {
        timestamp,
        event_type,
        severity,
        source,
        message,
        metadata,
    };
}

function generateNormalEntries(count, baseDate) {
    const entries = [];

    for (let i = 0; i < count; i++) {
        const eventType = randomItem(NORMAL_EVENT_TYPES);
        const source = randomItem(SOURCES);
        const severity = randomItem(NORMAL_SEVERITIES);
        const dayOffset = Math.floor(i / 40);

        entries.push(
            createLogEntry({
                timestamp: businessHourTimestamp(baseDate, dayOffset),
                event_type: eventType,
                severity,
                source,
                message: `${MESSAGES[eventType]} (${source})`,
                metadata: {
                    requestId: `req-${1000 + i}`,
                    durationMs: Math.floor(Math.random() * 200) + 10,
                },
            })
        );
    }

    return entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function injectAnomalies(entries, anomalyCount, baseDate) {
    const anomalies = [];
    const anchor = entries[Math.floor(entries.length * 0.7)]?.timestamp || baseDate.toISOString();

    // 1) Repeated failures from a single source (packed inside 60s for Rule 1)
    for (let i = 0; i < 8; i++) {
        anomalies.push(
            createLogEntry({
                timestamp: offsetTimestamp(anchor, i * 0.1),
                event_type: 'DATABASE_ERROR',
                severity: i < 6 ? 'ERROR' : 'CRITICAL',
                source: 'api-service',
                message: `Database connection failure #${i + 1}`,
                metadata: {
                    retryAttempt: i + 1,
                    cluster: 'primary',
                    statusCode: 503,
                },
            })
        );
    }

    // 2) Request-rate spike
    for (let i = 0; i < 6; i++) {
        anomalies.push(
            createLogEntry({
                timestamp: offsetTimestamp(anchor, 15 + Math.floor(i / 3)),
                event_type: 'API_REQUEST',
                severity: 'INFO',
                source: 'api-service',
                message: `Spike traffic request ${i + 1}`,
                metadata: { spike: true, route: '/api/search' },
            })
        );
    }

    // 3) Off-hours activity
    for (let i = 0; i < 6; i++) {
        const offHours = new Date(baseDate);
        offHours.setUTCDate(offHours.getUTCDate() - 1);
        offHours.setUTCHours(2 + i, 15, 0, 0);

        anomalies.push(
            createLogEntry({
                timestamp: offHours.toISOString(),
                event_type: 'BACKGROUND_SYNC',
                severity: 'WARNING',
                source: 'worker-service',
                message: 'Unexpected off-hours sync job executed',
                metadata: { offHours: true, jobId: `sync-${i + 1}` },
            })
        );
    }

    // 4) Rare event types
    const rareEvents = [
        { event_type: 'SECURITY_SCAN_FAILED', severity: 'CRITICAL' },
        { event_type: 'VAULT_ACCESS_DENIED', severity: 'ERROR' },
        { event_type: 'CERTIFICATE_EXPIRED', severity: 'WARNING' },
        { event_type: 'PRIVILEGE_ESCALATION_ATTEMPT', severity: 'CRITICAL' },
    ];

    rareEvents.forEach((event, index) => {
        anomalies.push(
            createLogEntry({
                timestamp: offsetTimestamp(anchor, 45 + index),
                event_type: event.event_type,
                severity: event.severity,
                source: 'auth-service',
                message: `Rare event detected: ${event.event_type}`,
                metadata: { rareEvent: true },
            })
        );
    });

    // 5) Unusual severity for typically benign events
    anomalies.push(
        createLogEntry({
            timestamp: offsetTimestamp(anchor, 50),
            event_type: 'USER_LOGIN',
            severity: 'CRITICAL',
            source: 'auth-service',
            message: 'Login marked critical due to impossible travel pattern',
            metadata: { unusualSeverity: true },
        }),
        createLogEntry({
            timestamp: offsetTimestamp(anchor, 51),
            event_type: 'HEALTH_CHECK',
            severity: 'CRITICAL',
            source: 'cache-service',
            message: 'Health check returned critical for a normally stable service',
            metadata: { unusualSeverity: true },
        })
    );

    // Keep every anomaly category in the dataset. Cap only if the caller
    // asked for fewer rows than we generated (still prefer one of each type).
    const trimmed = anomalies.length <= anomalyCount
        ? anomalies
        : anomalies.slice(0, Math.max(anomalyCount, 20));

    return [...entries, ...trimmed].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function buildMalformedRows() {
    return [
        {
            event_type: 'MISSING_TIMESTAMP',
            severity: 'INFO',
            source: 'api-service',
            message: 'Row missing timestamp',
        },
        {
            timestamp: 'not-a-real-date',
            event_type: 'BAD_TIMESTAMP',
            severity: 'INFO',
            source: 'api-service',
            message: 'Row has malformed timestamp',
        },
        {
            timestamp: new Date().toISOString(),
            event_type: 'BAD_SEVERITY',
            severity: 'URGENT',
            source: 'api-service',
            message: 'Row has invalid severity',
        },
    ];
}

function toCsv(rows) {
    const headers = ['timestamp', 'event_type', 'severity', 'source', 'message', 'metadata'];
    const lines = [headers.join(',')];

    for (const row of rows) {
        const values = headers.map((header) => {
            const value = row[header];
            if (value === undefined || value === null) {
                return '';
            }
            if (header === 'metadata') {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value).replace(/"/g, '""')}"`;
        });
        lines.push(values.join(','));
    }

    return lines.join('\n');
}

async function main() {
    const args = parseArgs(process.argv);
    const baseDate = new Date();

    let entries = generateNormalEntries(args.count, baseDate);
    entries = injectAnomalies(entries, args.anomalies, baseDate);

    if (args.includeMalformed) {
        entries = [...entries, ...buildMalformedRows()];
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const basename = `synthetic-logs.${args.format === 'csv' ? 'csv' : 'json'}`;
    const outputPath = path.join(OUTPUT_DIR, basename);

    const payload =
        args.format === 'csv'
            ? toCsv(entries)
            : JSON.stringify(
                  {
                      generatedAt: new Date().toISOString(),
                      description: 'Synthetic log dataset with injected anomalies',
                      totalEntries: entries.length,
                      logs: entries,
                  },
                  null,
                  2
              );

    await fs.writeFile(outputPath, payload, 'utf8');

    console.log(`Generated ${entries.length} entries -> ${outputPath}`);
    console.log(`  Normal-ish baseline: ~${args.count}`);
    console.log(`  Injected anomalies: ~${args.anomalies}`);
    if (args.includeMalformed) {
        console.log('  Included malformed rows for validation testing');
    }
}

main().catch((error) => {
    console.error('Dataset generation failed:', error.message);
    process.exit(1);
});
