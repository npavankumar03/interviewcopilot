import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'meeting-copilot',
    timestamp: new Date().toISOString()
  });
}
