// Import Prisma client from the main project
// The DATABASE_URL must be set BEFORE importing PrismaClient

// Set default database URL if not provided
if (!process.env.DATABASE_URL) {
  // Compute absolute path relative to project root
  const { resolve } = await import('path');
  const { fileURLToPath } = await import('url');
  const projectRoot = resolve(fileURLToPath(import.meta.url), '../../../..');
  process.env.DATABASE_URL = `file:${projectRoot}/db/meeting-copilot.db`;
}

console.log(`[realtime-service] Database: ${process.env.DATABASE_URL}`);

// Now import PrismaClient after DATABASE_URL is set
const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

export default prisma;
