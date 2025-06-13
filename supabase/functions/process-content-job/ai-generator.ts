import type { 
  CourseConfiguration, 
  Syllabus, 
  GeneratedContent, 
  ContentType 
} from './types.ts'
import { validateContentLength, splitContentIntoChunks } from './validation.ts'

export class AIGenerator {
  private openaiApiKey: string

  constructor() {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }
    this.openaiApiKey = apiKey
  }

  async generateContent(
    courseConfig: CourseConfiguration,
    syllabus: Syllabus,
    moduleIndex: number,
    topicIndex: number,
    contentType: ContentType,
    prompt: string,
    existingContent: any[] = []
  ): Promise<GeneratedContent> {
    console.log('Generating content with AI for:', {
      course: courseConfig.topic,
      moduleIndex,
      topicIndex,
      contentType
    })

    const { module, topic } = this.getTopicFromSyllabus(syllabus, moduleIndex, topicIndex)
    const systemPrompt = this.buildSystemPrompt(courseConfig, contentType)
    const userPrompt = this.buildUserPrompt(
      courseConfig,
      module,
      topic,
      contentType,
      prompt,
      existingContent
    )

    // Check content length for context window management
    const totalPromptLength = systemPrompt.length + userPrompt.length
    if (!validateContentLength(systemPrompt + userPrompt, 12000)) {
      console.warn('Prompt too long, truncating context...')
      // Truncate existing content context if needed
      const truncatedUserPrompt = this.truncateUserPrompt(userPrompt, 8000)
      return await this.callOpenAI(systemPrompt, truncatedUserPrompt)
    }

    return await this.callOpenAI(systemPrompt, userPrompt)
  }

  private getTopicFromSyllabus(syllabus: Syllabus, moduleIndex: number, topicIndex: number) {
    if (!syllabus.modules || moduleIndex >= syllabus.modules.length) {
      throw new Error(`Module index ${moduleIndex} out of range`)
    }

    const module = syllabus.modules[moduleIndex]
    if (!module.topics || topicIndex >= module.topics.length) {
      throw new Error(`Topic index ${topicIndex} out of range in module ${moduleIndex}`)
    }

    return { module, topic: module.topics[topicIndex] }
  }

  private buildSystemPrompt(courseConfig: CourseConfiguration, contentType: ContentType): string {
    const depthDescriptions = {
      1: 'beginner-friendly with simple explanations and basic examples',
      2: 'introductory level with clear explanations and practical examples',
      3: 'intermediate level with detailed explanations and real-world applications',
      4: 'advanced level with comprehensive coverage and academic rigor',
      5: 'professional level with cutting-edge insights and industry applications'
    }

    return `You are an expert educational content creator with access to comprehensive academic and professional sources. Create high-quality learning content that is ${depthDescriptions[courseConfig.depth as keyof typeof depthDescriptions]}.

CRITICAL REQUIREMENTS:
1. You must respond with a valid JSON object matching this exact structure:
{
  "title": "Engaging and descriptive title (10-200 characters)",
  "content": "Comprehensive markdown content (500-8000 characters)",
  "description": "Brief overview of the content (20-500 characters, optional)",
  "citations": [
    {
      "id": "unique_citation_id",
      "type": "academic|web|book|article|documentation",
      "title": "Source title",
      "authors": ["Author Name"],
      "url": "https://example.com",
      "publication_date": "2024-01-01",
      "publisher": "Publisher Name",
      "doi": "10.1000/example",
      "access_date": "${new Date().toISOString().split('T')[0]}",
      "relevance_score": 0.95,
      "excerpt": "Brief relevant excerpt from source"
    }
  ],
  "metadata": {
    "word_count": 750,
    "estimated_reading_time": 3,
    "difficulty_level": "intermediate",
    "key_concepts": ["concept1", "concept2"],
    "learning_objectives": ["objective1", "objective2"]
  }
}

CONTENT QUALITY STANDARDS:
- Content must be 500-8000 characters (manageable for context windows)
- Include 3-15 high-quality citations from authoritative sources
- Citations must be real, verifiable sources when possible
- Use proper markdown formatting with headers, lists, code blocks, etc.
- Include practical examples and applications
- Ensure content flows logically and builds understanding progressively

CITATION REQUIREMENTS:
- Prioritize recent sources (last 5 years when possible)
- Include a mix of source types: academic papers, official documentation, reputable websites
- Each citation must have a relevance score (0.0-1.0) indicating how directly it supports the content
- Include brief excerpts that show how the source supports your content
- For academic sources, include DOI when available
- For web sources, use reputable domains (.edu, .org, official company sites)

DEPTH LEVEL ${courseConfig.depth} GUIDELINES:
${this.getDepthGuidelines(courseConfig.depth)}

CONTENT TYPE: ${contentType.toUpperCase()}
${this.getContentTypeGuidelines(contentType)}`
  }

  private getDepthGuidelines(depth: number): string {
    const guidelines = {
      1: `- Use simple, accessible language
- Focus on fundamental concepts and basic understanding
- Include plenty of analogies and everyday examples
- Avoid technical jargon unless clearly explained
- Provide step-by-step explanations`,
      
      2: `- Use clear, straightforward language with some technical terms
- Include practical examples and hands-on applications
- Explain concepts with real-world context
- Provide actionable insights and tips
- Balance theory with practice`,
      
      3: `- Use professional language with appropriate technical terminology
- Include detailed explanations and comprehensive coverage
- Provide case studies and real-world applications
- Reference industry standards and best practices
- Balance depth with accessibility`,
      
      4: `- Use advanced terminology and academic language
- Include comprehensive theoretical background
- Reference current research and academic literature
- Provide complex examples and edge cases
- Assume strong foundational knowledge`,
      
      5: `- Use expert-level language and cutting-edge terminology
- Include latest research and industry developments
- Reference peer-reviewed academic sources extensively
- Provide professional insights and advanced applications
- Assume expert-level background knowledge`
    }

    return guidelines[depth as keyof typeof guidelines] || guidelines[3]
  }

  private getContentTypeGuidelines(contentType: ContentType): string {
    const guidelines = {
      text: `Create comprehensive written content with:
- Clear structure using markdown headers
- Bullet points and numbered lists for key information
- Code examples in appropriate language blocks
- Emphasis on important concepts using **bold** and *italic*
- Include practical exercises or thought questions`,
      
      image: `Create detailed specifications for educational images:
- Describe visual elements that would enhance understanding
- Specify diagram types, charts, or infographic layouts
- Include alt text descriptions for accessibility
- Suggest interactive elements if applicable`,
      
      video: `Create comprehensive video content specifications:
- Detailed script with timing and visual cues
- Specify demonstrations, animations, or screen recordings
- Include interactive elements and pause points
- Provide transcript and accessibility considerations`,
      
      audio: `Create detailed audio content specifications:
- Full script with pacing and emphasis notes
- Specify background music or sound effects
- Include interactive elements and timestamps
- Provide transcript and accessibility features`,
      
      document: `Create structured document content:
- Professional formatting with clear sections
- Include templates, worksheets, or reference materials
- Specify downloadable resources and formats
- Ensure content is printer-friendly`,
      
      interactive: `Create interactive learning experience specifications:
- Detailed interaction design and user flow
- Specify quizzes, simulations, or hands-on exercises
- Include feedback mechanisms and progress tracking
- Ensure accessibility and mobile compatibility`
    }

    return guidelines[contentType] || guidelines.text
  }

  private buildUserPrompt(
    courseConfig: CourseConfiguration,
    module: any,
    topic: any,
    contentType: ContentType,
    customPrompt: string,
    existingContent: any[]
  ): string {
    const existingContentSummary = existingContent.length > 0
      ? `\n\nEXISTING CONTENT FOR THIS TOPIC:\n${existingContent.map(content => 
          `- ${content.title}: ${content.description || 'No description'}`
        ).join('\n')}\n\nEnsure your content complements but doesn't duplicate existing content.`
      : ''

    return `Create ${contentType} content for this learning context:

COURSE: ${courseConfig.topic}
COURSE CONTEXT: ${courseConfig.context}
DEPTH LEVEL: ${courseConfig.depth}/5

MODULE: ${module.summary}
TOPIC: ${topic.summary}
TOPIC KEYWORDS: ${topic.keywords.join(', ')}

EXISTING TOPIC CONTENT: ${topic.content}

SPECIFIC REQUEST: ${customPrompt}${existingContentSummary}

Generate comprehensive ${contentType} content that:
1. Builds upon the existing topic foundation
2. Addresses the specific request
3. Maintains consistency with the course depth level
4. Includes authoritative citations and sources
5. Provides practical value to learners

Remember to include proper citations from authoritative sources and ensure all content meets the quality standards specified in the system prompt.`
  }

  private truncateUserPrompt(userPrompt: string, maxLength: number): string {
    if (userPrompt.length <= maxLength) {
      return userPrompt
    }

    // Try to truncate at sentence boundaries
    const sentences = userPrompt.split(/[.!?]+/)
    let truncated = ''
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length > maxLength - 100) { // Leave room for truncation notice
        break
      }
      truncated += sentence + '. '
    }

    return truncated + '\n\n[Note: Context truncated due to length limitations]'
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<GeneratedContent> {
    console.log('Making OpenAI API request...')
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    console.log('OpenAI response received, parsing...')

    try {
      const parsedContent = JSON.parse(content)
      
      // Ensure citations have access_date if missing
      if (parsedContent.citations) {
        parsedContent.citations = parsedContent.citations.map((citation: any) => ({
          ...citation,
          access_date: citation.access_date || new Date().toISOString().split('T')[0]
        }))
      }

      return parsedContent
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      throw new Error('Invalid JSON response from OpenAI')
    }
  }
}