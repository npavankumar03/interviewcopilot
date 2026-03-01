// Import Prisma client from the main project
import { PrismaClient } from '../../../node_modules/@prisma/client';
import { resolve } from 'path';

// Compute absolute path to database from project root
// When running from mini-services/realtime-service, we need to go up 2 levels
const projectRoot = resolve(import.meta.dir, '../../../');
const defaultDbPath = resolve(projectRoot, 'db/meeting-copilot.db');

// Use environment variable or computed absolute path
const databaseUrl = process.env.DATABASE_URL || `file:${defaultDbPath}`;

console.log(`Database path: ${databaseUrl}`);

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

export default prisma;
