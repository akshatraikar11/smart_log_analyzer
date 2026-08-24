/**
 * Prisma client singleton
 * Reads DATABASE_URL from environment — never hardcode credentials.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

async function testConnection() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch (error) {
        console.error('Prisma connection failed:', error.message);
        return false;
    }
}

async function disconnect() {
    await prisma.$disconnect();
}

module.exports = {
    prisma,
    testConnection,
    disconnect,
};
