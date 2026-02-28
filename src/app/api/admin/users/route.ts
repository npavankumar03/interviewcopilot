import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

// GET: List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const users = await db.user.findMany({
      where: {
        ...(role && { role }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { email: { contains: search.toLowerCase() } },
            { profile: { fullName: { contains: search } } },
          ],
        }),
      },
      include: {
        profile: {
          select: {
            fullName: true,
            headline: true,
          },
        },
        _count: {
          select: {
            sessions: true,
            uploads: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.user.count({
      where: {
        ...(role && { role }),
        ...(status && { status }),
        ...(search && {
          OR: [
            { email: { contains: search.toLowerCase() } },
            { profile: { fullName: { contains: search } } },
          ],
        }),
      },
    });

    // Remove password hash from response
    const safeUsers = users.map(({ passwordHash: _, ...user }) => user);

    return successResponse({
      users: safeUsers,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
