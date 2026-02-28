import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  priceCents: z.number().min(0, 'Price must be non-negative'),
  creditsPerUnit: z.number().min(1, 'Credits must be at least 1'),
});

// GET: List all plans
export async function GET() {
  try {
    await requireAdmin();

    const plans = await db.plan.findMany({
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { priceCents: 'asc' },
    });

    return successResponse(plans);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: Create new plan
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const validated = createPlanSchema.parse(body);

    // Check if plan with same name exists
    const existing = await db.plan.findUnique({
      where: { name: validated.name },
    });

    if (existing) {
      return errorResponse('Plan with this name already exists');
    }

    const plan = await db.plan.create({
      data: validated,
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'plan_create',
        targetType: 'plan',
        targetId: plan.id,
        meta: JSON.stringify(validated),
      },
    });

    return successResponse(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message);
    }
    return handleApiError(error);
  }
}
