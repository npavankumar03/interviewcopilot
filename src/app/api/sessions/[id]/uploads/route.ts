import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError, notFoundError } from '@/lib/api-utils';

// GET: Get uploads for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Verify session belongs to user
    const session = await db.session.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!session) {
      return notFoundError('Session');
    }

    const uploads = await db.upload.findMany({
      where: {
        sessionId: id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { retrievalChunks: true },
        },
      },
    });

    return successResponse(uploads);
  } catch (error) {
    return handleApiError(error);
  }
}
