/**
 * Rule 2 — High severity
 *
 * Flags logs whose severity is in a high-severity set (e.g. ERROR, CRITICAL)
 * or whose HTTP status indicates server/client failure (500+, or explicit list).
 */

const { extractHttpStatus } = require('../helpers');

/**
 * @param {Object} log
 * @param {Object} context
 * @returns {Object|null}
 */
function ruleHighSeverity(log, context) {
    const { severities, httpStatuses, httpStatusMin, weight } = context.config.highSeverity;
    const severity = (log.severity || '').toUpperCase();

    if (severities.includes(severity)) {
        return {
            triggered: true,
            rule: 'high_severity',
            score: weight,
            reason: `High severity level detected: ${severity}`,
        };
    }

    const status = extractHttpStatus(log);

    if (status === null) {
        return null;
    }

    if (httpStatuses.includes(status) || status >= httpStatusMin) {
        return {
            triggered: true,
            rule: 'high_severity',
            score: weight,
            reason: `High-severity HTTP status detected: ${status}`,
        };
    }

    return null;
}

module.exports = ruleHighSeverity;
