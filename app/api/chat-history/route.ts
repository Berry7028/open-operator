import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/app/lib/database';

// レガシー形式との互換性のための型変換
function formatSessionForLegacy(session: any) {
  return {
    id: session.id,
    title: session.title,
    message: session.initial_message,
    timestamp: session.created_at,
    status: session.status,
    browserSessionId: session.browser_session_id,
    finalResult: session.final_result
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = getDatabase();
    
    if (id) {
      const sessionData = await db.getSessionWithDetails(id);
      if (!sessionData) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      return NextResponse.json({
        ...formatSessionForLegacy(sessionData.session),
        messages: sessionData.messages,
        steps: sessionData.steps
      });
    }
    
    // 全セッションを取得
    const sessions = await db.getAllSessions();
    const formattedSessions = sessions.map(formatSessionForLegacy);
    
    return NextResponse.json(formattedSessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDatabase();
    
    // 必須フィールドの検証
    if (!body.title || !body.message) {
      return NextResponse.json({ 
        error: 'Missing required fields: title and message are required' 
      }, { status: 400 });
    }
    
    // トランザクション内でセッションとメッセージを作成
    const result = await db.transaction(async () => {
      // セッションを作成
      const session = await db.createSession(
        body.title, 
        body.message, 
        body.browserSessionId
      );
      
      // 初期ユーザーメッセージを追加
      await db.addMessage(session.id, 'user', body.message);
      
      return formatSessionForLegacy(session);
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating chat session:', error);
    return NextResponse.json({ 
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
    const db = getDatabase();
    
    // セッションの存在確認
    const existingSession = await db.getSession(id);
    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    // トランザクション内で更新
    const result = await db.transaction(async () => {
      // ステータス更新
      if (body.status) {
        await db.updateSessionStatus(id, body.status, body.finalResult);
      }
      
      // メッセージ追加
      if (body.messages && Array.isArray(body.messages)) {
        for (const message of body.messages) {
          if (message.type && message.content) {
            await db.addMessage(id, message.type, message.content, message.metadata);
          }
        }
      }
      
      // ステップ追加
      if (body.steps && Array.isArray(body.steps)) {
        for (const step of body.steps) {
          if (step.tool && step.instruction && step.reasoning && step.text) {
            await db.addStep(
              id,
              step.stepNumber || 1,
              step.tool,
              step.instruction,
              step.reasoning,
              step.text
            );
          }
        }
      }
      
      // 更新されたセッション情報を取得
      const sessionData = await db.getSessionWithDetails(id);
      return {
        ...formatSessionForLegacy(sessionData!.session),
        messages: sessionData!.messages,
        steps: sessionData!.steps
      };
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating chat session:', error);
    return NextResponse.json({ 
      error: 'Failed to update session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    const db = getDatabase();
    const success = await db.deleteSession(id);
    
    if (!success) {
      return NextResponse.json({ error: 'Session not found or failed to delete' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json({ 
      error: 'Failed to delete session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 