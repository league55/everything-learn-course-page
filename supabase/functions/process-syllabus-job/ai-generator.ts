import type { CourseConfiguration, GeneratedSyllabus } from './types.ts'

export class AIGenerator {
  private openaiApiKey: string

  constructor() {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }
    this.openaiApiKey = apiKey
  }

  async generateSyllabus(courseConfig: CourseConfiguration): Promise<GeneratedSyllabus> {
    console.log('Generating syllabus with AI for course:', courseConfig.topic)

    const courseStructure = this.getCourseStructure(courseConfig.depth)
    const systemPrompt = this.buildSystemPrompt(courseStructure, courseConfig.depth)
    const userPrompt = this.buildUserPrompt(courseConfig, courseStructure)

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
      return JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      throw new Error('Invalid JSON response from OpenAI')
    }
  }

  private getCourseStructure(depth: number) {
    const structures = {
      1: { modules: 3, topicsPerModule: 3 },
      2: { modules: 3, topicsPerModule: 4 },
      3: { modules: 4, topicsPerModule: 5 },
      4: { modules: 4, topicsPerModule: 5 }, // Reduced from 6 to 5
      5: { modules: 4, topicsPerModule: 5 }  // Reduced from 8 to 5, and modules from 5 to 4
    }

    return structures[depth as keyof typeof structures] || structures[3]
  }

  private getDepthDescription(depth: number): string {
    const descriptions = {
      1: 'Basic overview, should be able to cover in an hour',
      2: 'Basic overview, should be able to cover in 2 hours',
      3: 'Average depth. Hobby level',
      4: 'High school / university level',
      5: 'To be used professionally'
    }

    return descriptions[depth as keyof typeof descriptions] || descriptions[3]
  }

  private buildSystemPrompt(courseStructure: any, depth: number): string {
    return `You are an expert course designer with access to advanced academic and professional sources. Create a comprehensive syllabus based on the user's requirements.

IMPORTANT: You must respond with a valid JSON object that matches this exact structure:
{
  "modules": [
    {
      "summary": "Module title and comprehensive description (MINIMUM 20 characters, MAXIMUM 300 characters)",
      "topics": [
        {
          "summary": "Topic title and brief description (minimum 10 characters, maximum 200 characters)", 
          "keywords": ["keyword1", "keyword2", "keyword3"],
          "content": "Detailed markdown content explaining the topic, including learning objectives, key concepts, and practical applications (minimum 100 characters, maximum 2000 characters)"
        }
      ]
    }
  ],
  "keywords": ["course-level", "keywords", "for", "searchability"]
}

CRITICAL LENGTH REQUIREMENTS:
- Module summary: MUST be at least 20 characters and at most 300 characters
- Topic summary: MUST be at least 10 characters and at most 200 characters  
- Topic content: MUST be at least 100 characters and at most 2000 characters
- Keywords array: MUST have 5-20 course-level keywords
- Topic keywords: MUST have 3-10 keywords per topic

Course Structure Requirements:
- ${courseStructure.modules} modules total
- ${courseStructure.topicsPerModule} topics per module
- Content depth level: ${depth}/5 (${this.getDepthDescription(depth)})

Content Guidelines Based on Depth Level:
- Depth 1: Use accessible language, focus on fundamental concepts, provide simple examples
- Depth 2: Include more detailed explanations, introduce intermediate concepts, provide practical applications
- Depth 3: Present comprehensive coverage, include analytical thinking, provide real-world case studies
- Depth 4: Use advanced terminology, reference current research, include complex problem-solving
- Depth 5: Reference academic literature, include cutting-edge developments, focus on professional application

Quality Standards:
- Draw from the most authoritative and current sources available
- Adjust complexity and terminology to match the specified depth level
- Each topic's content should be 100-500 words of detailed markdown
- Include practical examples and real-world applications appropriate to the level
- Progressive difficulty within and across modules
- Clear learning objectives for each topic
- Relevant keywords for discoverability
- Cite or reference high-quality sources when appropriate for the depth level`
  }

  private buildUserPrompt(courseConfig: CourseConfiguration, courseStructure: any): string {
    return `Create a syllabus for:
Topic: ${courseConfig.topic}
Context: ${courseConfig.context}
Depth Level: ${courseConfig.depth}/5

Generate a structured syllabus with ${courseStructure.modules} modules and ${courseStructure.topicsPerModule} topics per module. 

REMEMBER: Ensure all content meets the minimum length requirements:
- Module summaries must be at least 20 characters
- Topic summaries must be at least 10 characters
- Topic content must be at least 100 characters

Adjust the content complexity, terminology, and source sophistication to match depth level ${courseConfig.depth}. Use advanced sources but present the information at the appropriate level for the learner.`
  }
}