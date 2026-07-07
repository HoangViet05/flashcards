export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

const defaultAssetBaseUrl = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL.slice(0, -4)
  : API_BASE_URL

export const ASSET_BASE_URL = (import.meta.env.VITE_ASSET_BASE_URL || defaultAssetBaseUrl).replace(/\/+$/, '')

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^(https?:|data:|blob:)/.test(url)) return url
  if (url.startsWith('/')) return `${ASSET_BASE_URL}${url}`
  return url
}
