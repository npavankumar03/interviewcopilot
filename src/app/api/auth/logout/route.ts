import { clearAuthCookie } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';

export async function POST() {
  try {
    await clearAuthCookie();
    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
