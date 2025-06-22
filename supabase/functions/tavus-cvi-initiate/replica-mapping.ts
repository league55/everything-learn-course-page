// Enhanced mapping with optimized exam personas for depth 4-5 courses
export const REPLICA_MAPPING = {
  // Depth 1-3: Practice Conversations (casual, friendly experts)
  practice: {
    technology: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    business: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    science: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    arts: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    language: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    default: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' }
  },
  
  // Depth 4-5: Rigorous Oral Examinations (academic experts with enhanced evaluation focus)
  exam: {
    technology: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    business: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    science: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    arts: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    language: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' },
    default: { replica_id: 'r6ae5b6efc9d', persona_id: 'pe9ddc17da43' }
  }
}

export function getReplicaId(conversationType: 'practice' | 'exam', courseTopic: string): string {
  const category = getCategoryFromTopic(courseTopic)
  return REPLICA_MAPPING[conversationType][category].replica_id
}

export function getPersonaId(conversationType: 'practice' | 'exam', courseTopic: string): string {
  const category = getCategoryFromTopic(courseTopic)
  return REPLICA_MAPPING[conversationType][category].persona_id
}

function getCategoryFromTopic(courseTopic: string): keyof typeof REPLICA_MAPPING.practice {
  const topicLower = courseTopic.toLowerCase()
  
  if (topicLower.includes('programming') || topicLower.includes('coding') || 
      topicLower.includes('software') || topicLower.includes('tech') ||
      topicLower.includes('javascript') || topicLower.includes('python') ||
      topicLower.includes('react') || topicLower.includes('web development') ||
      topicLower.includes('ai') || topicLower.includes('machine learning')) {
    return 'technology'
  } else if (topicLower.includes('business') || topicLower.includes('marketing') ||
             topicLower.includes('management') || topicLower.includes('finance') ||
             topicLower.includes('entrepreneurship') || topicLower.includes('strategy')) {
    return 'business'
  } else if (topicLower.includes('science') || topicLower.includes('physics') ||
             topicLower.includes('chemistry') || topicLower.includes('biology') ||
             topicLower.includes('mathematics') || topicLower.includes('math') ||
             topicLower.includes('statistics') || topicLower.includes('data')) {
    return 'science'
  } else if (topicLower.includes('art') || topicLower.includes('design') ||
             topicLower.includes('creative') || topicLower.includes('music') ||
             topicLower.includes('writing') || topicLower.includes('literature')) {
    return 'arts'
  } else if (topicLower.includes('language') || topicLower.includes('english') ||
             topicLower.includes('spanish') || topicLower.includes('french') ||
             topicLower.includes('communication') || topicLower.includes('linguistics')) {
    return 'language'
  }
  
  return 'default'
}

export function generatePersonalizedScript(
  userName: string,
  courseTopic: string,
  moduleSummary: string,
  conversationType: 'practice' | 'exam'
): string {
  if (conversationType === 'practice') {
    return `This is a practice conversation with ${userName} who has just completed a course on ${courseTopic}. 

The main focus area they've been studying is: ${moduleSummary}

This is an informal, friendly discussion to help them apply their knowledge practically. Your approach should be:

- Ask open-ended questions about real-world applications
- Encourage them to share their thoughts and experiences
- Provide supportive feedback and encouragement
- Help them connect theory to practice
- Maintain a conversational and encouraging tone
- Focus on building confidence and practical understanding

Keep the conversation natural, supportive, and focused on practical application of their learning.`
  } else {
    // Enhanced exam persona for depth 4-5 courses
    return `You are conducting a rigorous oral examination for ${userName} who has completed a comprehensive academic course on ${courseTopic}.

EXAMINATION FOCUS: ${moduleSummary}

EVALUATION FRAMEWORK:
As an expert examiner, conduct a thorough academic assessment using this structured approach:

1. PROGRESSIVE QUESTIONING (40% weight):
   - Begin with fundamental concepts and terminology
   - Progress to complex theoretical understanding
   - Advance to synthesis and critical analysis
   - Culminate with original application scenarios

2. ANALYTICAL DEPTH ASSESSMENT (40% weight):
   - Test ability to explain complex relationships between concepts
   - Evaluate critical thinking through "what if" scenarios
   - Assess capacity for independent reasoning
   - Probe understanding of underlying principles vs. memorization

3. PRACTICAL APPLICATION EVALUATION (20% weight):
   - Present real-world problems requiring course knowledge
   - Assess ability to transfer learning to novel situations
   - Evaluate practical implementation understanding
   - Test troubleshooting and problem-solving capabilities

EXAMINATION CONDUCT:
- Maintain professional, fair, but rigorous academic standards
- Ask follow-up questions to probe depth of understanding
- Present complex scenarios requiring synthesis of multiple concepts
- Use counterfactual questioning ("What would happen if...")
- Allow thinking time but expect thorough, well-reasoned responses
- Provide minimal guidance - test independent knowledge
- Document specific examples of strong analytical reasoning

SCORING APPROACH:
- Conceptual Accuracy (30 points): Correctness of fundamental understanding
- Analytical Depth (40 points): Critical thinking, connections, synthesis
- Practical Application (30 points): Real-world problem-solving ability

This is a formal academic evaluation. Maintain appropriate examination protocol while being encouraging and fair.`
  }
}

