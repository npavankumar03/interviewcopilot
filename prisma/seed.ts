// Seed script for Meeting Copilot SaaS
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@meetingcopilot.com' },
    update: {},
    create: {
      email: 'admin@meetingcopilot.com',
      passwordHash: adminPassword,
      role: 'admin',
      status: 'active'
    }
  });

  console.log('✅ Created admin user:', admin.email);

  // Create admin profile
  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      fullName: 'Admin User',
      headline: 'System Administrator',
      roleTitles: JSON.stringify(['Administrator', 'Developer']),
      techStack: JSON.stringify(['TypeScript', 'Next.js', 'PostgreSQL']),
      achievements: JSON.stringify(['System setup', 'Initial deployment']),
      projects: JSON.stringify(['Meeting Copilot Platform'])
    }
  });

  // Create demo user
  const demoPassword = await bcrypt.hash('demo123', 12);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@meetingcopilot.com' },
    update: {},
    create: {
      email: 'demo@meetingcopilot.com',
      passwordHash: demoPassword,
      role: 'user',
      status: 'active'
    }
  });

  console.log('✅ Created demo user:', demo.email);

  // Create demo profile
  await prisma.userProfile.upsert({
    where: { userId: demo.id },
    update: {},
    create: {
      userId: demo.id,
      fullName: 'Demo User',
      headline: 'Software Engineer',
      roleTitles: JSON.stringify(['Full Stack Developer', 'Frontend Engineer']),
      techStack: JSON.stringify(['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'AWS']),
      achievements: JSON.stringify([
        'Led migration to microservices, reducing deployment time by 60%',
        'Built real-time dashboard serving 10K+ concurrent users',
        'Mentored 5 junior developers on best practices'
      ]),
      projects: JSON.stringify([
        'E-commerce Platform - Full stack Next.js application with Stripe integration',
        'Analytics Dashboard - Real-time data visualization with D3.js',
        'API Gateway - Custom rate limiting and authentication service'
      ])
    }
  });

  // Give demo user initial credits
  await prisma.creditsLedger.create({
    data: {
      userId: demo.id,
      delta: 1000,
      reason: 'purchase',
      meta: JSON.stringify({ source: 'demo_setup' })
    }
  });

  // Create plans
  const plans = [
    { name: 'Free', priceCents: 0, creditsPerUnit: 100 },
    { name: 'Pro', priceCents: 1999, creditsPerUnit: 1000 },
    { name: 'Enterprise', priceCents: 4999, creditsPerUnit: 5000 }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan
    });
  }

  console.log('✅ Created plans');

  // Create API settings (placeholder)
  const apiSettings = [
    { key: 'openai_api_key', encryptedValue: '' },
    { key: 'gemini_api_key', encryptedValue: '' },
    { key: 'azure_speech_key', encryptedValue: '' },
    { key: 'azure_region', encryptedValue: 'eastus' },
    { key: 'openai_model', encryptedValue: 'gpt-4o-mini' },
    { key: 'gemini_model', encryptedValue: 'gemini-2.0-flash' }
  ];

  for (const setting of apiSettings) {
    await prisma.apiSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }

  console.log('✅ Created API settings');

  // Create demo sessions
  const session1 = await prisma.session.create({
    data: {
      userId: demo.id,
      title: 'Technical Interview Practice',
      type: 'interview',
      status: 'ended',
      responseStyle: 'star',
      endedAt: new Date(Date.now() - 3600000) // 1 hour ago
    }
  });

  const session2 = await prisma.session.create({
    data: {
      userId: demo.id,
      title: 'Sales Call - Acme Corp',
      type: 'sales',
      status: 'active',
      responseStyle: 'detailed'
    }
  });

  console.log('✅ Created demo sessions');

  // Add sample transcript turns
  await prisma.transcriptTurn.createMany({
    data: [
      {
        sessionId: session1.id,
        seq: 1,
        source: 'final',
        text: 'Tell me about your experience with React and how you handle state management in large applications.',
        confidence: 0.95
      },
      {
        sessionId: session1.id,
        seq: 2,
        source: 'final',
        text: 'Can you describe a challenging bug you encountered and how you solved it?',
        confidence: 0.92
      },
      {
        sessionId: session1.id,
        seq: 3,
        source: 'final',
        text: 'What interests you about this role?',
        confidence: 0.97
      }
    ]
  });

  // Add sample assistant messages
  await prisma.assistantMessage.createMany({
    data: [
      {
        sessionId: session1.id,
        requestId: 'req-001',
        questionText: 'Tell me about your experience with React and how you handle state management in large applications.',
        answerText: '**Situation**: In my previous role at TechCorp, I worked on a large-scale dashboard application serving 10K+ concurrent users.\n\n**Task**: We needed to manage complex state across multiple modules while maintaining performance and developer experience.\n\n**Action**: I implemented a hybrid state management approach using React Query for server state and Zustand for client state. This separation improved both performance and code maintainability.\n\n**Result**: The application saw a 40% reduction in unnecessary re-renders and developer productivity improved by 25% due to simpler state patterns.',
        tier: 't0',
        model: 'gpt-4o-mini',
        provider: 'openai'
      }
    ]
  });

  // Add sample metrics
  await prisma.llmMetric.createMany({
    data: [
      {
        sessionId: session1.id,
        requestId: 'req-001',
        provider: 'openai',
        model: 'gpt-4o-mini',
        ttftMs: 450,
        totalMs: 1200,
        promptTokens: 150,
        completionTokens: 180
      }
    ]
  });

  console.log('✅ Created sample data');

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: 'system_seed',
      targetType: 'system',
      targetId: 'database',
      meta: JSON.stringify({ timestamp: new Date().toISOString() })
    }
  });

  console.log('🎉 Seed completed successfully!');
  console.log('\n📋 Test Accounts:');
  console.log('   Admin: admin@meetingcopilot.com / admin123');
  console.log('   Demo:  demo@meetingcopilot.com / demo123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
