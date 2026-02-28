import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(error: string, status = 400): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

export function messageResponse(message: string, status = 200): NextResponse<ApiResponse> {
  return NextResponse.json({ success: true, message }, { status });
}

export function unauthorizedError(): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

export function forbiddenError(): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
}

export function notFoundError(resource = 'Resource'): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: `${resource} not found` }, { status: 404 });
}

export function serverError(error?: string): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error: error || 'Internal server error' },
    { status: 500 }
  );
}

// Helper to handle errors in API routes
export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  console.error('API Error:', error);
  
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return unauthorizedError();
    }
    if (error.message === 'Admin access required') {
      return forbiddenError();
    }
    if (error.message === 'Account disabled') {
      return errorResponse('Account is disabled', 403);
    }
    return errorResponse(error.message);
  }
  
  return serverError();
}
