/**
 * API Client for Smart Log Analyzer
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor for logging
api.interceptors.request.use(
    (config) => {
        console.log(`→ ${config.method.toUpperCase()} ${config.url}`);
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => {
        console.log(`← ${response.status} ${response.config.url}`);
        return response;
    },
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
    }
);

// Logs API
export const logsAPI = {
    /**
     * Get paginated logs with filtering
     */
    getLogs: async (params = {}) => {
        const response = await api.get('/logs', { params });
        return response.data;
    },

    /**
     * Get single log by ID
     */
    getLogById: async (id) => {
        const response = await api.get(`/logs/${id}`);
        return response.data;
    },

    /**
     * Ingest single or batch logs
     */
    ingestLogs: async (logs) => {
        const payload = Array.isArray(logs) ? { logs } : logs;
        const response = await api.post('/logs/ingest', payload);
        return response.data;
    },

    /**
     * Upload a log file (CSV, JSON, LOG)
     */
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    /**
     * Manually trigger analysis for a log
     */
    analyzeLog: async (id) => {
        const response = await api.post(`/logs/${id}/analyze`);
        return response.data;
    }
};

// Anomalies API
export const anomaliesAPI = {
    /**
     * Get all anomalies with pagination
     */
    getAnomalies: async (params = {}) => {
        const response = await api.get('/anomalies', { params });
        return response.data;
    },

    /**
     * Get single anomaly by ID
     */
    getAnomalyById: async (id) => {
        const response = await api.get(`/anomalies/${id}`);
        return response.data;
    },

    /**
     * Trigger AI explanation for an anomaly
     */
    explainAnomaly: async (id) => {
        const response = await api.post(`/anomalies/${id}/explain`);
        return response.data;
    },

    /**
     * Batch explain all unprocessed anomalies
     */
    explainAll: async (batchSize = 10) => {
        const response = await api.post('/anomalies/explain-all', null, {
            params: { batchSize }
        });
        return response.data;
    },

    /**
     * Get anomaly statistics summary
     */
    getStats: async () => {
        const response = await api.get('/anomalies/stats/summary');
        return response.data;
    }
};

// Stats API
export const statsAPI = {
    /**
     * Get overall statistics
     */
    getOverallStats: async () => {
        const response = await api.get('/stats');
        return response.data;
    },

    /**
     * Get timeline data
     */
    getTimeline: async (interval = 'hour', period = '24h') => {
        const response = await api.get('/stats/timeline', {
            params: { interval, period }
        });
        return response.data;
    },

    /**
     * Get event type statistics
     */
    getEventTypes: async () => {
        const response = await api.get('/stats/event-types');
        return response.data;
    }
};

// Health check
export const healthCheck = async () => {
    const response = await api.get('/health');
    return response.data;
};

export default api;
