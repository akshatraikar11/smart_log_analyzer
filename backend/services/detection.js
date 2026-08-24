/**
 * Anomaly Detection Service
 *
 * Orchestrates four deterministic, named rules. No LLM involvement.
 * DB writes go through Prisma models only.
 */

const logModel = require('../models/logModel');
const anomalyFlagModel = require('../models/anomalyFlagModel');
const detectionConfig = require('./detection/config');

const ruleFailedRequestBurst = require('./detection/rules/ruleFailedRequestBurst');
const ruleHighSeverity = require('./detection/rules/ruleHighSeverity');
const ruleRareEventType = require('./detection/rules/ruleRareEventType');
const ruleOffHoursActivity = require('./detection/rules/ruleOffHoursActivity');

const RULES = [
    ruleFailedRequestBurst,
    ruleHighSeverity,
    ruleRareEventType,
    ruleOffHoursActivity,
];

/**
 * Build shared context (corpus stats + config) for a detection run.
 * @returns {Promise<Object>}
 */
async function buildDetectionContext() {
    const { totalLogs, eventTypeCounts } = await logModel.getEventTypeCounts();

    return {
        config: detectionConfig,
        totalLogs,
        eventTypeCounts,
    };
}

/**
 * Run all detection rules against a single log entry.
 * @param {Object} log
 * @param {Object} [context]
 * @returns {Promise<Object[]>}
 */
async function detectAnomalies(log, context = null) {
    const ctx = context || (await buildDetectionContext());
    const detections = [];

    for (const rule of RULES) {
        const result = await rule(log, ctx);
        if (result?.triggered) {
            detections.push(result);
        }
    }

    return detections;
}

/**
 * Combine triggered rules into a weighted composite score (capped at 100).
 * @param {Object[]} detections
 * @returns {{ score: number, reason: string, algorithm: string }}
 */
function combineDetections(detections) {
    const score = Math.min(
        100,
        detections.reduce((sum, detection) => sum + detection.score, 0)
    );

    return {
        score: parseFloat(score.toFixed(2)),
        reason: detections.map((d) => d.reason).join('; '),
        algorithm: detections.map((d) => d.rule).join(', '),
    };
}

/**
 * Persist an anomaly flag for a log entry.
 * @param {string} logId
 * @param {Object} detection
 */
async function flagLogEntry(logId, detection) {
    return anomalyFlagModel.saveFlag(logId, {
        score: detection.score,
        reason: detection.reason,
        algorithm: detection.algorithm,
    });
}

/**
 * Analyze one log and persist a flag when any rule triggers.
 * @param {Object} log
 * @param {Object} [context]
 */
async function analyzeAndFlag(log, context = null) {
    const detections = await detectAnomalies(log, context);

    if (detections.length === 0) {
        return {
            flagged: false,
            detections: [],
        };
    }

    const combined = combineDetections(detections);
    const flag = await flagLogEntry(log.id, combined);

    return {
        flagged: true,
        detections,
        flag,
    };
}

/**
 * Analyze a batch of logs, reusing one shared context for efficiency.
 * @param {Object[]} logs
 */
async function batchAnalyze(logs) {
    const context = await buildDetectionContext();
    const results = [];
    let flaggedCount = 0;

    for (const log of logs) {
        const result = await analyzeAndFlag(log, context);
        results.push({
            logId: log.id,
            ...result,
        });

        if (result.flagged) {
            flaggedCount++;
        }
    }

    return {
        total: logs.length,
        flaggedCount,
        results,
    };
}

module.exports = {
    detectAnomalies,
    analyzeAndFlag,
    batchAnalyze,
    flagLogEntry,
    buildDetectionContext,
    combineDetections,
    RULES,
    // Individual rules — exported for demos and unit tests
    ruleFailedRequestBurst,
    ruleHighSeverity,
    ruleRareEventType,
    ruleOffHoursActivity,
};
