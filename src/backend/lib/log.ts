// Structured server logging with secret redaction. Use for anything that may carry tokens or credentials.
const SECRET_KEY = /token|secret|password|authorization|cookie|code_verifier|^code$|passcode|^key$/i
const SECRET_VALUE = /(Bearer\s+)[\w.~+/=-]+|figd_[\w-]+|figu_[\w-]+/g

export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.replace(SECRET_VALUE, (_m, bearer) => `${bearer ?? ''}[REDACTED]`)
  if (value instanceof Error) return { name: value.name, message: redact(value.message) }
  if (!value || typeof value !== 'object' || depth > 5) return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1)]))
}

export function log(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...(redact(fields) as object) })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
