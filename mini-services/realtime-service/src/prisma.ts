// Import Prisma client from the main project
import { PrismaClient } from '../../../node_modules/@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/home/z/my-project/db/custom.db'
    }
  }
});

export default prisma;
