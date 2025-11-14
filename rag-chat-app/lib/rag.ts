import { generateEmbedding, generateEmbeddings, TaskType } from './embeddings';
import { getPineconeIndex, upsertVectors, queryVectors } from './pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { chunkText } from './utils/chunking';
import type { RecordMetadata } from '@pinecone-database/pinecone';

// Initialize Gemini for chat
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Process and store document in Pinecone
 * @param text Document text content
 * @param source Document source (filename, URL, etc.)
 * @param documentId Unique document identifier
 */
export async function processDocument(
  text: string,
  source: string,
  documentId: string
): Promise<void> {
  try {
    // Chunk the document
    const chunks = chunkText(text, 1000, 200);

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(
      chunks,
      TaskType.RETRIEVAL_DOCUMENT
    );

    // Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, index) => ({
      id: `${documentId}-chunk-${index}`,
      values: embeddings[index],
      metadata: {
        text: chunk,
        source,
        chunkIndex: index,
        documentId,
        createdAt: new Date().toISOString(),
      } as RecordMetadata,
    }));

    // Upsert to Pinecone
    const index = await getPineconeIndex();
    await upsertVectors(index, vectors);

    console.log(`Processed document ${documentId}: ${chunks.length} chunks`);
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

/**
 * Query RAG system and generate response
 * @param query User query
 * @param topK Number of relevant chunks to retrieve (default: 5)
 * @returns Generated response with context
 */
export async function queryRAG(
  query: string,
  topK: number = 5
): Promise<{ response: string; sources: string[] }> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(
      query,
      TaskType.RETRIEVAL_QUERY
    );

    // Query Pinecone for similar chunks
    let index;
    let results;
    try {
      index = await getPineconeIndex();
      results = await queryVectors(index, queryEmbedding, topK);
    } catch (pineconeError) {
      console.error('Pinecone error in queryRAG:', pineconeError);
      // Re-throw with context
      if (pineconeError instanceof Error) {
        throw new Error(`Pinecone connection failed: ${pineconeError.message}`);
      }
      throw new Error('Failed to query Pinecone vector database');
    }

    // Extract context from retrieved chunks
    const context = results
      .map((result) => {
        const text = result.metadata?.text as string | undefined;
        return text || '';
      })
      .filter((text) => text.length > 0)
      .join('\n\n');

    const sources = results
      .map((result) => result.metadata?.source as string | undefined)
      .filter((source): source is string => !!source);

    // Check if we have any context
    if (!context || context.trim().length === 0) {
      return {
        response: 'I don\'t have any documents loaded yet. Please upload some documents first so I can answer your questions based on their content.',
        sources: [],
      };
    }

    // Generate response using Gemini
    // Use environment variable or fallback to gemini-pro
    const modelName = process.env.GEMINI_MODEL || 'gemini-pro';
    
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a helpful assistant. Answer the user's question based on the following context. If the context doesn't contain enough information, say so.

Context:
${context}

Question: ${query}

Answer:`;

    let response: string;
    try {
      const result = await model.generateContent(prompt);
      response = result.response.text();
    } catch (geminiError) {
      console.error('Gemini API error:', geminiError);
      if (geminiError instanceof Error) {
        throw new Error(`Gemini API error: ${geminiError.message}`);
      }
      throw new Error('Failed to generate response from Gemini');
    }

    return {
      response,
      sources: [...new Set(sources)], // Remove duplicates
    };
  } catch (error) {
    console.error('Error querying RAG:', error);
    throw error;
  }
}

