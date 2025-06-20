import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const db = getDatabase();
    const messages = await db.getSessionMessages(sessionId);
    
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch messages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, type, content, metadata } = body;
    
    if (!sessionId || !type || !content) {
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, type, and content are required' 
      }, { status: 400 });
    }
    
    const db = getDatabase();
    
    // セッションの存在確認
    const session = await db.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const message = await db.addMessage(sessionId, type, content, metadata);
    return NextResponse.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    return NextResponse.json({ 
      error: 'Failed to add message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 