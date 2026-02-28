import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

// GET: Get credit balance
export async function GET() {
  try {
    const user = await requireAuth();

    // Calculate total credits from ledger
    const credits = await db.creditsLedger.aggregate({
      where: { userId: user.id },
      _sum: { delta: true },
    });

    const balance = credits._sum.delta || 0;

    // Get recent transactions
    const recentTransactions = await db.creditsLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Parse meta field for transactions
    const transactions = recentTransactions.map(t => ({
      ...t,
      meta: t.meta ? JSON.parse(t.meta) : null,
    }));

    return successResponse({
      balance,
      transactions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
