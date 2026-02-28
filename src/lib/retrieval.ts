// Document Retrieval Service
// Handles parsing, chunking, and embedding documents for retrieval

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { db } from './db';

export interface DocumentChunk {
  id: string;
  uploadId: string;
  chunkIndex: number;
  chunkText: string;
  embedding?: number[];
}

export interface ParseResult {
  text: string;
  pageCount?: number;
  wordCount: number;
}

// Parse PDF document
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
    wordCount: data.text.split(/\s+/).filter(w => w.length > 0).length
  };
}

// Parse DOCX document
export async function parseDOCX(buffer: Buffer): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  return {
    text,
    wordCount: text.split(/\s+/).filter(w => w.length > 0).length
  };
}

// Parse plain text
export function parseText(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf-8');
  return {
    text,
    wordCount: text.split(/\s+/).filter(w => w.length > 0).length
  };
}

// Parse document based on mime type
export async function parseDocument(buffer: Buffer, mimeType: string): Promise<ParseResult> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDF(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseDOCX(buffer);
    case 'text/plain':
    case 'text/markdown':
      return parseText(buffer);
    default:
      throw new Error(`Unsupported document type: ${mimeType}`);
  }
}

// Chunk text into smaller pieces for embedding
export function chunkText(
  text: string,
  options: {
    maxChunkSize?: number;
    overlap?: number;
    minChunkSize?: number;
  } = {}
): string[] {
  const {
    maxChunkSize = 500,
    overlap = 50,
    minChunkSize = 100
  } = options;

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed max size
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      chunks.push(currentChunk.trim());
      // Keep overlap from the end of current chunk
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Create embedding using OpenAI
export async function createEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input: text.slice(0, 8000), // Limit input size
      model: 'text-embedding-3-small'
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Store document chunks with embeddings
export async function storeDocumentChunks(
  uploadId: string,
  chunks: string[],
  getEmbedding: (text: string) => Promise<number[]>
): Promise<void> {
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    let embedding: number[] | undefined;
    
    try {
      embedding = await getEmbedding(chunkText);
    } catch (error) {
      console.error(`Failed to create embedding for chunk ${i}:`, error);
    }

    await db.retrievalChunk.create({
      data: {
        uploadId,
        chunkIndex: i,
        chunkText,
        embedding: embedding ? JSON.stringify(embedding) : null
      }
    });
  }
}

// Retrieve relevant chunks for a query
export async function retrieveRelevantChunks(
  query: string,
  options: {
    topK?: number;
    threshold?: number;
    uploadIds?: string[];
    getEmbedding: (text: string) => Promise<number[]>;
  }
): Promise<Array<{ chunkText: string; score: number }>> {
  const { topK = 5, threshold = 0.7, uploadIds, getEmbedding } = options;

  // Get query embedding
  const queryEmbedding = await getEmbedding(query);

  // Get all chunks (filter by upload IDs if provided)
  const whereClause = uploadIds && uploadIds.length > 0 
    ? { uploadId: { in: uploadIds } }
    : {};

  const chunks = await db.retrievalChunk.findMany({
    where: whereClause,
    include: { upload: true }
  });

  // Calculate similarities
  const scoredChunks = chunks
    .filter(chunk => chunk.embedding)
    .map(chunk => {
      const embedding = JSON.parse(chunk.embedding!);
      const score = cosineSimilarity(queryEmbedding, embedding);
      return { chunkText: chunk.chunkText, score };
    })
    .filter(chunk => chunk.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scoredChunks;
}

// Build context from retrieved chunks
export function buildRetrievalContext(
  chunks: Array<{ chunkText: string; score: number }>
): string {
  if (chunks.length === 0) return '';

  return chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.chunkText}`)
    .join('\n\n---\n\n');
}

// Process and store uploaded document
export async function processUpload(
  uploadId: string,
  buffer: Buffer,
  mimeType: string,
  getEmbedding: (text: string) => Promise<number[]>
): Promise<void> {
  // Parse document
  const parseResult = await parseDocument(buffer, mimeType);

  // Update upload with extracted text
  await db.upload.update({
    where: { id: uploadId },
    data: { extractedText: parseResult.text }
  });

  // Delete existing chunks
  await db.retrievalChunk.deleteMany({
    where: { uploadId }
  });

  // Chunk and store
  const chunks = chunkText(parseResult.text);
  await storeDocumentChunks(uploadId, chunks, getEmbedding);
}
