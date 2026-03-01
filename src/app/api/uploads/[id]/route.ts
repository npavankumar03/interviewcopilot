import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError, notFoundError } from '@/lib/api-utils';
import { unlink } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// GET: Get upload by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const upload = await db.upload.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        retrievalChunks: {
          orderBy: { chunkIndex: 'asc' },
        },
        session: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    if (!upload) {
      return notFoundError('Upload');
    }

    return successResponse(upload);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE: Delete upload
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const upload = await db.upload.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!upload) {
      return notFoundError('Upload');
    }

    // Delete file from disk if exists
    if (upload.storageUrl) {
      const filename = upload.storageUrl.split('/').pop();
      if (filename) {
        try {
          await unlink(path.join(UPLOAD_DIR, filename));
        } catch {
          // File might not exist, continue
        }
      }
    }

    // Delete from database (cascade will delete chunks)
    await db.upload.delete({
      where: { id },
    });

    return successResponse({ message: 'Upload deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
