import { NextRequest, NextResponse } from 'next/server';
import { parseFile } from '@/lib/utils/pdf-parser';
import { processDocument } from '@/lib/rag';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file content
    const text = await parseFile(buffer, file.type);

    // Process and store in Pinecone
    const documentId = randomUUID();
    await processDocument(text, file.name, documentId);

    return NextResponse.json({
      success: true,
      documentId,
      message: 'Document uploaded and processed successfully',
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload and process file' },
      { status: 500 }
    );
  }
}

