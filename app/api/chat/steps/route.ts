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
    const steps = await db.getSessionSteps(sessionId);
    
    return NextResponse.json(steps);
  } catch (error) {
    console.error('Error fetching steps:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch steps',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, stepNumber, tool, instruction, reasoning, text } = body;
    
    if (!sessionId || !tool || !instruction || !reasoning || !text) {
      return NextResponse.json({ 
        error: 'Missing required fields: sessionId, tool, instruction, reasoning, and text are required' 
      }, { status: 400 });
    }
    
    const db = getDatabase();
    
    // セッションの存在確認
    const session = await db.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    const step = await db.addStep(sessionId, stepNumber || 1, tool, instruction, reasoning, text);
    return NextResponse.json(step);
  } catch (error) {
    console.error('Error adding step:', error);
    return NextResponse.json({ 
      error: 'Failed to add step',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stepId = searchParams.get('stepId');
    
    if (!stepId) {
      return NextResponse.json({ error: 'Step ID required' }, { status: 400 });
    }
    
    const body = await request.json();
    const { status, errorMessage, result } = body;
    
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }
    
    const db = getDatabase();
    
    // ステップの存在確認
    const step = await db.getStep(stepId);
    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }
    
    await db.updateStepStatus(stepId, status, errorMessage, result);
    
    const updatedStep = await db.getStep(stepId);
    return NextResponse.json(updatedStep);
  } catch (error) {
    console.error('Error updating step:', error);
    return NextResponse.json({ 
      error: 'Failed to update step',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 