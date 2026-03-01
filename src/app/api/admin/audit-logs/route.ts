import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

// GET: List audit logs (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action') || undefined;
    const actorUserId = searchParams.get('actorUserId') || undefined;
    const targetType = searchParams.get('targetType') || undefined;

    const logs = await db.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(actorUserId && { actorUserId }),
        ...(targetType && { targetType }),
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: { fullName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.auditLog.count({
      where: {
        ...(action && { action }),
        ...(actorUserId && { actorUserId }),
        ...(targetType && { targetType }),
      },
    });

    // Parse meta field
    const parsedLogs = logs.map(log => ({
      ...log,
      meta: log.meta ? JSON.parse(log.meta) : null,
    }));

    return successResponse({
      logs: parsedLogs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
