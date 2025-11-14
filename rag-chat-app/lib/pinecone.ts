import { Pinecone, Index } from '@pinecone-database/pinecone';
import { EMBEDDING_DIMENSION } from './embeddings';
import type { RecordMetadata } from '@pinecone-database/pinecone';

// Initialize Pinecone client
const getPineconeClient = (): Pinecone => {
  const apiKey = process.env.PINECONE_API_KEY;

  if (!apiKey) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }

  return new Pinecone({ apiKey });
};

// Get or create Pinecone index
export const getPineconeIndex = async (
  indexName?: string
): Promise<Index<RecordMetadata>> => {
  const pinecone = getPineconeClient();
  const targetIndexName = indexName || process.env.PINECONE_INDEX_NAME;

  if (!targetIndexName) {
    throw new Error(
      'PINECONE_INDEX_NAME environment variable is not set and no index name was provided'
    );
  }

  // Check if index exists, create if it doesn't, or recreate if dimension doesn't match
  try {
    const indexes = await pinecone.listIndexes();
    const existingIndex = indexes.indexes?.find(
      (idx) => idx.name === targetIndexName
    );

    if (!existingIndex) {
      console.log(`Creating Pinecone index: ${targetIndexName}`);
      
      // Get cloud and region from env or use defaults
      const cloud = (process.env.PINECONE_CLOUD || 'aws') as 'aws' | 'gcp' | 'azure';
      const region = process.env.PINECONE_REGION || 'us-east-1';

      await pinecone.createIndex({
        name: targetIndexName,
        dimension: EMBEDDING_DIMENSION,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud,
            region,
          },
        },
        waitUntilReady: true,
      });

      console.log(`Index ${targetIndexName} created successfully with dimension ${EMBEDDING_DIMENSION}`);
    } else {
      // Check if dimension matches
      const indexDimension = existingIndex.dimension;
      if (indexDimension !== EMBEDDING_DIMENSION) {
        console.warn(
          `Index ${targetIndexName} has dimension ${indexDimension}, but embeddings are ${EMBEDDING_DIMENSION}. ` +
          `Deleting and recreating index...`
        );
        
        // Delete the existing index
        await pinecone.deleteIndex(targetIndexName);
        console.log(`Deleted index ${targetIndexName}`);
        
        // Wait a bit for deletion to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get cloud and region from env or use defaults
        const cloud = (process.env.PINECONE_CLOUD || 'aws') as 'aws' | 'gcp' | 'azure';
        const region = process.env.PINECONE_REGION || 'us-east-1';

        // Create new index with correct dimension
        await pinecone.createIndex({
          name: targetIndexName,
          dimension: EMBEDDING_DIMENSION,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud,
              region,
            },
          },
          waitUntilReady: true,
        });

        console.log(`Index ${targetIndexName} recreated with dimension ${EMBEDDING_DIMENSION}`);
      } else {
        console.log(`Using existing index: ${targetIndexName} (dimension: ${indexDimension})`);
      }
    }
  } catch (error) {
    // If index already exists, that's fine - continue
    if (
      error instanceof Error &&
      error.message.includes('already exists')
    ) {
      console.log(`Index ${targetIndexName} already exists`);
    } else {
      console.error('Error checking/creating index:', error);
      throw error;
    }
  }

  return pinecone.index(targetIndexName);
};

// Metadata type for RAG documents
// Note: All values must be RecordMetadataValue (string | boolean | number | Array<string>)
export type RAGDocumentMetadata = RecordMetadata & {
  text: string;
  source?: string;
  chunkIndex?: number;
  documentId?: string;
  createdAt?: string;
};

/**
 * Upsert vectors to Pinecone index
 * @param index Pinecone index instance
 * @param vectors Array of vectors with embeddings and metadata
 */
export const upsertVectors = async (
  index: Index<RecordMetadata>,
  vectors: Array<{
    id: string;
    values: number[];
    metadata?: RecordMetadata;
  }>
): Promise<void> => {
  try {
    await index.upsert(vectors);
    console.log(`Upserted ${vectors.length} vectors to Pinecone`);
  } catch (error) {
    console.error('Error upserting vectors:', error);
    throw error;
  }
};

/**
 * Query similar vectors from Pinecone
 * @param index Pinecone index instance
 * @param queryVector The embedding vector to search for
 * @param topK Number of results to return (default: 5)
 * @param filter Optional metadata filter
 * @returns Array of matching records with scores
 */
export const queryVectors = async (
  index: Index<RecordMetadata>,
  queryVector: number[],
  topK: number = 5,
  filter?: Record<string, unknown>
): Promise<Array<{ id: string; score?: number; metadata?: RecordMetadata }>> => {
  try {
    const queryResponse = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      ...(filter && { filter }),
    });

    return (
      queryResponse.matches?.map((match) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
      })) || []
    );
  } catch (error) {
    console.error('Error querying vectors:', error);
    throw error;
  }
};

/**
 * Delete vectors by IDs
 * @param index Pinecone index instance
 * @param ids Array of vector IDs to delete
 */
export const deleteVectors = async (
  index: Index<RecordMetadata>,
  ids: string[]
): Promise<void> => {
  try {
    await index.deleteMany(ids);
    console.log(`Deleted ${ids.length} vectors from Pinecone`);
  } catch (error) {
    console.error('Error deleting vectors:', error);
    throw error;
  }
};

/**
 * Delete all vectors from the index (use with caution!)
 * @param index Pinecone index instance
 */
export const deleteAllVectors = async (
  index: Index<RecordMetadata>
): Promise<void> => {
  try {
    await index.deleteAll();
    console.log('Deleted all vectors from Pinecone index');
  } catch (error) {
    console.error('Error deleting all vectors:', error);
    throw error;
  }
};

/**
 * Get index statistics
 * @param index Pinecone index instance
 * @returns Index statistics including total record count
 */
export const getIndexStats = async (
  index: Index<RecordMetadata>
): Promise<{
  totalRecordCount?: number;
  dimension?: number;
  indexFullness?: number;
  namespaces?: Record<string, { recordCount: number }>;
}> => {
  try {
    const stats = await index.describeIndexStats();
    return {
      totalRecordCount: stats.totalRecordCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness,
      namespaces: stats.namespaces
        ? Object.fromEntries(
            Object.entries(stats.namespaces).map(([key, value]) => [
              key,
              { recordCount: value.recordCount },
            ])
          )
        : undefined,
    };
  } catch (error) {
    console.error('Error getting index stats:', error);
    throw error;
  }
};

// Export the Pinecone client getter for advanced usage
export { getPineconeClient };

