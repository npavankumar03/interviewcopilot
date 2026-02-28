import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, notFoundError } from '@/lib/api-utils';
import { z } from 'zod';

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

// PUT: Update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    // Prevent admin from disabling themselves
    if (id === admin.id && validated.status === 'disabled') {
      return errorResponse('Cannot disable your own account');
    }

    const user = await db.user.findUnique({
      where: { id },
    });

    if (!user) {
      return notFoundError('User');
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: validated,
      include: {
        profile: {
          select: {
            fullName: true,
            headline: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'user_update',
        targetType: 'user',
        targetId: id,
        meta: JSON.stringify({
          changes: validated,
          previousRole: user.role,
          previousStatus: user.status,
        }),
      },
    });

    // Remove password hash from response
    const { passwordHash: _, ...safeUser } = updatedUser;

    return successResponse(safeUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message);
    }
    return handleApiError(error);
  }
}
