/**
 * Socket.IO Manager
 *
 * Singleton that holds the io instance and exposes helpers to emit
 * real-time events from anywhere in the backend.
 *
 * Events emitted:
 *   log:new         – a new log was ingested
 *   anomaly:new     – a log was flagged as anomalous
 *   stats:update    – counters changed (after ingestion)
 *   ai:complete     – AI explanation finished for a flagged entry
 */

const { Server } = require('socket.io');

let io = null;

/**
 * Attach Socket.IO to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function init(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',           // match existing Express CORS policy
            methods: ['GET', 'POST'],
        },
        pingInterval: 25000,       // keep-alive every 25 s
        pingTimeout: 20000,
    });

    io.on('connection', (socket) => {
        console.log(`🔌 WS client connected  (id=${socket.id})`);

        socket.on('disconnect', (reason) => {
            console.log(`🔌 WS client disconnected (id=${socket.id}, reason=${reason})`);
        });
    });

    return io;
}

/** @returns {import('socket.io').Server | null} */
function getIO() {
    return io;
}

/* ── Emit helpers ─────────────────────────────────────────────── */

/**
 * Broadcast a new log entry to all connected clients.
 * @param {Object} log  – the persisted log row
 */
function emitNewLog(log) {
    if (!io) return;
    io.emit('log:new', {
        timestamp: new Date().toISOString(),
        log,
    });
}

/**
 * Broadcast when a log is flagged as anomalous.
 * @param {Object} log       – the original log row
 * @param {Object} detection – { score, reason, algorithm }
 */
function emitAnomaly(log, detection) {
    if (!io) return;
    io.emit('anomaly:new', {
        timestamp: new Date().toISOString(),
        log,
        detection,
    });
}

/**
 * Broadcast a stats snapshot so dashboards can update in-place.
 * @param {Object} stats
 */
function emitStatsUpdate(stats) {
    if (!io) return;
    io.emit('stats:update', {
        timestamp: new Date().toISOString(),
        stats,
    });
}

/**
 * Broadcast when an AI explanation finishes for a flagged entry.
 * @param {string} logId
 * @param {Object} explanation – { aiExplanation, aiRootCause, aiNextSteps }
 */
function emitAIComplete(logId, explanation) {
    if (!io) return;
    io.emit('ai:complete', {
        timestamp: new Date().toISOString(),
        logId,
        explanation,
    });
}

/**
 * Return the count of currently connected clients.
 */
function clientCount() {
    if (!io) return 0;
    return io.engine?.clientsCount ?? 0;
}

module.exports = {
    init,
    getIO,
    emitNewLog,
    emitAnomaly,
    emitStatsUpdate,
    emitAIComplete,
    clientCount,
};
