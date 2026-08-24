/**
 * AI Explanation Service
 *
 * One Groq chat-completions request per flagged log entry. The response is
 * persisted on the anomaly flag so demos do not need a live call.
 *
 * API key is read from GROQ_API_KEY — never hardcoded.
 */

const OpenAI = require('openai');
const anomalyFlagModel = require('../models/anomalyFlagModel');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const API_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 30_000;
const RETRY_DELAY_MS = Number(process.env.GROQ_RETRY_DELAY_MS) || 1_000;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let groqClient = null;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function initializeGroq() {
    if (!process.env.GROQ_API_KEY) {
        console.warn('GROQ_API_KEY not set — AI explanations will not be available');
        return null;
    }

    try {
        groqClient = new OpenAI({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: GROQ_BASE_URL,
            timeout: API_TIMEOUT_MS,
            maxRetries: 0,
        });
        return groqClient;
    } catch (error) {
        console.error('Failed to initialize Groq client:', error.message);
        return null;
    }
}

function isAvailable() {
    if (groqClient) {
        return true;
    }

    return initializeGroq() !== null;
}

/**
 * Build the user prompt sent to the LLM.
 * @param {Object} log
 * @param {Object} anomalyFlag
 */
function buildPrompt(log, anomalyFlag) {
    const metadata =
        log.metadata && typeof log.metadata === 'object'
            ? JSON.stringify(log.metadata, null, 2)
            : 'N/A';

    return `Analyze this flagged production log entry and respond with JSON only.

LOG ENTRY:
- Timestamp: ${log.timestamp}
- Event Type: ${log.event_type}
- Severity: ${log.severity}
- Source: ${log.source}
- Message: ${log.message || 'N/A'}
- Metadata: ${metadata}

DETECTION RESULT:
- Anomaly Score: ${anomalyFlag.anomaly_score}/100
- Triggered Rules: ${anomalyFlag.detection_algorithm}
- Detection Reason: ${anomalyFlag.detection_reason}

Return a JSON object with exactly these keys:
{
  "explanation": "2-3 sentence plain-English summary of what likely happened",
  "rootCause": "1-2 sentences on the most likely root cause",
  "nextSteps": "2-4 actionable bullet points as a single string, separated by newlines"
}

Write for an operations team. Be specific and actionable. Avoid jargon where possible.`;
}

/**
 * Execute a single LLM request with a hard timeout.
 * @param {Array} messages
 */
