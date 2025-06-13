// Mapping of course depth levels to Tavus replica IDs and persona IDs
// Note: These are placeholder IDs - replace with actual replica and persona IDs from your Tavus account
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
  
  // Depth 4-5: Oral Examinations (formal, academic experts)
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
      topicLower.includes('react') || topicLower.includes('web development')) {
    return 'technology'
  } else if (topicLower.includes('business') || topicLower.includes('marketing') ||
             topicLower.includes('management') || topicLower.includes('finance') ||
             topicLower.includes('entrepreneurship')) {
    return 'business'
  } else if (topicLower.includes('science') || topicLower.includes('physics') ||
             topicLower.includes('chemistry') || topicLower.includes('biology') ||
             topicLower.includes('mathematics') || topicLower.includes('math')) {
    return 'science'
  } else if (topicLower.includes('art') || topicLower.includes('design') ||
             topicLower.includes('creative') || topicLower.includes('music') ||
             topicLower.includes('writing')) {
    return 'arts'
  } else if (topicLower.includes('language') || topicLower.includes('english') ||
             topicLower.includes('spanish') || topicLower.includes('french') ||
             topicLower.includes('communication')) {
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
    return `This is a practice conversation with ${userName} who has just completed a course on ${courseTopic}. The main focus area they've been studying is: ${moduleSummary}. This is an informal, friendly discussion to help them apply their knowledge practically. Ask open-ended questions about real-world applications, encourage them to share their thoughts, and provide supportive feedback. Keep the tone conversational and encouraging.`
  } else {
    return `This is a formal oral examination for ${userName} who has completed a comprehensive course on ${courseTopic}. The examination focuses on: ${moduleSummary}. Conduct a thorough academic assessment by asking detailed questions about core concepts, theoretical understanding, and practical applications. Maintain a professional tone while being fair and encouraging. Test their depth of knowledge and ability to explain complex concepts clearly.`
  }
}

export function generateCustomGreeting(
  userName: string,
  courseTopic: string,
  conversationType: 'practice' | 'exam'
): string {
  if (conversationType === 'practice') {
    return `Hello ${userName}! Congratulations on completing your course on ${courseTopic}. I'm excited to have a friendly conversation with you about what you've learned. Let's explore how you might apply this knowledge in real-world situations. What aspect of the course did you find most interesting?`
  } else {
    return `Good day ${userName}. Welcome to your oral examination for the course on ${courseTopic}. I'll be conducting your assessment today to evaluate your understanding and mastery of the material. This is your opportunity to demonstrate your knowledge and analytical thinking. Are you ready to begin?`
  }
}