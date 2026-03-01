import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError, notFoundError } from '@/lib/api-utils';
import { z } from 'zod';

const purchaseSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  paymentMethodId: z.string().optional(), // For Stripe integration
});

// POST: Purchase credits
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = purchaseSchema.parse(body);

    // Find the plan
    const plan = await db.plan.findUnique({
      where: { id: validated.planId },
    });

    if (!plan) {
      return notFoundError('Plan');
    }

    // In a real app, you would integrate with Stripe here
    // For now, we'll just add the credits directly
    
    // Create credit ledger entry
    const ledgerEntry = await db.creditsLedger.create({
      data: {
        userId: user.id,
        delta: plan.creditsPerUnit,
        reason: 'purchase',
        meta: JSON.stringify({
          planId: plan.id,
          planName: plan.name,
          priceCents: plan.priceCents,
        }),
      },
    });

    // Calculate new balance
    const credits = await db.creditsLedger.aggregate({
      where: { userId: user.id },
      _sum: { delta: true },
    });

    const newBalance = credits._sum.delta || 0;

    return successResponse({
      message: 'Credits purchased successfully',
      creditsAdded: plan.creditsPerUnit,
      newBalance,
      ledgerEntry: {
        ...ledgerEntry,
        meta: JSON.parse(ledgerEntry.meta || '{}'),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message);
    }
    return handleApiError(error);
  }
}