async function callLlm(messages) {
    const client = groqClient || initializeGroq();
    if (!client) {
        throw new Error('Groq client is not configured');
    }

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`LLM API request timed out after ${API_TIMEOUT_MS}ms`)),
            API_TIMEOUT_MS
        );
    });

    try {
        const request = client.chat.completions.create({
            model: GROQ_MODEL,
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.4,
            max_tokens: 600,
        });

        return await Promise.race([request, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Parse the JSON payload returned by the LLM.
 * @param {string} content
 */
function parseLlmJson(content) {
    const trimmed = String(content).trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced ? fenced[1].trim() : trimmed;
    const parsed = JSON.parse(jsonText);

    const explanation = String(parsed.explanation || '').trim();
    const rootCause = String(parsed.rootCause || parsed.root_cause || '').trim();
    const nextSteps = String(parsed.nextSteps || parsed.next_steps || '').trim();

    if (!explanation) {
        throw new Error('LLM response missing explanation field');
    }

    return {
        explanation,
        rootCause: rootCause || 'Root cause could not be determined from the available context.',
        nextSteps:
            nextSteps ||
            'Review correlated logs from the same source and check service health metrics.',
    };
}

/**
 * Generate an AI explanation, retrying once on failure.
 * @param {Object} log
 * @param {Object} anomalyFlag
 */
async function generateExplanation(log, anomalyFlag) {
    if (!isAvailable()) {
        throw new Error('AI explanation service is not available — GROQ_API_KEY not configured');
    }

    const messages = [
        {
            role: 'system',
            content:
                'You are an expert site reliability engineer. Explain log anomalies clearly and return valid JSON only.',
        },
        {
            role: 'user',
            content: buildPrompt(log, anomalyFlag),
        },
    ];

    let lastError;

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const completion = await callLlm(messages);
            const content = completion.choices[0]?.message?.content;

            if (!content) {
                throw new Error('LLM returned an empty response');
            }

            const parsed = parseLlmJson(content);

            return {
                ...parsed,
                isFallback: false,
                rawResponse: content,
            };
        } catch (error) {
            lastError = error;
            console.warn(`LLM attempt ${attempt}/2 failed for log ${log.id}:`, error.message);

            if (attempt < 2) {
                await sleep(RETRY_DELAY_MS);
            }
        }
    }

    throw lastError;
}

/**
 * Build a deterministic fallback when the LLM call fails after retry.
 * @param {Object} log
 * @param {Object} anomalyFlag
 * @param {Error} error
 */
function buildFallbackExplanation(log, anomalyFlag, error) {
    return {
        explanation: `AI explanation could not be generated (${error.message}). This entry was flagged with a score of ${anomalyFlag.anomaly_score}/100 because: ${anomalyFlag.detection_reason}`,
        rootCause: `Automatic root-cause analysis is unavailable. Based on the triggered rules (${anomalyFlag.detection_algorithm}), investigate ${log.source} around ${log.timestamp}.`,
        nextSteps: [
            `Review recent logs from source "${log.source}"`,
            `Inspect metrics and alerts for ${log.event_type} events`,
            'Re-request an AI explanation later via POST /api/anomalies/:id/explain',
        ].join('\n'),
        isFallback: true,
        rawResponse: null,
    };
}

/**
 * Generate and persist an explanation for a flagged log entry.
 * Never throws — failures are stored as fallback text so the pipeline keeps running.
 * @param {string} logId
 */
async function processLogExplanation(logId) {
    if (!isAvailable()) {
        return {
            success: false,
            error: 'AI explanation service not available — GROQ_API_KEY not configured',
        };
    }

    try {
        const record = await anomalyFlagModel.findFlagWithLogByLogId(logId);

        if (!record) {
            return {
                success: false,
                error: 'Log not found or not flagged',
            };
        }

        const { log, flag: anomalyFlag } = record;

        console.log(`Generating AI explanation for log ${logId}...`);

        let aiResult;

        try {
            aiResult = await generateExplanation(log, anomalyFlag);
        } catch (error) {
            console.error(`LLM failed after retry for log ${logId}:`, error.message);
            aiResult = buildFallbackExplanation(log, anomalyFlag, error);
        }

        const updatedFlag = await anomalyFlagModel.saveAiExplanation(logId, {
            explanation: aiResult.explanation,
            rootCause: aiResult.rootCause,
            nextSteps: aiResult.nextSteps,
        });

        console.log(
            aiResult.isFallback
                ? `Stored fallback explanation for log ${logId}`
                : `AI explanation stored for log ${logId}`
        );

        return {
            success: true,
            fallback: aiResult.isFallback,
            data: {
                explanation: aiResult.explanation,
                rootCause: aiResult.rootCause,
                nextSteps: aiResult.nextSteps,
                rawResponse: aiResult.rawResponse,
                updatedFlag,
            },
        };
    } catch (error) {
        console.error(`Failed to process explanation for log ${logId}:`, error.message);

        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Process AI explanations for multiple flagged entries sequentially.
 * Individual failures do not stop the batch.
 * @param {string[]} logIds
 */
async function batchProcessExplanations(logIds) {
    if (!isAvailable()) {
        return {
            success: false,
            error: 'AI explanation service not available',
            total: logIds.length,
            successCount: 0,
            failureCount: logIds.length,
            fallbackCount: 0,
            results: [],
        };
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;
    let fallbackCount = 0;

    for (const logId of logIds) {
        const result = await processLogExplanation(logId);

        results.push({ logId, ...result });

        if (result.success) {
            successCount++;
            if (result.fallback) {
                fallbackCount++;
            }
        } else {
            failureCount++;
        }

        await sleep(100);
    }

    return {
        success: true,
        total: logIds.length,
        successCount,
        failureCount,
        fallbackCount,
        results,
    };
}

/**
 * @returns {Promise<string[]>}
 */
async function getUnprocessedFlags() {
    return anomalyFlagModel.getUnprocessedLogIds();
}

initializeGroq();

module.exports = {
    generateExplanation,
    processLogExplanation,
    batchProcessExplanations,
    getUnprocessedFlags,
    buildFallbackExplanation,
    isAvailable,
    initializeGroq,
};
