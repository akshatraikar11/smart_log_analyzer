/**
 * Ingest controller — thin HTTP layer for dataset ingestion.
 */

const path = require('path');
const ingestionService = require('../services/ingestion');
const detectionService = require('../services/detection');
const aiExplainerService = require('../services/ai-explainer');

/**
 * POST /api/ingest
 * Triggers ingestion from the synthetic dataset file on disk.
 */
async function ingestDataset(req, res) {
    const requestedPath = req.body?.filePath;
    const format = req.body?.format;
    const runDetection = req.body?.runDetection !== false;

    const filePath = requestedPath
        ? path.resolve(requestedPath)
        : ingestionService.DEFAULT_DATASET_PATH;

    const result = await ingestionService.ingestFromFile({ filePath, format });

    if (!result.success && result.total === 0 && result.message?.includes('not found')) {
        return res.status(404).json({
            success: false,
            message: result.message,
            filePath: result.filePath,
        });
    }

    if (!result.success && result.message?.includes('Failed to parse')) {
        return res.status(400).json({
            success: false,
            message: result.message,
            filePath: result.filePath,
        });
    }

    let detection = null;
    if (runDetection && result.successCount > 0) {
        detection = await detectionService.batchAnalyze(result.successful);

        if (detection.flaggedCount > 0 && aiExplainerService.isAvailable()) {
            const flaggedLogIds = detection.results
                .filter((entry) => entry.flagged)
                .map((entry) => entry.logId);

            setImmediate(() => {
                aiExplainerService
                    .batchProcessExplanations(flaggedLogIds)
                    .then((aiResult) => {
                        console.log(
                            `AI explanations processed: ${aiResult.successCount}/${aiResult.total} (${aiResult.fallbackCount} fallbacks)`
                        );
                    })
                    .catch((err) => {
                        console.error('AI explanation batch failed:', err.message);
                    });
            });
        }
    }

    const statusCode = result.successCount > 0 ? 201 : 200;

    return res.status(statusCode).json({
        success: result.success,
        message: result.message,
        filePath: result.filePath,
        ingestion: {
            total: result.total,
            ingested: result.successCount,
            skipped: result.skippedCount,
            failed: result.failureCount,
        },
        detection: detection
            ? {
                  analyzed: detection.total,
                  flagged: detection.flaggedCount,
              }
            : null,
        skipped: result.skipped,
    });
}

module.exports = {
    ingestDataset,
};
