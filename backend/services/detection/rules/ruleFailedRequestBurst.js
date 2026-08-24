/**
 * Rule 1 — Failed request burst
 *
 * Flags a log when its source records more than N failed (4xx/5xx) requests
 * within a T-second window ending at the log's timestamp.
 */

const logModel = require('../../../models/logModel');
const { isFailedRequest } = require('../helpers');

/**
 * @param {Object} log
 * @param {Object} context
 * @returns {Promise<Object|null>}
 */
async function ruleFailedRequestBurst(log, context) {
    const { threshold, windowSeconds, weight } = context.config.failedRequestBurst;
    const logTime = new Date(log.timestamp);
    const windowStart = new Date(logTime.getTime() - windowSeconds * 1000);

    const windowLogs = await logModel.findLogsBySourceInWindow(
        log.source,
        windowStart,
        logTime
    );

    const failedCount = windowLogs.filter(isFailedRequest).length;

    if (failedCount <= threshold) {
        return null;
    }

    const score = Math.min(weight, Math.round(weight * (failedCount / threshold)));

    return {
        triggered: true,
        rule: 'failed_request_burst',
        score,
        reason: `Source "${log.source}" recorded ${failedCount} failed requests (4xx/5xx) within ${windowSeconds}s (threshold: ${threshold})`,
    };
}

module.exports = ruleFailedRequestBurst;
