import client from './client'

export interface AIGenerateResponse {
  front_text: string
  back_text: string
  example_sentence?: string
}

export const generateAIContent = async (word: string): Promise<AIGenerateResponse> => {
  const { data } = await client.post<AIGenerateResponse>('/ai/generate', { word })
  return data
}
