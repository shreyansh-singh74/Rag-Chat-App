import { Pinecone, Index } from '@pinecone-database/pinecone';
import { EMBEDDING_DIMENSION } from './embeddings';
import type { RecordMetadata } from '@pinecone-database/pinecone';

// Initialize Pinecone client
const getPineconeClient = (): Pinecone => {
  const apiKey = process.env.PINECONE_API_KEY;

  if (!apiKey) {
    throw new Error('PINECONE_API_KEY environment variable is not set');
  }

  if (apiKey.trim().length === 0) {
    throw new Error('PINECONE_API_KEY is set but appears to be empty');
  }

  try {
    return new Pinecone({ apiKey });
  } catch (error) {
    console.error('Error initializing Pinecone client:', error);
    throw new Error(`Failed to initialize Pinecone client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
    // Test connection by listing indexes
    let indexes;
    try {
      indexes = await pinecone.listIndexes();
    } catch (listError) {
      console.error('Error listing Pinecone indexes:', listError);
      if (listError instanceof Error) {
        if (listError.message.includes('network') || listError.message.includes('connection')) {
          throw new Error(
            'Failed to connect to Pinecone. Please check:\n' +
            '1. Your PINECONE_API_KEY is correct\n' +
            '2. Your network connection\n' +
            '3. Pinecone service status at https://status.pinecone.io/\n' +
            `Original error: ${listError.message}`
          );
        }
        throw new Error(`Pinecone API error: ${listError.message}`);
      }
      throw new Error('Failed to connect to Pinecone API');
    }
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
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('network') || error.message.includes('connection') || error.message.includes('reach')) {
        throw new Error(
          'Failed to connect to Pinecone. Please verify:\n' +
          '1. PINECONE_API_KEY is set correctly in your .env.local file\n' +
          '2. PINECONE_INDEX_NAME is set correctly\n' +
          '3. Your network connection is working\n' +
          '4. Check Pinecone status: https://status.pinecone.io/\n' +
          `\nOriginal error: ${error.message}`
        );
      }
      throw new Error(`Pinecone query error: ${error.message}`);
    }
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

/**
 * Get unique documents from Pinecone index
 * @param index Pinecone index instance
 * @returns Array of unique documents with metadata
 */
export const getUniqueDocuments = async (
  index: Index<RecordMetadata>
): Promise<Array<{
  documentId: string;
  source: string;
  createdAt: string;
  chunkCount: number;
}>> => {
  try {
    // Use listPaginated to get all vector IDs
    const allIds: string[] = [];
    let paginationToken: string | undefined;

    do {
      const result = await index.listPaginated({
        ...(paginationToken && { paginationToken }),
      });

      if (result.vectors) {
        allIds.push(...result.vectors.map((v) => v.id).filter((id): id is string => !!id));
      }

      paginationToken = result.pagination?.next;
    } while (paginationToken);

    if (allIds.length === 0) {
      return [];
    }

    // Fetch vectors in batches to get metadata
    const batchSize = 100;
    const allVectors: Array<{ id: string; metadata?: RecordMetadata }> = [];

    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);
      const fetchResult = await index.fetch(batch);
      
      if (fetchResult.records) {
        Object.entries(fetchResult.records).forEach(([id, record]) => {
          allVectors.push({ id, metadata: record.metadata });
        });
      }
    }

    // Group by documentId and aggregate metadata
    const documentMap = new Map<
      string,
      { source: string; createdAt: string; chunkCount: number }
    >();

    allVectors.forEach((vector) => {
      const metadata = vector.metadata;
      if (metadata) {
        const documentId = metadata.documentId as string | undefined;
        const source = metadata.source as string | undefined;
        const createdAt = metadata.createdAt as string | undefined;

        if (documentId && source) {
          if (!documentMap.has(documentId)) {
            documentMap.set(documentId, {
              source,
              createdAt: createdAt || new Date().toISOString(),
              chunkCount: 0,
            });
          }
          const doc = documentMap.get(documentId)!;
          doc.chunkCount += 1;
          // Use earliest createdAt
          if (createdAt && createdAt < doc.createdAt) {
            doc.createdAt = createdAt;
          }
        }
      }
    });

    // Convert map to array
    return Array.from(documentMap.entries()).map(([documentId, data]) => ({
      documentId,
      ...data,
    }));
  } catch (error) {
    console.error('Error getting unique documents:', error);
    throw error;
  }
};

/**
 * Delete all vectors for a specific document
 * @param index Pinecone index instance
 * @param documentId The document ID to delete
 * @returns Number of vectors deleted
 */
export const deleteDocumentVectors = async (
  index: Index<RecordMetadata>,
  documentId: string
): Promise<number> => {
  try {
    // List all vectors with the documentId prefix
    const vectorIds: string[] = [];
    let paginationToken: string | undefined;

    do {
      const result = await index.listPaginated({
        prefix: `${documentId}-chunk-`,
        ...(paginationToken && { paginationToken }),
      });

      if (result.vectors) {
        vectorIds.push(...result.vectors.map((v) => v.id).filter((id): id is string => !!id));
      }

      paginationToken = result.pagination?.next;
    } while (paginationToken);

    if (vectorIds.length === 0) {
      return 0;
    }

    // Delete all vectors for this document
    await index.deleteMany(vectorIds);
    console.log(`Deleted ${vectorIds.length} vectors for document ${documentId}`);

    return vectorIds.length;
  } catch (error) {
    console.error('Error deleting document vectors:', error);
    throw error;
  }
};

// Export the Pinecone client getter for advanced usage
export { getPineconeClient };

