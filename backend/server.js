/**
 * Express server setup for Smart Log Analyzer
 */

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load root .env before any module that reads process.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db = require('./config/database');
const { disconnect: disconnectPrisma } = require('./config/prisma');
const { apiLimiter } = require('./middleware/rateLimiter');
const socketManager = require('./services/socketManager');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support large batch uploads
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealthy = await db.testConnection();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbHealthy ? 'connected' : 'disconnected',
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Service unavailable',
            error: error.message
        });
    }
});

// Import routes
const logsRoutes = require('./routes/logs');
const anomaliesRoutes = require('./routes/anomalies');
const statsRoutes = require('./routes/stats');
const ingestRoutes = require('./routes/ingest');
const uploadRoutes = require('./routes/upload');

// Mount routes
app.use('/api/logs', logsRoutes);
app.use('/api/anomalies', anomaliesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/upload', uploadRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Smart Log Analyzer API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            logs: '/api/logs',
            anomalies: '/api/anomalies',
            stats: '/api/stats',
            ingest: '/api/ingest'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        availableRoutes: ['/api/logs', '/api/anomalies', '/api/stats', '/api/ingest']
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    
    // Don't expose internal errors in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(err.status || 500).json({
        error: 'Server Error',
        message: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// Start server
async function startServer() {
    try {
        // Test database connection before starting
        const dbConnected = await db.testConnection();
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Please check your DATABASE_URL');
            process.exit(1);
        }

        // Attach Socket.IO to the HTTP server
        socketManager.init(httpServer);
        
        httpServer.listen(PORT, () => {
            console.log('╔════════════════════════════════════════╗');
            console.log('║  Smart Log Analyzer API Server        ║');
            console.log('╚════════════════════════════════════════╝');
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
            console.log(`🔌 WebSocket:    ws://localhost:${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log('');
            console.log('Press Ctrl+C to stop');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📡 SIGTERM received, shutting down gracefully...');
    await db.close();
    await disconnectPrisma();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n📡 SIGINT received, shutting down gracefully...');
    await db.close();
    await disconnectPrisma();
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = app;
