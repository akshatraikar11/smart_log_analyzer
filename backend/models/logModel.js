/**
 * Log model — Prisma data-access layer for the logs table.
 */

const { prisma } = require('../config/prisma');

/**
 * Map a Prisma log record to the API shape used by other services.
 * @param {import('@prisma/client').Log} log
 */
function toApiLog(log) {
    return {
        id: log.id,
        timestamp: log.timestamp,
        event_type: log.eventType,
        severity: log.severity,
        source: log.source,
        message: log.message,
        metadata: log.metadata,
        created_at: log.createdAt,
    };
}

/**
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createLog(data) {
    const log = await prisma.log.create({
        data: {
            timestamp: data.timestamp,
            eventType: data.eventType,
            severity: data.severity,
            source: data.source,
            message: data.message ?? null,
            metadata: data.metadata ?? {},
        },
    });

    return toApiLog(log);
}

/**
 * @param {Object[]} records
 * @returns {Promise<Object[]>}
 */
async function createManyLogs(records) {
    if (records.length === 0) {
        return [];
    }

    const created = await prisma.log.createManyAndReturn({
        data: records.map((record) => ({
            timestamp: record.timestamp,
            eventType: record.eventType,
            severity: record.severity,
            source: record.source,
            message: record.message ?? null,
            metadata: record.metadata ?? {},
        })),
    });

    return created.map(toApiLog);
}

/**
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findLogById(id) {
    const log = await prisma.log.findUnique({ where: { id } });
    return log ? toApiLog(log) : null;
}

/**
 * @param {Object} options
 * @returns {Promise<{ logs: Object[], total: number, page: number, pageSize: number, totalPages: number }>}
 */
async function findLogs(options = {}) {
    const {
        page = 1,
        pageSize = 50,
        severity = null,
        source = null,
        flaggedOnly = false,
        startDate = null,
        endDate = null,
    } = options;

    const where = {};

    if (severity) {
        where.severity = severity.toUpperCase();
    }

    if (source) {
        where.source = source;
    }

    if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) {
            where.timestamp.gte = new Date(startDate);
        }
        if (endDate) {
            where.timestamp.lte = new Date(endDate);
        }
    }

    if (flaggedOnly) {
        where.anomalyFlag = { isNot: null };
    }

    const skip = (page - 1) * pageSize;

    const [total, rows] = await Promise.all([
        prisma.log.count({ where }),
        prisma.log.findMany({
            where,
            include: {
                anomalyFlag: {
                    select: {
                        anomalyScore: true,
                        detectionAlgorithm: true,
                    },
                },
            },
            orderBy: { timestamp: 'desc' },
            skip,
            take: pageSize,
        }),
    ]);

    const logs = rows.map((log) => ({
        ...toApiLog(log),
        is_flagged: Boolean(log.anomalyFlag),
        anomaly_score: log.anomalyFlag?.anomalyScore ?? null,
        detection_algorithm: log.anomalyFlag?.detectionAlgorithm ?? null,
    }));

    return {
        logs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    };
}

/**
 * Fetch logs for a source within a timestamp window (used by burst detection).
 * @param {string} source
 * @param {Date} windowStart
 * @param {Date} windowEnd
 */
async function findLogsBySourceInWindow(source, windowStart, windowEnd) {
    const rows = await prisma.log.findMany({
        where: {
            source,
            timestamp: {
                gte: windowStart,
                lte: windowEnd,
            },
        },
        select: {
            id: true,
            timestamp: true,
            eventType: true,
            severity: true,
            metadata: true,
        },
        orderBy: { timestamp: 'asc' },
    });

    return rows.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        event_type: log.eventType,
        severity: log.severity,
        metadata: log.metadata,
    }));
}

/**
 * Build event-type frequency counts for rare-event detection.
 * @returns {Promise<{ totalLogs: number, eventTypeCounts: Record<string, number> }>}
 */
async function getEventTypeCounts() {
    const grouped = await prisma.log.groupBy({
        by: ['eventType'],
        _count: { eventType: true },
    });

    const eventTypeCounts = {};
    let totalLogs = 0;

    for (const row of grouped) {
        eventTypeCounts[row.eventType] = row._count.eventType;
        totalLogs += row._count.eventType;
    }

    return { totalLogs, eventTypeCounts };
}

module.exports = {
    createLog,
    createManyLogs,
    findLogById,
    findLogs,
    findLogsBySourceInWindow,
    getEventTypeCounts,
    toApiLog,
};
