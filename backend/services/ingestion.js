/**
 * Log Ingestion Service
 * Validates log entries and persists them via the Prisma model layer.
 */

const fs = require('fs/promises');
const path = require('path');
const logModel = require('../models/logModel');

const VALID_SEVERITIES = ['INFO', 'WARNING', 'ERROR', 'CRITICAL', 'DEBUG'];

const DEFAULT_DATASET_PATH = path.resolve(__dirname, '../../data/synthetic-logs.json');

/**
 * Validate a single log entry from API or file input.
 * @param {unknown} log
 * @param {number} [index]
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLogEntry(log, index) {
    const errors = [];
    const label = index !== undefined ? `Row ${index + 1}: ` : '';

    if (!log || typeof log !== 'object' || Array.isArray(log)) {
        return {
            valid: false,
            errors: [`${label}Entry must be a plain object`],
        };
    }

    if (!log.timestamp) {
        errors.push(`${label}Missing required field: timestamp`);
    } else {
        const timestamp = new Date(log.timestamp);
        if (Number.isNaN(timestamp.getTime())) {
            errors.push(
                `${label}Invalid timestamp format. Expected ISO 8601 (e.g. 2024-01-01T12:00:00Z)`
            );
        }
    }

    if (!log.event_type) {
        errors.push(`${label}Missing required field: event_type`);
    } else if (typeof log.event_type !== 'string' || log.event_type.trim().length === 0) {
        errors.push(`${label}event_type must be a non-empty string`);
    }

    if (!log.severity) {
        errors.push(`${label}Missing required field: severity`);
    } else if (!VALID_SEVERITIES.includes(String(log.severity).toUpperCase())) {
        errors.push(
            `${label}Invalid severity: "${log.severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`
        );
    }

    if (!log.source) {
        errors.push(`${label}Missing required field: source`);
    } else if (typeof log.source !== 'string' || log.source.trim().length === 0) {
        errors.push(`${label}source must be a non-empty string`);
    }

    if (log.message !== undefined && log.message !== null && typeof log.message !== 'string') {
        errors.push(`${label}message must be a string if provided`);
    }

    if (log.metadata !== undefined && log.metadata !== null) {
        if (typeof log.metadata !== 'object' || Array.isArray(log.metadata)) {
            errors.push(`${label}metadata must be a plain object if provided`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Normalize a validated log entry for persistence.
 * @param {Object} log
 * @returns {Object}
 */
function normalizeLogEntry(log) {
    return {
        timestamp: new Date(log.timestamp),
        eventType: log.event_type.trim(),
        severity: log.severity.toUpperCase(),
        source: log.source.trim(),
        message: log.message ?? null,
        metadata: log.metadata ?? {},
    };
}

/**
 * Persist a single validated log entry.
 * @param {Object} log
 * @returns {Promise<Object>}
 */
async function persistLogEntry(log) {
    try {
        return await logModel.createLog(normalizeLogEntry(log));
    } catch (error) {
        console.error('Database error persisting log:', error.message);
        throw new Error(`Failed to persist log entry: ${error.message}`);
    }
}

/**
 * Ingest a single log entry.
 * @param {Object} log
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
async function ingestSingleLog(log) {
    const validation = validateLogEntry(log);
    if (!validation.valid) {
        return {
            success: false,
            error: validation.errors.join('; '),
        };
    }

    try {
        const insertedLog = await persistLogEntry(log);
        return {
            success: true,
            data: insertedLog,
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Ingest multiple log entries (batch API ingestion).
 * @param {Array} logs
 * @returns {Promise<Object>}
 */
async function ingestBatchLogs(logs) {
    if (!Array.isArray(logs)) {
        throw new Error('Logs must be an array');
    }

    if (logs.length === 0) {
        return {
            successCount: 0,
            failureCount: 0,
            total: 0,
            results: [],
            successful: [],
            failed: [],
            message: 'No logs to ingest (empty array)',
        };
    }

    const results = [];
    const successful = [];
    const failed = [];

    for (let i = 0; i < logs.length; i++) {
        const result = await ingestSingleLog(logs[i]);

        results.push({ index: i, ...result });

        if (result.success) {
            successful.push(result.data);
        } else {
            failed.push({
                index: i,
                log: logs[i],
                error: result.error,
            });
        }
    }

    return {
        successCount: successful.length,
        failureCount: failed.length,
        total: logs.length,
        results,
        successful,
        failed,
    };
}

