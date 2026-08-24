/**
 * Real-Time Monitoring Routes
 * DIFFERENTIATOR: Live streaming anomaly detection metrics
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');

/**
 * GET /api/realtime/pulse
 * Returns last-minute activity snapshot
 */
router.get('/pulse', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) FILTER (WHERE l.timestamp >= NOW() - INTERVAL '1 minute') as logs_last_minute,
                COUNT(*) FILTER (WHERE l.timestamp >= NOW() - INTERVAL '5 minutes') as logs_last_5min,
                COUNT(af.id) FILTER (WHERE af.flagged_at >= NOW() - INTERVAL '1 minute') as flags_last_minute,
                COUNT(DISTINCT l.source) FILTER (WHERE l.timestamp >= NOW() - INTERVAL '5 minutes') as active_sources,
                MAX(l.severity) FILTER (WHERE l.timestamp >= NOW() - INTERVAL '1 minute') as highest_severity,
                MAX(af.anomaly_score) FILTER (WHERE af.flagged_at >= NOW() - INTERVAL '1 minute') as highest_score
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id;
        `;
        
        const result = await db.query(query);
        const pulse = result.rows[0];
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            pulse: {
                logsLastMinute: parseInt(pulse.logs_last_minute),
                logsLast5Min: parseInt(pulse.logs_last_5min),
                flagsLastMinute: parseInt(pulse.flags_last_minute),
                activeSources: parseInt(pulse.active_sources),
                highestSeverity: pulse.highest_severity || 'INFO',
                highestScore: parseFloat(pulse.highest_score) || 0,
                status: pulse.logs_last_minute > 0 ? 'active' : 'quiet'
            }
        });
    } catch (error) {
        console.error('Error in /realtime/pulse:', error);
        res.status(500).json({
            error: 'Failed to get pulse',
            message: error.message
        });
    }
});

/**
 * GET /api/realtime/health
 * System health check with detection engine status
 */
router.get('/health', async (req, res) => {
    try {
        const checks = await Promise.all([
            // Database check
            db.query('SELECT 1'),
            // Recent activity check
            db.query('SELECT COUNT(*) as count FROM logs WHERE timestamp >= NOW() - INTERVAL \'1 hour\''),
            // Anomaly detection check
            db.query('SELECT COUNT(*) as count FROM anomaly_flags WHERE flagged_at >= NOW() - INTERVAL \'1 hour\'')
        ]);
        
        const recentLogs = parseInt(checks[1].rows[0].count);
        const recentFlags = parseInt(checks[2].rows[0].count);
        
        res.json({
            success: true,
            health: {
                database: 'ok',
                detectionEngine: 'active',
                aiService: process.env.GROQ_API_KEY ? 'available' : 'unavailable',
                recentActivity: {
                    logsLastHour: recentLogs,
                    flagsLastHour: recentFlags,
                    detectionRate: recentLogs > 0 ? ((recentFlags / recentLogs) * 100).toFixed(1) + '%' : '0%'
                }
            }
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            health: {
                database: 'error',
                error: error.message
            }
        });
    }
});

module.exports = router;
