/**
 * Statistics API Routes
 * Dashboard statistics and analytics
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/stats
 * Get overall system statistics
 */
router.get('/', async (req, res) => {
    try {
        // Get overall counts
        const overallQuery = `
            SELECT 
                COUNT(DISTINCT l.id) as total_logs,
                COUNT(DISTINCT af.id) as total_flags,
                COUNT(DISTINCT l.source) as unique_sources,
                COUNT(DISTINCT l.event_type) as unique_event_types
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
        `;
        
        const overallResult = await db.query(overallQuery);
        const overall = overallResult.rows[0];
        
        // Get severity breakdown
        const severityQuery = `
            SELECT 
                severity,
                COUNT(*) as count,
                COUNT(af.id) as flagged_count
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            GROUP BY severity
            ORDER BY 
                CASE severity
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'ERROR' THEN 2
                    WHEN 'WARNING' THEN 3
                    WHEN 'INFO' THEN 4
                    WHEN 'DEBUG' THEN 5
                END
        `;
        
        const severityResult = await db.query(severityQuery);
        
        // Get recent activity (last 24 hours)
        const recentQuery = `
            SELECT 
                COUNT(*) as logs_last_24h,
                COUNT(af.id) as flags_last_24h
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            WHERE l.timestamp >= NOW() - INTERVAL '24 hours'
        `;
        
        const recentResult = await db.query(recentQuery);
        const recent = recentResult.rows[0];
        
        // Get top sources by log count
        const topSourcesQuery = `
            SELECT 
                source,
                COUNT(*) as log_count,
                COUNT(af.id) as flag_count
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            GROUP BY source
            ORDER BY log_count DESC
            LIMIT 10
        `;
        
        const topSourcesResult = await db.query(topSourcesQuery);
        
        // Get hourly trend (last 24 hours)
        const trendQuery = `
            SELECT 
                date_trunc('hour', timestamp) as hour,
                COUNT(*) as log_count,
                COUNT(af.id) as flag_count
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            WHERE l.timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY hour
            ORDER BY hour ASC
        `;
        
        const trendResult = await db.query(trendQuery);
        
        res.json({
            success: true,
            overall: {
                totalLogs: parseInt(overall.total_logs),
                totalFlags: parseInt(overall.total_flags),
                flagRate: overall.total_logs > 0 
                    ? ((parseInt(overall.total_flags) / parseInt(overall.total_logs)) * 100).toFixed(2) + '%'
                    : '0%',
                uniqueSources: parseInt(overall.unique_sources),
                uniqueEventTypes: parseInt(overall.unique_event_types)
            },
            severityBreakdown: severityResult.rows.map(row => ({
                severity: row.severity,
                count: parseInt(row.count),
                flaggedCount: parseInt(row.flagged_count),
                flagRate: row.count > 0 
                    ? ((parseInt(row.flagged_count) / parseInt(row.count)) * 100).toFixed(1) + '%'
                    : '0%'
            })),
            recent: {
                logsLast24h: parseInt(recent.logs_last_24h),
                flagsLast24h: parseInt(recent.flags_last_24h)
            },
            topSources: topSourcesResult.rows.map(row => ({
                source: row.source,
                logCount: parseInt(row.log_count),
                flagCount: parseInt(row.flag_count)
            })),
            hourlyTrend: trendResult.rows.map(row => ({
                hour: row.hour,
                logCount: parseInt(row.log_count),
                flagCount: parseInt(row.flag_count)
            }))
        });
        
    } catch (error) {
        console.error('Error in GET /stats:', error);
        res.status(500).json({
            error: 'Failed to retrieve statistics',
            message: error.message
        });
    }
});

/**
 * GET /api/stats/timeline
 * Get timeline data for visualization
 * Query params: interval (hour, day, week), period (24h, 7d, 30d)
 */
router.get('/timeline', async (req, res) => {
    try {
        const interval = req.query.interval || 'hour';
        const period = req.query.period || '24h';
        
        // Map period to PostgreSQL interval
        const periodMap = {
            '24h': '24 hours',
            '7d': '7 days',
            '30d': '30 days'
        };
        
        const pgInterval = periodMap[period] || '24 hours';
        
        // Map interval to PostgreSQL date_trunc
        const truncMap = {
            'hour': 'hour',
            'day': 'day',
            'week': 'week'
        };
        
        const truncLevel = truncMap[interval] || 'hour';
        
        const query = `
            SELECT 
                date_trunc($1, l.timestamp) as time_bucket,
                COUNT(DISTINCT l.id) as log_count,
                COUNT(DISTINCT af.id) as flag_count,
                COUNT(DISTINCT CASE WHEN l.severity = 'CRITICAL' THEN l.id END) as critical_count,
                COUNT(DISTINCT CASE WHEN l.severity = 'ERROR' THEN l.id END) as error_count,
                COUNT(DISTINCT CASE WHEN l.severity = 'WARNING' THEN l.id END) as warning_count
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            WHERE l.timestamp >= NOW() - INTERVAL $2
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        `;
        
        const result = await db.query(query, [truncLevel, pgInterval]);
        
        res.json({
            success: true,
            interval,
            period,
            data: result.rows.map(row => ({
                timestamp: row.time_bucket,
                logCount: parseInt(row.log_count),
                flagCount: parseInt(row.flag_count),
                criticalCount: parseInt(row.critical_count),
                errorCount: parseInt(row.error_count),
                warningCount: parseInt(row.warning_count)
            }))
        });
        
    } catch (error) {
        console.error('Error in GET /stats/timeline:', error);
        res.status(500).json({
            error: 'Failed to retrieve timeline data',
            message: error.message
        });
    }
});

/**
 * GET /api/stats/event-types
 * Get event type statistics
 */
router.get('/event-types', async (req, res) => {
    try {
        const query = `
            SELECT 
                event_type,
                COUNT(*) as count,
                COUNT(af.id) as flagged_count,
                MAX(l.timestamp) as last_seen
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            GROUP BY event_type
            ORDER BY count DESC
            LIMIT 50
        `;
        
        const result = await db.query(query);
        
        res.json({
            success: true,
            eventTypes: result.rows.map(row => ({
                eventType: row.event_type,
                count: parseInt(row.count),
                flaggedCount: parseInt(row.flagged_count),
                lastSeen: row.last_seen
            }))
        });
        
    } catch (error) {
        console.error('Error in GET /stats/event-types:', error);
        res.status(500).json({
            error: 'Failed to retrieve event type statistics',
            message: error.message
        });
    }
});

module.exports = router;
