// HTTP helper for the admin panel. Every admin request goes through here so that:
//  - server error messages reach the toast instead of a generic "failed"
//  - an expired/missing session (401) drops the UI back to the login screen
import { useEffect, useState, useCallback } from 'react'
import { useStore } from '@/frontend/store/use-store'

export class AdminApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    useStore.getState().setUser(null)
    throw new AdminApiError(401, 'Your session has expired. Please sign in again.')
  }
  if (!res.ok) throw new AdminApiError(res.status, data?.error || `Request failed (${res.status})`)
  return data as T
}

export const adminApi = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T = unknown>(url: string, body: unknown) => request<T>('POST', url, body),
  put: <T = unknown>(url: string, body: unknown) => request<T>('PUT', url, body),
  del: <T = unknown>(url: string) => request<T>('DELETE', url),
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong')

/** Load a list from an admin endpoint; `reload()` refetches after a change. */
export function useAdminList<T>(url: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    return adminApi.get<T[]>(url)
      .then((data) => { setItems(data); setError(null) })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [url])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount/filter change; the loading flag flips before the request
  useEffect(() => { reload() }, [reload])
  return { items, setItems, loading, error, reload }
}
