import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

// Export TaskType for use in other modules
export { TaskType };

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Generates embeddings for a single text using Gemini Embeddings API
 * @param text The input text to generate embeddings for
 * @param taskType Optional task type for the embedding (default: 'RETRIEVAL_DOCUMENT')
 * @returns A promise that resolves to an array of embedding values (number[])
 */
export async function generateEmbedding(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Use the embedding model (text-embedding-004 is the latest model)
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Generate embeddings for the input text
    // Content structure: { role: string, parts: [{ text: string }] }
    const result = await model.embedContent({
      content: {
        role: 'user',
        parts: [{ text }],
      },
      taskType,
    });

    // Extract and return the embedding values
    const embedding = result.embedding;
    
    if (!embedding || !embedding.values) {
      throw new Error('Failed to generate embeddings: invalid response');
    }

    return embedding.values;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Generates embeddings for multiple texts in batch using batchEmbedContents
 * @param texts Array of texts to generate embeddings for
 * @param taskType Optional task type for the embeddings (default: 'RETRIEVAL_DOCUMENT')
 * @returns A promise that resolves to an array of embedding arrays
 */
export async function generateEmbeddings(
  texts: string[],
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[][]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    // Use the embedding model
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Use batchEmbedContents for better performance
    const result = await model.batchEmbedContents({
      requests: texts.map(text => ({
        content: {
          role: 'user',
          parts: [{ text }],
        },
        taskType,
      })),
    });

    // Extract and return the embedding values
    if (!result.embeddings || result.embeddings.length === 0) {
      throw new Error('Failed to generate batch embeddings: invalid response');
    }

    return result.embeddings.map(embedding => embedding.values);
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw error;
  }
}

/**
 * Get the embedding dimension for the model
 * Gemini text-embedding-004 returns 768-dimensional vectors
 */
export const EMBEDDING_DIMENSION = 768;

