#!/usr/bin/env node
/**
 * CLI entry point for ingesting the synthetic dataset.
 *
 * Usage:
 *   node backend/scripts/ingest-dataset.js
 *   node backend/scripts/ingest-dataset.js --file data/synthetic-logs.json
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ingestionService = require('../services/ingestion');
const { disconnect } = require('../config/prisma');

function parseArgs(argv) {
    const args = {};

    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--file' && argv[i + 1]) {
            args.filePath = path.resolve(argv[++i]);
        } else if (argv[i] === '--format' && argv[i + 1]) {
            args.format = argv[++i];
        }
    }

    return args;
}

async function main() {
    const args = parseArgs(process.argv);

    const result = await ingestionService.ingestFromFile({
        filePath: args.filePath,
        format: args.format,
    });

    console.log(JSON.stringify(result, null, 2));

    if (!result.success && result.message?.includes('not found')) {
        process.exitCode = 1;
    }
}

main()
    .catch((error) => {
        console.error('Ingestion failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnect();
    });
