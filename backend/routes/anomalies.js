/**
 * Anomalies API Routes
 * Endpoints for managing and viewing flagged log entries
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const aiExplainerService = require('../services/ai-explainer');
const { aiLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/anomalies
 * List all flagged entries with pagination
 * Query params: page, pageSize, minScore, hasAiExplanation
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const minScore = parseFloat(req.query.minScore) || 0;
        const hasAiExplanation = req.query.hasAiExplanation;
        
        const offset = (page - 1) * pageSize;
        const conditions = [`af.anomaly_score >= $1`];
        const values = [minScore];
        let paramCount = 1;
        
        if (hasAiExplanation === 'true') {
            conditions.push('af.ai_processed_at IS NOT NULL');
        } else if (hasAiExplanation === 'false') {
            conditions.push('af.ai_processed_at IS NULL');
        }
        
        const whereClause = conditions.join(' AND ');
        
        // Get total count
        const countQuery = `
            SELECT COUNT(*) as count
            FROM anomaly_flags af
            WHERE ${whereClause}
        `;
        const countResult = await db.query(countQuery, values);
        const total = parseInt(countResult.rows[0].count);
        
        // Get flagged logs with full details
        paramCount++;
        const query = `
            SELECT 
                l.id,
                l.timestamp,
                l.event_type,
                l.severity,
                l.source,
                l.message,
                l.metadata,
                af.id as flag_id,
                af.anomaly_score,
                af.detection_reason,
                af.detection_algorithm,
                af.ai_explanation,
                af.ai_root_cause,
                af.ai_next_steps,
                af.flagged_at,
                af.ai_processed_at
            FROM anomaly_flags af
            INNER JOIN logs l ON af.log_id = l.id
            WHERE ${whereClause}
            ORDER BY af.anomaly_score DESC, l.timestamp DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        
        values.push(pageSize, offset);
        const result = await db.query(query, values);
        
        res.json({
            success: true,
            anomalies: result.rows,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
        
    } catch (error) {
        console.error('Error in GET /anomalies:', error);
        res.status(500).json({
            error: 'Failed to retrieve anomalies',
            message: error.message
        });
    }
});

/**
 * GET /api/anomalies/:id
 * Get detailed anomaly information
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // ID could be log_id or flag_id - try both
        const query = `
            SELECT 
                l.id as log_id,
                l.timestamp,
                l.event_type,
                l.severity,
                l.source,
                l.message,
                l.metadata,
                l.created_at,
                af.id as flag_id,
                af.anomaly_score,
                af.detection_reason,
                af.detection_algorithm,
                af.ai_explanation,
                af.ai_root_cause,
                af.ai_next_steps,
                af.flagged_at,
                af.ai_processed_at
            FROM anomaly_flags af
            INNER JOIN logs l ON af.log_id = l.id
            WHERE l.id = $1 OR af.id = $1
        `;
        
        const result = await db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: `Anomaly with id ${id} not found`
            });
        }
        
        res.json({
            success: true,
            anomaly: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error in GET /anomalies/:id:', error);
        res.status(500).json({
            error: 'Failed to retrieve anomaly',
            message: error.message
        });
    }
});

/**
 * POST /api/anomalies/:id/explain
 * Trigger AI explanation for a flagged entry
 * RATE LIMITED: 10 requests per minute (protects Groq API quota)
 */
router.post('/:id/explain', aiLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!aiExplainerService.isAvailable()) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'AI explanation service is not configured (missing GROQ_API_KEY)'
            });
        }
        
        // Get log_id from the provided id (could be flag_id or log_id)
        const lookupQuery = `
            SELECT l.id as log_id, af.ai_processed_at
            FROM anomaly_flags af
            INNER JOIN logs l ON af.log_id = l.id
            WHERE l.id = $1 OR af.id = $1
        `;
        
        const lookupResult = await db.query(lookupQuery, [id]);
        
        if (lookupResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: `Flagged entry with id ${id} not found`
            });
        }
        
        const logId = lookupResult.rows[0].log_id;
        const alreadyProcessed = lookupResult.rows[0].ai_processed_at !== null;
        
        // Process AI explanation
        const result = await aiExplainerService.processLogExplanation(logId);
        
        if (result.success) {
            res.json({
                success: true,
                message: alreadyProcessed ? 'AI explanation regenerated' : 'AI explanation generated',
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'AI explanation failed',
                message: result.error
            });
        }
        
    } catch (error) {
        console.error('Error in POST /anomalies/:id/explain:', error);
        res.status(500).json({
            error: 'Failed to generate explanation',
            message: error.message
        });
    }
});

/**
 * POST /api/anomalies/explain-all
 * Batch generate AI explanations for all unprocessed flags
 */
router.post('/explain-all', async (req, res) => {
    try {
        if (!aiExplainerService.isAvailable()) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'AI explanation service is not configured'
            });
        }
        
        const unprocessedIds = await aiExplainerService.getUnprocessedFlags();
        
        if (unprocessedIds.length === 0) {
            return res.json({
                success: true,
                message: 'No unprocessed flags to explain',
                total: 0,
                successCount: 0,
                failureCount: 0
            });
        }
        
        // Process in batches to avoid overwhelming the API
        const batchSize = parseInt(req.query.batchSize) || 10;
        const idsToProcess = unprocessedIds.slice(0, batchSize);
        
        const result = await aiExplainerService.batchProcessExplanations(idsToProcess);
        
        res.json({
            success: true,
            message: `Processed ${result.successCount}/${result.total} explanations`,
            ...result,
            remaining: unprocessedIds.length - batchSize
        });
        
    } catch (error) {
        console.error('Error in POST /anomalies/explain-all:', error);
        res.status(500).json({
            error: 'Batch explanation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/anomalies/stats/summary
 * Get anomaly statistics summary
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_flags,
                AVG(anomaly_score) as avg_score,
                MAX(anomaly_score) as max_score,
                COUNT(CASE WHEN ai_processed_at IS NOT NULL THEN 1 END) as explained_count,
                COUNT(CASE WHEN ai_processed_at IS NULL THEN 1 END) as pending_explanation
            FROM anomaly_flags
        `;
        
        const result = await db.query(query);
        const stats = result.rows[0];
        
        // Get algorithm breakdown
        const algoQuery = `
            SELECT 
                detection_algorithm,
                COUNT(*) as count
            FROM anomaly_flags
            GROUP BY detection_algorithm
            ORDER BY count DESC
        `;
        
        const algoResult = await db.query(algoQuery);
        
        res.json({
            success: true,
            summary: {
                totalFlags: parseInt(stats.total_flags),
                averageScore: parseFloat(stats.avg_score) || 0,
                maxScore: parseFloat(stats.max_score) || 0,
                explainedCount: parseInt(stats.explained_count),
                pendingExplanation: parseInt(stats.pending_explanation)
            },
            algorithmBreakdown: algoResult.rows
        });
        
    } catch (error) {
        console.error('Error in GET /anomalies/stats/summary:', error);
        res.status(500).json({
            error: 'Failed to retrieve statistics',
            message: error.message
        });
    }
});

module.exports = router;