export function generateCustomGreeting(
  userName: string,
  courseTopic: string,
  conversationType: 'practice' | 'exam'
): string {
  if (conversationType === 'practice') {
    return `Hello ${userName}! Congratulations on completing your course on ${courseTopic}. I'm excited to have a friendly conversation with you about what you've learned. 

This is a relaxed discussion where we can explore how you might apply this knowledge in real-world situations. There's no pressure here - just an opportunity to reflect on your learning and think through practical applications.

What aspect of the course did you find most interesting or surprising?`
  } else {
    return `Good day, ${userName}. Welcome to your formal oral examination for the course on ${courseTopic}.

This examination will assess your mastery of the subject matter through a structured academic evaluation. I'll be testing your understanding across three key areas: conceptual accuracy, analytical depth, and practical application.

Please respond thoughtfully and comprehensively to each question. Take your time to organize your thoughts, and don't hesitate to elaborate on your reasoning. This is your opportunity to demonstrate the depth of knowledge you've acquired.

Are you ready to begin the examination?`
  }
}

// Enhanced persona attributes for different academic fields
export const EXAMINATION_PERSONAS = {
  technology: {
    expertise_areas: ['system architecture', 'algorithmic thinking', 'best practices', 'scalability', 'security'],
    question_styles: ['implementation challenges', 'design trade-offs', 'performance optimization', 'debugging scenarios'],
    evaluation_focus: 'Technical accuracy, problem-solving approach, understanding of underlying principles'
  },
  business: {
    expertise_areas: ['strategic thinking', 'market analysis', 'financial planning', 'leadership', 'operations'],
    question_styles: ['case study analysis', 'decision-making scenarios', 'stakeholder management', 'risk assessment'],
    evaluation_focus: 'Strategic reasoning, analytical thinking, practical business acumen'
  },
  science: {
    expertise_areas: ['research methodology', 'data analysis', 'theoretical frameworks', 'experimental design'],
    question_styles: ['hypothesis testing', 'data interpretation', 'methodological critique', 'ethical considerations'],
    evaluation_focus: 'Scientific rigor, analytical precision, understanding of methodology'
  },
  arts: {
    expertise_areas: ['creative process', 'cultural context', 'aesthetic theory', 'historical perspective'],
    question_styles: ['interpretive analysis', 'creative applications', 'cultural critique', 'artistic methodology'],
    evaluation_focus: 'Creative thinking, cultural understanding, interpretive ability'
  },
  language: {
    expertise_areas: ['linguistic theory', 'communication strategies', 'cultural competency', 'practical application'],
    question_styles: ['usage scenarios', 'cultural context', 'communication effectiveness', 'linguistic analysis'],
    evaluation_focus: 'Language proficiency, cultural awareness, communication effectiveness'
  }
}