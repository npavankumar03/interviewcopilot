import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

// GET: Get system metrics (admin only)
export async function GET() {
  try {
    await requireAdmin();

    // Get counts
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      totalSessions,
      activeSessions,
      endedSessions,
      totalUploads,
      totalMessages,
      totalCreditsUsed,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: 'active' } }),
      db.user.count({ where: { status: 'disabled' } }),
      db.session.count(),
      db.session.count({ where: { status: 'active' } }),
      db.session.count({ where: { status: 'ended' } }),
      db.upload.count(),
      db.assistantMessage.count(),
      db.creditsLedger.aggregate({
        where: { delta: { lt: 0 } },
        _sum: { delta: true },
      }),
    ]);

    // Get users by role
    const usersByRole = await db.user.groupBy({
      by: ['role'],
      _count: true,
    });

    // Get sessions by type
    const sessionsByType = await db.session.groupBy({
      by: ['type'],
      _count: true,
    });

    // Get daily activity for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyActivity = await db.session.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    // Simplify daily activity to just dates
    const dailyActivityByDate = dailyActivity.reduce((acc, curr) => {
      const date = curr.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + curr._count;
      return acc;
    }, {} as Record<string, number>);

    // Get LLM metrics
    const llmMetrics = await db.llmMetric.aggregate({
      _avg: {
        ttftMs: true,
        totalMs: true,
      },
      _sum: {
        promptTokens: true,
        completionTokens: true,
      },
      _count: true,
    });

    return successResponse({
      users: {
        total: totalUsers,
        active: activeUsers,
        disabled: disabledUsers,
        byRole: usersByRole.map(r => ({ role: r.role, count: r._count })),
      },
      sessions: {
        total: totalSessions,
        active: activeSessions,
        ended: endedSessions,
        byType: sessionsByType.map(s => ({ type: s.type, count: s._count })),
      },
      uploads: {
        total: totalUploads,
      },
      messages: {
        total: totalMessages,
      },
      credits: {
        totalUsed: Math.abs(totalCreditsUsed._sum.delta || 0),
      },
      activity: {
        daily: dailyActivityByDate,
      },
      llm: {
        totalRequests: llmMetrics._count,
        avgTtftMs: llmMetrics._avg.ttftMs,
        avgTotalMs: llmMetrics._avg.totalMs,
        totalPromptTokens: llmMetrics._sum.promptTokens,
        totalCompletionTokens: llmMetrics._sum.completionTokens,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
