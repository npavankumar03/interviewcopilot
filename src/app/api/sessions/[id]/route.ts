import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, notFoundError } from '@/lib/api-utils';

// GET: Get session by ID
export async function GET(
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
      include: {
        transcriptTurns: {
          orderBy: { seq: 'asc' },
          take: 100,
        },
        assistantMessages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        uploads: {
          orderBy: { createdAt: 'desc' },
        },
        conversationSummary: true,
        _count: {
          select: {
            transcriptTurns: true,
            assistantMessages: true,
            uploads: true,
          },
        },
      },
    });

    if (!session) {
      return notFoundError('Session');
    }

    return successResponse(session);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE: End session
export async function DELETE(
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

    return successResponse(updatedSession);
  } catch (error) {
    return handleApiError(error);
  }
}
