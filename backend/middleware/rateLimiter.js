/**
 * Rate Limiting Middleware
 * Protects API from abuse while allowing smooth local streaming and development
 */

const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// General API rate limiter (generous in dev, protective in prod)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 10000 : 500, // 10,000 in dev for smooth simulation, 500 in prod
    message: {
        error: 'Too many requests',
        message: 'You have exceeded the request limit. Please try again shortly.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')
});

// Ingestion limiter
const ingestLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: isDev ? 5000 : 100, // 5,000 in dev for high-throughput streaming
    message: {
        error: 'Ingestion rate limit exceeded',
        message: 'Too many logs ingested. Please wait before sending more.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDev && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1')
});

// Limiter for AI explanation requests (Groq API limit protection)
const aiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Max 30 AI requests per minute
    message: {
        error: 'AI explanation rate limit exceeded',
        message: 'Too many AI explanation requests. AI processing is rate-limited to prevent abuse.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Read operations limiter
const readLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: isDev ? 5000 : 300,
    message: {
        error: 'Read rate limit exceeded',
        message: 'Too many read requests. Please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    ingestLimiter,
    aiLimiter,
    readLimiter
};
