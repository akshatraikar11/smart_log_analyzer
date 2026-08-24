/**
 * Rule 4 — Off-hours activity
 *
 * Flags logs whose timestamp falls outside the expected activity window (UTC).
 */

/**
 * @param {Object} log
 * @param {Object} context
 * @returns {Object|null}
 */
function ruleOffHoursActivity(log, context) {
    const { startHourUtc, endHourUtc, weight } = context.config.offHoursActivity;
    const logTime = new Date(log.timestamp);
    const hour = logTime.getUTCHours();

    const withinExpectedHours = hour >= startHourUtc && hour < endHourUtc;

    if (withinExpectedHours) {
        return null;
    }

    const formattedTime = logTime.toISOString();

    return {
        triggered: true,
        rule: 'off_hours_activity',
        score: weight,
        reason: `Activity at ${formattedTime} (${hour}:xx UTC) is outside expected hours ${startHourUtc}:00–${endHourUtc}:00 UTC`,
    };
}

module.exports = ruleOffHoursActivity;
