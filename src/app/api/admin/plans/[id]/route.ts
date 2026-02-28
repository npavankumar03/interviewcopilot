import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, notFoundError } from '@/lib/api-utils';
import { z } from 'zod';

const updatePlanSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  priceCents: z.number().min(0, 'Price must be non-negative').optional(),
  creditsPerUnit: z.number().min(1, 'Credits must be at least 1').optional(),
});

// GET: Get single plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const plan = await db.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return notFoundError('Plan');
    }

    return successResponse(plan);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT: Update plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const validated = updatePlanSchema.parse(body);

    const plan = await db.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      return notFoundError('Plan');
    }

    // Check for duplicate name if name is being updated
    if (validated.name && validated.name !== plan.name) {
      const existing = await db.plan.findUnique({
        where: { name: validated.name },
      });
      if (existing) {
        return errorResponse('Plan with this name already exists');
      }
    }

    const updatedPlan = await db.plan.update({
      where: { id },
      data: validated,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'plan_update',
        targetType: 'plan',
        targetId: id,
        meta: JSON.stringify({
          changes: validated,
          previous: { name: plan.name, priceCents: plan.priceCents, creditsPerUnit: plan.creditsPerUnit },
        }),
      },
    });

    return successResponse(updatedPlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message);
    }
    return handleApiError(error);
  }
}

// DELETE: Delete plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const plan = await db.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return notFoundError('Plan');
    }

    // Check if plan has subscriptions
    if (plan._count.subscriptions > 0) {
      return errorResponse('Cannot delete plan with active subscriptions');
    }

    await db.plan.delete({
      where: { id },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'plan_delete',
        targetType: 'plan',
        targetId: id,
        meta: JSON.stringify({ name: plan.name }),
      },
    });

    return successResponse({ message: 'Plan deleted successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
