import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// GET: List uploads for current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sessionId = searchParams.get('sessionId') || undefined;

    const uploads = await db.upload.findMany({
      where: {
        userId: user.id,
        ...(sessionId && { sessionId }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.upload.count({
      where: {
        userId: user.id,
        ...(sessionId && { sessionId }),
      },
    });

    return successResponse({
      uploads,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: Upload file
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    await ensureUploadDir();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionId = formData.get('sessionId') as string | null;

    if (!file) {
      return successResponse({ error: 'No file provided' }, 400);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'bin';
    const filename = `${timestamp}-${randomId}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Extract text for certain file types (basic implementation)
    let extractedText: string | null = null;
    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      extractedText = await file.text();
    }

    // Create upload record
    const upload = await db.upload.create({
      data: {
        userId: user.id,
        sessionId: sessionId || null,
        filename: file.name,
        mime: file.type,
        storageUrl: `/uploads/${filename}`,
        extractedText,
      },
    });

    return successResponse(upload, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
