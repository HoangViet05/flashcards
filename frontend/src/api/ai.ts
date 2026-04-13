import client from './client'

export interface AIGenerateResponse {
  front_text: string
  back_text: string
  example_sentence?: string
}

export interface AIBatchGenerateResponse {
  cards: AIGenerateResponse[]
}

export const generateAIContent = async (word: string): Promise<AIGenerateResponse> => {
  const { data } = await client.post<AIGenerateResponse>('/ai/generate', { word })
  return data
}

export const generateAIBatchContent = async (topic: string, count: number = 5): Promise<AIBatchGenerateResponse> => {
  const { data } = await client.post<AIBatchGenerateResponse>('/ai/generate-batch', { topic, count })
  return data
}
