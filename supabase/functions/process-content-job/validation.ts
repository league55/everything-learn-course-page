import { z } from 'npm:zod@^3.23.8'

// Citation schema
export const CitationSchema = z.object({
  id: z.string(),
  type: z.enum(['academic', 'web', 'book', 'article', 'documentation']),
  title: z.string().min(5).max(200),
  authors: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  publication_date: z.string().optional(),
  publisher: z.string().optional(),
  doi: z.string().optional(),
  isbn: z.string().optional(),
  access_date: z.string(),
  relevance_score: z.number().min(0).max(1),
  excerpt: z.string().max(500).optional(),
})

// Generated content metadata schema
export const ContentMetadataSchema = z.object({
  word_count: z.number().min(0),
  estimated_reading_time: z.number().min(0),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  key_concepts: z.array(z.string()).min(1).max(20),
  learning_objectives: z.array(z.string()).min(1).max(10),
})

// Generated content schema
export const GeneratedContentSchema = z.object({
  title: z.string().min(10).max(200),
  content: z.string().min(500).max(8000), // Manageable chunk size
  description: z.string().min(20).max(500).optional(),
  citations: z.array(CitationSchema).min(3).max(15),
  metadata: ContentMetadataSchema,
})

export function validateGeneratedContent(data: any) {
  return GeneratedContentSchema.parse(data)
}

// Validate content length for context window management
export function validateContentLength(content: string, maxTokens: number = 6000): boolean {
  // Rough estimation: 1 token ≈ 4 characters for English text
  const estimatedTokens = content.length / 4
  return estimatedTokens <= maxTokens
}

// Split content into manageable chunks if needed
export function splitContentIntoChunks(content: string, maxChunkSize: number = 6000): string[] {
  if (content.length <= maxChunkSize) {
    return [content]
  }

  const chunks: string[] = []
  const sentences = content.split(/[.!?]+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    const sentenceWithPunctuation = trimmedSentence + '.'
    
    if ((currentChunk + sentenceWithPunctuation).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = sentenceWithPunctuation
      } else {
        // Single sentence is too long, split by words
        const words = sentenceWithPunctuation.split(' ')
        let wordChunk = ''
        
        for (const word of words) {
          if ((wordChunk + ' ' + word).length > maxChunkSize) {
            if (wordChunk) {
              chunks.push(wordChunk.trim())
              wordChunk = word
            } else {
              // Single word is too long, truncate
              chunks.push(word.substring(0, maxChunkSize))
            }
          } else {
            wordChunk += (wordChunk ? ' ' : '') + word
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk
        }
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}