/**
 * Parse dataset file contents into log entry objects.
 * @param {string} contents
 * @param {'json'|'csv'} format
 * @returns {unknown[]}
 */
function parseDatasetContents(contents, format) {
    if (format === 'json') {
        const parsed = JSON.parse(contents);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        if (parsed && Array.isArray(parsed.logs)) {
            return parsed.logs;
        }

        throw new Error('JSON dataset must be an array or an object with a logs array');
    }

    if (format === 'csv') {
        return parseCsv(contents);
    }

    throw new Error(`Unsupported format: ${format}. Use "json" or "csv".`);
}

/**
 * Minimal CSV parser for the synthetic dataset shape.
 * @param {string} contents
 * @returns {Object[]}
 */
function parseCsv(contents) {
    const lines = contents
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const headers = lines[0].split(',').map((header) => header.trim());

    return lines.slice(1).map((line) => {
        const values = line.split(',');
        const row = {};

        headers.forEach((header, index) => {
            const raw = values[index]?.trim() ?? '';
            if (header === 'metadata' && raw) {
                try {
                    row.metadata = JSON.parse(raw);
                } catch {
                    row.metadata = raw;
                }
            } else {
                row[header] = raw || undefined;
            }
        });

        return row;
    });
}

/**
 * Read and ingest logs from a dataset file.
 * Malformed rows are skipped and logged; the process does not crash.
 * @param {Object} [options]
 * @param {string} [options.filePath]
 * @param {'json'|'csv'} [options.format]
 * @returns {Promise<Object>}
 */
async function ingestFromFile(options = {}) {
    const filePath = options.filePath || DEFAULT_DATASET_PATH;
    const format = options.format || inferFormat(filePath);

    let rawContents;
    try {
        rawContents = await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                success: false,
                message: `Dataset file not found: ${filePath}`,
                filePath,
                successCount: 0,
                failureCount: 0,
                skippedCount: 0,
                total: 0,
            };
        }

        throw error;
    }

    let entries;
    try {
        entries = parseDatasetContents(rawContents, format);
    } catch (error) {
        console.error(`Failed to parse dataset (${filePath}):`, error.message);
        return {
            success: false,
            message: `Failed to parse dataset: ${error.message}`,
            filePath,
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            total: 0,
        };
    }

    if (!Array.isArray(entries) || entries.length === 0) {
        return {
            success: true,
            message: 'Dataset is empty — nothing to ingest',
            filePath,
            successCount: 0,
            failureCount: 0,
            skippedCount: 0,
            total: 0,
            successful: [],
            skipped: [],
        };
    }

    const validRecords = [];
    const skipped = [];

    for (let i = 0; i < entries.length; i++) {
        const validation = validateLogEntry(entries[i], i);

        if (!validation.valid) {
            const reason = validation.errors.join('; ');
            console.warn(`Skipping malformed row: ${reason}`);
            skipped.push({
                index: i,
                log: entries[i],
                error: reason,
            });
            continue;
        }

        validRecords.push(normalizeLogEntry(entries[i]));
    }

    if (validRecords.length === 0) {
        return {
            success: true,
            message: 'No valid log entries found in dataset after validation',
            filePath,
            successCount: 0,
            failureCount: 0,
            skippedCount: skipped.length,
            total: entries.length,
            successful: [],
            skipped,
        };
    }

    let successful;
    try {
        successful = await logModel.createManyLogs(validRecords);
    } catch (error) {
        console.error('Batch persistence failed:', error.message);
        throw new Error(`Failed to persist dataset: ${error.message}`);
    }

    return {
        success: true,
        message: `Ingested ${successful.length} log(s) from ${path.basename(filePath)}`,
        filePath,
        successCount: successful.length,
        failureCount: 0,
        skippedCount: skipped.length,
        total: entries.length,
        successful,
        skipped,
    };
}

/**
 * @param {string} filePath
 * @returns {'json'|'csv'}
 */
function inferFormat(filePath) {
    return path.extname(filePath).toLowerCase() === '.csv' ? 'csv' : 'json';
}

async function getLogById(logId) {
    return logModel.findLogById(logId);
}

async function getLogs(options = {}) {
    return logModel.findLogs(options);
}

module.exports = {
    validateLogEntry,
    ingestSingleLog,
    ingestBatchLogs,
    ingestFromFile,
    getLogById,
    getLogs,
    parseDatasetContents,
    VALID_SEVERITIES,
    DEFAULT_DATASET_PATH,
};
