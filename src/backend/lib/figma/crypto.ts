// Envelope encryption for Figma tokens (AES-256-GCM).
//
// Each value gets a fresh 256-bit data key; the data key is encrypted ("wrapped") with the key-encryption key
// of the current version from FIGMA_TOKEN_KEYS. The record stores the key version so old values stay readable
// after rotation: add a new version, keep the old one until every connection has been re-encrypted
// (tokens are re-encrypted on every refresh/reconnect). `context` is bound as GCM additional data, so a
// ciphertext copied to another store or field fails to decrypt.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { HttpError } from '@/backend/lib/auth'

type Keyring = { current: number; keys: Map<number, Buffer> }

/** FIGMA_TOKEN_KEYS="1:<base64 32 bytes>,2:<base64 32 bytes>"; the highest version encrypts. */
// Misconfiguration is reported to the admin (503) rather than as a generic failure; the message never echoes the value.
const HOW_TO = 'Set it to 1:<base64 of 32 random bytes> (see .env.example) and restart the server.'

export function parseKeyring(raw = process.env.FIGMA_TOKEN_KEYS ?? ''): Keyring {
  if (/fig[a-z]_/.test(raw)) throw new HttpError(503, `FIGMA_TOKEN_KEYS contains a Figma token. It must hold the server's encryption key instead; paste the Figma token in this form. ${HOW_TO}`)
  const keys = new Map<number, Buffer>()
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const [v, b64] = part.split(':')
    const version = Number(v)
    const key = Buffer.from(b64 ?? '', 'base64')
    if (!Number.isInteger(version) || version < 1 || key.length !== 32) throw new HttpError(503, `FIGMA_TOKEN_KEYS is invalid. ${HOW_TO}`)
    keys.set(version, key)
  }
  if (!keys.size) throw new HttpError(503, `FIGMA_TOKEN_KEYS is not configured. ${HOW_TO}`)
  return { current: Math.max(...keys.keys()), keys }
}

function seal(key: Buffer, plain: Buffer, aad: Buffer) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

function open(key: Buffer, sealed: Buffer, aad: Buffer) {
  if (sealed.length < 28) throw new Error('Malformed ciphertext')
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.subarray(0, 12))
  decipher.setAAD(aad)
  decipher.setAuthTag(sealed.subarray(12, 28))
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()])
}

export function encryptSecret(plain: string, context: string, ring = parseKeyring()) {
  const dataKey = randomBytes(32)
  const aad = Buffer.from(context)
  const wrapped = seal(ring.keys.get(ring.current)!, dataKey, aad)
  const value = seal(dataKey, Buffer.from(plain, 'utf8'), aad)
  return { ciphertext: `${wrapped.toString('base64url')}.${value.toString('base64url')}`, keyVersion: ring.current }
}

export function decryptSecret(ciphertext: string, keyVersion: number, context: string, ring = parseKeyring()) {
  const kek = ring.keys.get(keyVersion)
  if (!kek) throw new Error(`Figma token key version ${keyVersion} is not configured`)
  const [wrapped, value, extra] = ciphertext.split('.')
  if (!wrapped || !value || extra !== undefined) throw new Error('Malformed ciphertext')
  const aad = Buffer.from(context)
  const dataKey = open(kek, Buffer.from(wrapped, 'base64url'), aad)
  return open(dataKey, Buffer.from(value, 'base64url'), aad).toString('utf8')
}
