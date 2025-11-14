import { NextRequest, NextResponse } from 'next/server';
import { queryRAG } from '@/lib/rag';

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Validate conversation history format
    const history = Array.isArray(conversationHistory) 
      ? conversationHistory.filter(
          (msg: any) => 
            msg && 
            typeof msg === 'object' && 
            (msg.role === 'user' || msg.role === 'assistant') &&
            typeof msg.content === 'string'
        )
      : [];

    // Query RAG system with conversation history
    const result = await queryRAG(message, 5, history);

    return NextResponse.json({
      message: result.response,
      sources: result.sources,
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

