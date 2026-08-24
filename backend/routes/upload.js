/**
 * File Upload Routes
 * Upload and parse log files (CSV, JSON, TXT)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { Readable } = require('stream');
const ingestionService = require('../services/ingestion');
const detectionService = require('../services/detection');
const aiExplainerService = require('../services/ai-explainer');
const socketManager = require('../services/socketManager');
const { ingestLimiter } = require('../middleware/rateLimiter');

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ['.csv', '.json', '.txt', '.log'];
        const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV, JSON, TXT, and LOG files are allowed'));
        }
    }
});

/**
 * Parse CSV log file
 */
function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const logs = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                logs.push({
                    timestamp: row.timestamp || row.Timestamp || row.time,
                    event_type: row.event_type || row.eventType || row.event || row.type,
                    severity: (row.severity || row.level || row.Level || 'INFO').toUpperCase(),
                    source: row.source || row.Source || row.host || row.service || 'unknown',
                    message: row.message || row.Message || row.msg || ''
                });
            })
            .on('end', () => resolve(logs))
            .on('error', reject);
    });
}

/**
 * Parse JSON log file
 */
function parseJSON(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return reject(err);
            
            try {
                let parsed = JSON.parse(data);
                
                // Handle both array and single object
                if (!Array.isArray(parsed)) {
                    parsed = [parsed];
                }
                
                // Normalize field names
                const logs = parsed.map(log => ({
                    timestamp: log.timestamp || log.time || log.ts,
                    event_type: log.event_type || log.eventType || log.event || log.type,
                    severity: (log.severity || log.level || 'INFO').toUpperCase(),
                    source: log.source || log.host || log.service || 'unknown',
                    message: log.message || log.msg || ''
                }));
                
                resolve(logs);
            } catch (error) {
                reject(new Error('Invalid JSON format'));
            }
        });
    });
}

/**
 * Parse plain text log file (basic parsing)
 */
function parseTXT(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return reject(err);
            
            const lines = data.split('\n').filter(line => line.trim());
            const logs = lines.map((line, index) => {
                // Try to extract severity
                let severity = 'INFO';
                if (/error|err/i.test(line)) severity = 'ERROR';
                if (/critical|fatal/i.test(line)) severity = 'CRITICAL';
                if (/warn/i.test(line)) severity = 'WARNING';
                if (/debug/i.test(line)) severity = 'DEBUG';
                
                // Try to extract timestamp (ISO format)
                const timestampMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
                const timestamp = timestampMatch ? new Date(timestampMatch[0]).toISOString() : new Date().toISOString();
                
                return {
                    timestamp,
                    event_type: `LOG_LINE_${index + 1}`,
                    severity,
                    source: 'file-upload',
                    message: line.trim()
                };
            });
            
            resolve(logs);
        });
    });
}

/**
 * POST /api/upload
 * Upload and ingest log file
 */
router.post('/', ingestLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                message: 'Please upload a CSV, JSON, TXT, or LOG file'
            });
        }
        
        const { path: filePath, originalname } = req.file;
        const ext = originalname.toLowerCase().substring(originalname.lastIndexOf('.'));
        
        console.log(`📁 Processing file upload: ${originalname}`);
        
        // Parse based on file type
        let logs;
        try {
            if (ext === '.csv') {
                logs = await parseCSV(filePath);
            } else if (ext === '.json') {
                logs = await parseJSON(filePath);
            } else {
                logs = await parseTXT(filePath);
            }
        } catch (parseError) {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            return res.status(400).json({
                error: 'File parsing failed',
                message: parseError.message
            });
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        if (logs.length === 0) {
            return res.status(400).json({
                error: 'No valid logs found',
                message: 'File appears to be empty or improperly formatted'
            });
        }
        
        console.log(`📊 Parsed ${logs.length} logs from ${originalname}`);
        
        // Ingest logs
        const ingestionResult = await ingestionService.ingestBatchLogs(logs);
        
        // Run anomaly detection
        let detectionResult = { flaggedCount: 0, results: [] };
        if (ingestionResult.successful.length > 0) {
            detectionResult = await detectionService.batchAnalyze(ingestionResult.successful);

            // Queue AI explanation for flagged entries (async in background)
            if (detectionResult.flaggedCount > 0 && aiExplainerService.isAvailable()) {
                const flaggedLogIds = (detectionResult.results || [])
                    .filter(r => r.flagged)
                    .map(r => r.logId);

                if (flaggedLogIds.length > 0) {
                    setImmediate(() => {
                        aiExplainerService.batchProcessExplanations(flaggedLogIds)
                            .then(result => {
                                console.log(`✅ Upload AI explanations processed: ${result.successCount}/${result.total}`);
                                if (result.results) {
                                    result.results
                                        .filter(r => r.success)
                                        .forEach(r => {
                                            socketManager.emitAIComplete(r.logId, r.explanation || {});
                                        });
                                }
                            })
                            .catch(err => {
                                console.error('❌ Upload AI explanation batch failed:', err.message);
                            });
                    });
                }
            }

            // Real-time broadcasts
            for (const log of ingestionResult.successful) {
                socketManager.emitNewLog(log);
            }

            for (const det of (detectionResult.results || [])) {
                if (det.flagged) {
                    const matchingLog = ingestionResult.successful.find(l => l.id === det.logId);
                    socketManager.emitAnomaly(matchingLog || { id: det.logId }, det);
                }
            }

            socketManager.emitStatsUpdate({
                newLogs: ingestionResult.successCount,
                newFlags: detectionResult.flaggedCount,
            });
        }
        
        res.status(201).json({
            success: true,
            message: `Processed ${originalname}: ${ingestionResult.successCount}/${logs.length} logs ingested, ${detectionResult.flaggedCount} anomalies detected`,
            filename: originalname,
            fileType: ext,
            ingestion: {
                total: logs.length,
                successful: ingestionResult.successCount,
                failed: ingestionResult.failureCount
            },
            detection: {
                analyzed: detectionResult.total || 0,
                flagged: detectionResult.flaggedCount || 0
            },
            sample: ingestionResult.successful.slice(0, 5), // Show first 5 logs
            errors: ingestionResult.failed.slice(0, 10) // Show first 10 errors
        });
        
    } catch (error) {
        // Clean up file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
});

module.exports = router;
