import { appClient } from './clients/appClient'
import { requestData } from './core/response'

export interface CreditsBalance {
  balance: number
  frozenCredits?: number
  totalEarned?: number
  totalUsed?: number
}

export interface CreditQuote {
  credits: number
  unit: string
  unitCount: number
  unitPrice: number
  modelId: string
  quality?: string
  resolution?: string
  balance: number
  frozenCredits?: number
  sufficient: boolean
  quotaOk: boolean
  message?: string | null
}

export interface QuoteRequest {
  model: string
  modality: 'image' | 'video' | 'text'
  n?: number
  quality?: string
  size?: string
  resolution?: string
  duration?: number
  unit?: string
  imageCount?: number
  template?: string
  projectId?: number
}

export interface CreditHistoryItem {
  id: number
  entryType: string
  amount: number
  balanceAfter?: number
  description?: string
  createdAt?: string
}

export interface PriceRule {
  id: number
  modelId: string
  modality: string
  unit: string
  quality: string
  resolution: string
  creditsPerUnit: number
  isActive: boolean
}

export const creditsApi = {
  balance() {
    return requestData<CreditsBalance>(appClient, { url: '/credits', method: 'GET' })
  },
  quote(body: QuoteRequest) {
    return requestData<CreditQuote>(appClient, { url: '/credits/quote', method: 'POST', data: body })
  },
  history(page = 1, size = 20) {
    return requestData<{ list: CreditHistoryItem[]; pagination: { page: number; size: number; total: number } }>(
      appClient,
      { url: '/credits/history', method: 'GET', params: { page, size } }
    )
  },
  lookupUser(email: string) {
    return requestData<{ id: number; username: string; email: string }>(appClient, {
      url: '/credits/users',
      method: 'GET',
      params: { email },
    })
  },
  grant(body: { userId: number; amount: number; description?: string }) {
    return requestData<{ userId: number; amount: number; balance: number }>(appClient, {
      url: '/credits/grant',
      method: 'POST',
      data: body,
    })
  },
  prices() {
    return requestData<{ list: PriceRule[] }>(appClient, { url: '/credits/prices', method: 'GET' })
  },
  updatePrice(id: number, body: { creditsPerUnit?: number; isActive?: boolean }) {
    return requestData<{ id: number; modelId: string; creditsPerUnit: number; isActive: boolean }>(appClient, {
      url: `/credits/prices/${id}`,
      method: 'PUT',
      data: body,
    })
  },
}
