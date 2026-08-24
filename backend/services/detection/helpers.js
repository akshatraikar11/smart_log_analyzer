/**
 * Shared helpers for reading HTTP status from log metadata.
 */

/**
 * @param {Object} log
 * @returns {number|null}
 */
function extractHttpStatus(log) {
    const metadata = log.metadata && typeof log.metadata === 'object' ? log.metadata : {};

    const raw = metadata.statusCode ?? metadata.status ?? metadata.httpStatus;
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }

    const code = Number(raw);
    return Number.isFinite(code) ? code : null;
}

/**
 * A failed request is a 4xx or 5xx response, or an API_REQUEST at ERROR/CRITICAL
 * when no HTTP status is stored in metadata.
 * @param {Object} log
 * @returns {boolean}
 */
function isFailedRequest(log) {
    const status = extractHttpStatus(log);

    if (status !== null) {
        return status >= 400 && status < 600;
    }

    const severity = (log.severity || '').toUpperCase();
    return ['ERROR', 'CRITICAL'].includes(severity);
}

module.exports = {
    extractHttpStatus,
    isFailedRequest,
};
