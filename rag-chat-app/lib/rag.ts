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
    const index = await getPineconeIndex();
    const results = await queryVectors(index, queryEmbedding, topK);

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

    // Generate response using Gemini
    // Use environment variable or fallback to gemini-pro
    const modelName = process.env.GEMINI_MODEL || 'gemini-pro';
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a helpful assistant. Answer the user's question based on the following context. If the context doesn't contain enough information, say so.

Context:
${context}

Question: ${query}

Answer:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return {
      response,
      sources: [...new Set(sources)], // Remove duplicates
    };
  } catch (error) {
    console.error('Error querying RAG:', error);
    throw error;
  }
}

