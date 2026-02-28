import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import { z } from 'zod';
import crypto from 'crypto';

// Encryption helper (simple implementation - use proper key management in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!';
const ALGORITHM = 'aes-256-gcm';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedValue: string): string {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

const updateSettingSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
});

// Valid API setting keys
const VALID_KEYS = [
  'openai_api_key',
  'gemini_api_key',
  'azure_speech_key',
  'azure_region',
  'anthropic_api_key',
];

// GET: Get all API settings (masked)
export async function GET() {
  try {
    await requireAdmin();

    const settings = await db.apiSetting.findMany();

    // Return masked values for security
    const maskedSettings = settings.map(s => ({
      key: s.key,
      valueSet: true,
      updatedAt: s.updatedAt,
    }));

    // Include all valid keys even if not set
    const allSettings = VALID_KEYS.map(key => {
      const existing = maskedSettings.find(s => s.key === key);
      return existing || { key, valueSet: false, updatedAt: null };
    });

    return successResponse(allSettings);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT: Update API setting
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const validated = updateSettingSchema.parse(body);

    if (!VALID_KEYS.includes(validated.key)) {
      return errorResponse('Invalid setting key');
    }

    // Encrypt the value
    const encryptedValue = encrypt(validated.value);

    // Upsert the setting
    const setting = await db.apiSetting.upsert({
      where: { key: validated.key },
      create: {
        key: validated.key,
        encryptedValue,
      },
      update: {
        encryptedValue,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: 'setting_update',
        targetType: 'api_setting',
        targetId: validated.key,
        meta: JSON.stringify({ key: validated.key }),
      },
    });

    return successResponse({
      key: setting.key,
      valueSet: true,
      updatedAt: setting.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message);
    }
    return handleApiError(error);
  }
}
