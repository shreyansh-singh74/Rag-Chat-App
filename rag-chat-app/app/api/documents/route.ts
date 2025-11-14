import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex, getUniqueDocuments } from '@/lib/pinecone';

export async function GET(request: NextRequest) {
  try {
    const index = await getPineconeIndex();
    const documents = await getUniqueDocuments(index);

    // Sort by createdAt (newest first)
    documents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

