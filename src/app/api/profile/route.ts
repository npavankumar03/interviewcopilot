import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { successResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';

const updateProfileSchema = z.object({
  fullName: z.string().optional(),
  headline: z.string().optional(),
  roleTitles: z.array(z.string()).optional(),
  techStack: z.array(z.string()).optional(),
  achievements: z.array(z.string()).optional(),
  projects: z.array(z.string()).optional(),
  resumeText: z.string().optional(),
});

// GET: Get user profile
export async function GET() {
  try {
    const user = await requireAuth();

    const profile = await db.userProfile.findUnique({
      where: { userId: user.id },
    });

    // If profile doesn't exist, create one
    if (!profile) {
      const newProfile = await db.userProfile.create({
        data: { userId: user.id },
      });
      return successResponse(newProfile);
    }

    // Parse JSON fields
    const parsedProfile = {
      ...profile,
      roleTitles: profile.roleTitles ? JSON.parse(profile.roleTitles) : null,
      techStack: profile.techStack ? JSON.parse(profile.techStack) : null,
      achievements: profile.achievements ? JSON.parse(profile.achievements) : null,
      projects: profile.projects ? JSON.parse(profile.projects) : null,
    };

    return successResponse(parsedProfile);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT: Update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const validated = updateProfileSchema.parse(body);

    // Prepare update data with JSON fields
    const updateData: Record<string, unknown> = {};
    
    if (validated.fullName !== undefined) updateData.fullName = validated.fullName;
    if (validated.headline !== undefined) updateData.headline = validated.headline;
    if (validated.roleTitles !== undefined) updateData.roleTitles = JSON.stringify(validated.roleTitles);
    if (validated.techStack !== undefined) updateData.techStack = JSON.stringify(validated.techStack);
    if (validated.achievements !== undefined) updateData.achievements = JSON.stringify(validated.achievements);
    if (validated.projects !== undefined) updateData.projects = JSON.stringify(validated.projects);
    if (validated.resumeText !== undefined) updateData.resumeText = validated.resumeText;

    // Upsert profile
    const profile = await db.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...updateData,
      },
      update: updateData,
    });

    // Parse JSON fields for response
    const parsedProfile = {
      ...profile,
      roleTitles: profile.roleTitles ? JSON.parse(profile.roleTitles) : null,
      techStack: profile.techStack ? JSON.parse(profile.techStack) : null,
      achievements: profile.achievements ? JSON.parse(profile.achievements) : null,
      projects: profile.projects ? JSON.parse(profile.projects) : null,
    };

    return successResponse(parsedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return successResponse({ error: error.errors[0].message }, 400);
    }
    return handleApiError(error);
  }
}
