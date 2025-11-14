import { NextRequest, NextResponse } from 'next/server';
import { getPineconeIndex, deleteDocumentVectors } from '@/lib/pinecone';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const index = await getPineconeIndex();
    const deletedCount = await deleteDocumentVectors(index, documentId);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} vectors for document`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}

