import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const PREFIX = 'scrypt'
const KEY_LEN = 64
const SALT_LEN = 16

/** 生成 `scrypt$<saltHex>$<hashHex>`，固定前缀便于与历史明文数据区分 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(plain, salt, KEY_LEN)
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export interface VerifyResult {
  ok: boolean
  /** 命中历史明文密码，校验后应立即改写为哈希 */
  legacy: boolean
}

export function verifyPassword(plain: string, stored: string | null): VerifyResult {
  if (!stored) return { ok: false, legacy: false }
  if (!stored.startsWith(`${PREFIX}$`)) {
    return { ok: stored === plain, legacy: true }
  }
  const [, saltHex, hashHex] = stored.split('$')
  if (!saltHex || !hashHex) return { ok: false, legacy: false }
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(plain, Buffer.from(saltHex, 'hex'), expected.length)
  return { ok: actual.length === expected.length && timingSafeEqual(actual, expected), legacy: false }
}

export function isHashed(stored: string | null): boolean {
  return Boolean(stored && stored.startsWith(`${PREFIX}$`))
}
