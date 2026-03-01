import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from './prisma.js';
import type { AuthUser } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'meeting-copilot-secret-key-change-in-production';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function getUserFromToken(token: string): Promise<AuthUser | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!user || user.status !== 'active') return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status
  };
}

export async function authenticateUser(email: string, password: string): Promise<{ user: AuthUser; token: string } | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user || user.status !== 'active') return null;

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    },
    token
  };
}

export async function createUser(email: string, password: string, role: string = 'user'): Promise<{ user: AuthUser; token: string } | { error: string }> {
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    return { error: 'Email already registered' };
  }

  const hashedPassword = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      role,
      status: 'active'
    }
  });

  // Create user profile
  await prisma.userProfile.create({
    data: {
      userId: user.id
    }
  });

  // Give initial credits
  await prisma.creditsLedger.create({
    data: {
      userId: user.id,
      delta: 1000, // Free initial credits
      reason: 'purchase',
      meta: JSON.stringify({ source: 'signup_bonus' })
    }
  });

  const token = generateToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    },
    token
  };
}
