/**
 * Rule 3 — Rare event type
 *
 * Flags logs whose event_type appears rarely relative to the overall corpus.
 * Uses a simple frequency threshold: event_count / total_logs < threshold.
 */

/**
 * @param {Object} log
 * @param {Object} context
 * @returns {Object|null}
 */
function ruleRareEventType(log, context) {
    const { frequencyThreshold, minSampleSize, weight } = context.config.rareEventType;
    const { totalLogs, eventTypeCounts } = context;

    if (totalLogs < minSampleSize) {
        return null;
    }

    const eventType = log.event_type || log.eventType;
    const eventCount = eventTypeCounts[eventType] || 0;
    const frequency = eventCount / totalLogs;

    if (frequency >= frequencyThreshold) {
        return null;
    }

    const rarityRatio = 1 - frequency / frequencyThreshold;
    const score = Math.min(weight, Math.round(weight * rarityRatio));

    return {
        triggered: true,
        rule: 'rare_event_type',
        score: Math.max(score, 1),
        reason: `Rare event type "${eventType}" appears in ${(frequency * 100).toFixed(2)}% of logs (${eventCount}/${totalLogs}, threshold: ${(frequencyThreshold * 100).toFixed(1)}%)`,
    };
}

module.exports = ruleRareEventType;
