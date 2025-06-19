import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllChatSessions, 
  saveChatSession, 
  updateChatSession, 
  deleteChatSession,
  getChatSession
} from '@/app/lib/chatHistory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      const session = await getChatSession(id);
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json(session);
    }
    
    const sessions = await getAllChatSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await saveChatSession(body);
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error saving chat session:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const body = await request.json();
    const updatedSession = await updateChatSession(id, body);
    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error updating chat session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const success = await deleteChatSession(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
} 