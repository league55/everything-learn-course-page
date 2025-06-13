import { z } from 'npm:zod@^3.23.8'

// Zod schemas for validation
export const SyllabusTopicSchema = z.object({
  summary: z.string().min(10).max(200),
  keywords: z.array(z.string()).min(3).max(10),
  content: z.string().min(100).max(2000),
})

export const SyllabusModuleSchema = z.object({
  summary: z.string().min(20).max(300),
  topics: z.array(SyllabusTopicSchema),
})

export const GeneratedSyllabusSchema = z.object({
  modules: z.array(SyllabusModuleSchema),
  keywords: z.array(z.string()).min(5).max(20),
})

export function validateSyllabus(data: any) {
  return GeneratedSyllabusSchema.parse(data)
}