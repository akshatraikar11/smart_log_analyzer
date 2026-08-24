/**
 * Logs API Routes
 * Endpoints for log ingestion and retrieval
 */

const express = require('express');
const router = express.Router();
const ingestionService = require('../services/ingestion');
const detectionService = require('../services/detection');
const aiExplainerService = require('../services/ai-explainer');
const socketManager = require('../services/socketManager');
const { ingestLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/logs/ingest
 * Ingest single or batch log entries
 * Automatically runs anomaly detection and queues AI explanation
 * RATE LIMITED: 50 requests per minute
 */
router.post('/ingest', ingestLimiter, async (req, res) => {
    try {
        const { logs } = req.body;
        
        // Determine if single or batch (supports [ ... ], { logs: [ ... ] }, or { ... })
        const isBatch = Array.isArray(req.body) || Array.isArray(req.body?.logs);
        const logsToProcess = Array.isArray(req.body) 
            ? req.body 
            : (Array.isArray(req.body?.logs) ? req.body.logs : [req.body]);
        
        // Validate we have data
        if (!isBatch && !req.body?.timestamp) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Expected either a single log entry, an array of logs, or { logs: [...] }'
            });
        }
        
        // Ingest logs
        const ingestionResult = await ingestionService.ingestBatchLogs(logsToProcess);
        
        // Run anomaly detection on successfully ingested logs
        if (ingestionResult.successful.length > 0) {
            const detectionResult = await detectionService.batchAnalyze(ingestionResult.successful);
            
            // Queue AI explanation for flagged entries (async, don't wait)
            if (detectionResult.flaggedCount > 0 && aiExplainerService.isAvailable()) {
                const flaggedLogIds = detectionResult.results
                    .filter(r => r.flagged)
                    .map(r => r.logId);
                
                // Process AI explanations in background
                setImmediate(() => {
                    aiExplainerService.batchProcessExplanations(flaggedLogIds)
                        .then(result => {
                            console.log(`✅ AI explanations processed: ${result.successCount}/${result.total}`);
                            // Emit AI completion for each successfully processed entry
                            if (result.results) {
                                result.results
                                    .filter(r => r.success)
                                    .forEach(r => {
                                        socketManager.emitAIComplete(r.logId, r.explanation || {});
                                    });
                            }
                        })
                        .catch(err => {
                            console.error('❌ AI explanation batch failed:', err.message);
                        });
                });
            }

            // ── Real-time broadcasts ────────────────────────────
            // Notify connected clients about every new log
            for (const log of ingestionResult.successful) {
                socketManager.emitNewLog(log);
            }

            // Notify about each anomaly detection
            for (const det of detectionResult.results) {
                if (det.flagged) {
                    const matchingLog = ingestionResult.successful.find(l => l.id === det.logId);
                    socketManager.emitAnomaly(matchingLog || { id: det.logId }, det);
                }
            }

            // Push a lightweight stats delta
            socketManager.emitStatsUpdate({
                newLogs: ingestionResult.successCount,
                newFlags: detectionResult.flaggedCount,
            });
            // ────────────────────────────────────────────────────
            
            return res.status(201).json({
                success: true,
                message: `Ingested ${ingestionResult.successCount} log(s), ${detectionResult.flaggedCount} flagged as anomalous`,
                ingestion: {
                    total: ingestionResult.total,
                    successful: ingestionResult.successCount,
                    failed: ingestionResult.failureCount
                },
                detection: {
                    analyzed: detectionResult.total,
                    flagged: detectionResult.flaggedCount
                },
                logs: ingestionResult.successful,
                errors: ingestionResult.failed
            });
        } else {
            // All logs failed validation
            return res.status(400).json({
                success: false,
                message: 'All log entries failed validation',
                errors: ingestionResult.failed
            });
        }
        
    } catch (error) {
        console.error('Error in /ingest:', error);
        res.status(500).json({
            error: 'Ingestion failed',
            message: error.message
        });
    }
});

/**
 * GET /api/logs
 * List logs with pagination and filtering
 * Query params: page, pageSize, severity, source, flaggedOnly, startDate, endDate
 */
router.get('/', async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            pageSize: parseInt(req.query.pageSize) || 50,
            severity: req.query.severity,
            source: req.query.source,
            flaggedOnly: req.query.flaggedOnly === 'true',
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        
        const result = await ingestionService.getLogs(options);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error in GET /logs:', error);
        res.status(500).json({
            error: 'Failed to retrieve logs',
            message: error.message
        });
    }
});

/**
 * GET /api/logs/:id
 * Get single log entry with anomaly details if flagged
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get log with anomaly details
        const query = `
            SELECT 
                l.*,
                af.id as flag_id,
                af.anomaly_score,
                af.detection_reason,
                af.detection_algorithm,
                af.ai_explanation,
                af.ai_root_cause,
                af.ai_next_steps,
                af.flagged_at,
                af.ai_processed_at,
                CASE WHEN af.id IS NOT NULL THEN true ELSE false END as is_flagged
            FROM logs l
            LEFT JOIN anomaly_flags af ON l.id = af.log_id
            WHERE l.id = $1
        `;
        
        const db = require('../config/database');
        const result = await db.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not found',
                message: `Log entry with id ${id} not found`
            });
        }
        
        res.json({
            success: true,
            log: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error in GET /logs/:id:', error);
        res.status(500).json({
            error: 'Failed to retrieve log',
            message: error.message
        });
    }
});

/**
 * POST /api/logs/:id/analyze
 * Manually trigger anomaly detection for a specific log
 */
router.post('/:id/analyze', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get log entry
        const log = await ingestionService.getLogById(id);
        
        if (!log) {
            return res.status(404).json({
                error: 'Not found',
                message: `Log entry with id ${id} not found`
            });
        }
        
        // Run detection
        const result = await detectionService.analyzeAndFlag(log);
        
        // If flagged and AI available, queue explanation
        if (result.flagged && aiExplainerService.isAvailable()) {
            setImmediate(() => {
                aiExplainerService.processLogExplanation(id)
                    .catch(err => console.error('AI explanation failed:', err));
            });
        }
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('Error in POST /logs/:id/analyze:', error);
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
});

module.exports = router;
