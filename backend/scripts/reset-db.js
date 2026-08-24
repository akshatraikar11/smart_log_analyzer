const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { prisma, disconnect } = require('../config/prisma');

async function main() {
    await prisma.anomalyFlag.deleteMany();
    await prisma.log.deleteMany();
    console.log('cleared logs and flags');
}

main()
    .catch((err) => {
        console.error(err.message);
        process.exit(1);
    })
    .finally(() => disconnect());
