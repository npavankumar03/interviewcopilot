import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'

// GET - List sessions
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = { userId: user.id }
    if (status) where.status = status
    if (type) where.type = type
    if (search) {
      where.OR = [
        { title: { contains: search } },
      ]
    }

    // Get sessions
    const [sessions, total] = await Promise.all([
      db.session.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          responseStyle: true,
          createdAt: true,
          endedAt: true,
          _count: {
            select: {
              transcriptTurns: true,
              assistantMessages: true,
            },
          },
        },
      }),
      db.session.count({ where }),
    ])

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        endedAt: s.endedAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json(
      { error: 'An error occurred while fetching sessions' },
      { status: 500 }
    )
  }
}

// POST - Create new session
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, type = 'meeting', responseStyle = 'short', customStylePrompt } = body

    const session = await db.session.create({
      data: {
        userId: user.id,
        title: title || `New ${type} session`,
        type,
        status: 'active',
        responseStyle,
        customStylePrompt,
      },
    })

    return NextResponse.json({
      session: {
        ...session,
        createdAt: session.createdAt.toISOString(),
        endedAt: session.endedAt?.toISOString(),
      },
    })
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json(
      { error: 'An error occurred while creating session' },
      { status: 500 }
    )
  }
}
