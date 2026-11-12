import crypto from 'node:crypto'

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

export function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, 'hex')
    const actual = crypto.scryptSync(password, salt, expected.length)
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function newToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
