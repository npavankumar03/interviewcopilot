import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, notFoundError } from '@/lib/api-utils';

// POST: End session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const session = await db.session.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!session) {
      return notFoundError('Session');
    }

    if (session.status === 'ended') {
      return errorResponse('Session already ended');
    }

    // End the session
    const updatedSession = await db.session.update({
      where: { id },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });

    // Update session state
    await db.sessionState.updateMany({
      where: { sessionId: id },
      data: { state: 'DONE' },
    });

    return successResponse(updatedSession);
  } catch (error) {
    return handleApiError(error);
  }
}
