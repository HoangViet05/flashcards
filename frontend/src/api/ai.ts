import client from './client'

export interface AIGenerateResponse {
  front_text: string
  back_text: string
  example_sentence?: string
  is_duplicate?: boolean
}

export interface AIBatchGenerateResponse {
  cards: AIGenerateResponse[]
}

export const generateAIContent = async (word: string, excluded_words: string[] = []): Promise<AIGenerateResponse> => {
  const { data } = await client.post<AIGenerateResponse>('/ai/generate', { word, excluded_words })
  return data
}

export const generateAIBatchStream = async (
  topic: string,
  count: number = 5,
  excluded_words: string[] = [],
  onCardGenerated: (card: AIGenerateResponse) => void
): Promise<void> => {
  const response = await fetch('/api/ai/generate-batch-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic, count, excluded_words })
  })

  if (!response.ok) {
    throw new Error('Failed to start AI generation stream')
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || '' 

      for (const part of parts) {
        if (part.startsWith('data: ')) {
          const dataStr = part.replace('data: ', '').trim()
          if (dataStr === '[DONE]') return
          
          try {
            const card = JSON.parse(dataStr)
            onCardGenerated(card)
          } catch (e) {
            console.error('Lỗi khi parse SSE data:', e, dataStr)
          }
        }
      }
    }
  }
}
