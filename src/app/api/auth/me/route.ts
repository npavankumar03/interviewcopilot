import { getCurrentUser } from '@/lib/auth';
import { successResponse, unauthorizedError, handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedError();
    }

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
