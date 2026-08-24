/**
 * Anomaly flag model — Prisma data-access layer for anomaly_flags.
 */

const { prisma } = require('../config/prisma');

/**
 * @param {import('@prisma/client').AnomalyFlag} flag
 */
function toApiFlag(flag) {
    return {
        id: flag.id,
        log_id: flag.logId,
        anomaly_score: flag.anomalyScore,
        detection_reason: flag.detectionReason,
        detection_algorithm: flag.detectionAlgorithm,
        ai_explanation: flag.aiExplanation,
        ai_root_cause: flag.aiRootCause,
        ai_next_steps: flag.aiNextSteps,
        flagged_at: flag.flaggedAt,
        ai_processed_at: flag.aiProcessedAt,
    };
}

/**
 * Persist or merge an anomaly flag for a log entry.
 * @param {string} logId
 * @param {{ score: number, reason: string, algorithm: string }} data
 */
async function saveFlag(logId, { score, reason, algorithm }) {
    const existing = await prisma.anomalyFlag.findUnique({
        where: { logId },
    });

    if (!existing) {
        const created = await prisma.anomalyFlag.create({
            data: {
                logId,
                anomalyScore: score,
                detectionReason: reason,
                detectionAlgorithm: algorithm,
            },
        });

        return toApiFlag(created);
    }

    const mergedScore = Math.max(Number(existing.anomalyScore), score);
    const mergedReason = existing.detectionReason.includes(reason)
        ? existing.detectionReason
        : `${existing.detectionReason}; ${reason}`;
    const mergedAlgorithm = existing.detectionAlgorithm.includes(algorithm)
        ? existing.detectionAlgorithm
        : `${existing.detectionAlgorithm}, ${algorithm}`;

    const updated = await prisma.anomalyFlag.update({
        where: { logId },
        data: {
            anomalyScore: mergedScore,
            detectionReason: mergedReason,
            detectionAlgorithm: mergedAlgorithm,
        },
    });

    return toApiFlag(updated);
}

/**
 * Fetch a flagged log entry with its anomaly details.
 * @param {string} logId
 */
async function findFlagWithLogByLogId(logId) {
    const flag = await prisma.anomalyFlag.findUnique({
        where: { logId },
        include: { log: true },
    });

    if (!flag) {
        return null;
    }

    const { toApiLog } = require('./logModel');

    return {
        flag: toApiFlag(flag),
        log: toApiLog(flag.log),
    };
}

/**
 * Persist AI-generated (or fallback) explanation fields on a flag.
 * @param {string} logId
 * @param {{ explanation: string, rootCause: string, nextSteps: string }} aiResult
 */
async function saveAiExplanation(logId, { explanation, rootCause, nextSteps }) {
    const updated = await prisma.anomalyFlag.update({
        where: { logId },
        data: {
            aiExplanation: explanation,
            aiRootCause: rootCause,
            aiNextSteps: nextSteps,
            aiProcessedAt: new Date(),
        },
    });

    return toApiFlag(updated);
}

/**
 * Log IDs for flags that have not yet received an AI explanation.
 * @returns {Promise<string[]>}
 */
async function getUnprocessedLogIds() {
    const flags = await prisma.anomalyFlag.findMany({
        where: { aiProcessedAt: null },
        select: { logId: true },
        orderBy: { flaggedAt: 'desc' },
    });

    return flags.map((flag) => flag.logId);
}

module.exports = {
    saveFlag,
    saveAiExplanation,
    findFlagWithLogByLogId,
    getUnprocessedLogIds,
    toApiFlag,
};
