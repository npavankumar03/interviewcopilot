import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, notFoundError } from '@/lib/api-utils';
import { z } from 'zod';

const attachSchema = z.object({
  uploadId: z.string().min(1, 'Upload ID is required'),
});

// POST: Attach upload to session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: sessionId } = await params;

    // Verify session belongs to user
    const session = await db.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    });

    if (!session) {
      return notFoundError('Session');
    }

    const body = await request.json();
    const validated = attachSchema.parse(body);

    // Verify upload belongs to user
    const upload = await db.upload.findFirst({
      where: {
        id: validated.uploadId,
        userId: user.id,
      },
    });

    if (!upload) {
      return notFoundError('Upload');
    }

    // Check if already attached to another session
    if (upload.sessionId && upload.sessionId !== sessionId) {
      return errorResponse('Upload is already attached to another session');
    }

    // Attach upload to session
    const updatedUpload = await db.upload.update({
      where: { id: validated.uploadId },
      data: { sessionId },
    });

    return successResponse(updatedUpload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message);
    }
    return handleApiError(error);
  }
}
