/**
 * Tunable thresholds for deterministic anomaly rules.
 * Adjust these constants for demos without touching rule logic.
 */

module.exports = {
    failedRequestBurst: {
        /** Max failed requests allowed from one source within the window */
        threshold: 5,
        /** Sliding window size in seconds */
        windowSeconds: 60,
        /** Weight contributed to the composite anomaly score */
        weight: 30,
    },
    highSeverity: {
        severities: ['CRITICAL', 'ERROR'],
        /** HTTP status codes treated as high-severity on their own */
        httpStatuses: [500, 502, 503, 504],
        /** Any HTTP status >= this value is high-severity */
        httpStatusMin: 500,
        weight: 25,
    },
    rareEventType: {
        /** Event types appearing below this fraction of all logs are flagged */
        frequencyThreshold: 0.01,
        /** Minimum corpus size before rare-event detection runs */
        minSampleSize: 50,
        weight: 25,
    },
    offHoursActivity: {
        /** Expected activity window (UTC, inclusive start, exclusive end) */
        startHourUtc: 9,
        endHourUtc: 17,
        weight: 20,
    },
};
