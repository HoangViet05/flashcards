import axios from 'axios'
import { API_BASE_URL } from './config'

const client = axios.create({
  baseURL: API_BASE_URL,
})

client.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('flashcards.auth.token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('flashcards.auth.expired'))
    }
    return Promise.reject(error)
  },
)

export default client
