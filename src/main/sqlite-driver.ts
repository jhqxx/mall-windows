/**
 * node:sqlite 优先、better-sqlite3 回退；上层只依赖 SqliteHandle。
 * 差异抹平：pragma→exec；transaction 立即执行 BEGIN/COMMIT/ROLLBACK；lastInsertRowid/changes 统一 number。
 */

export interface RunResult {
  changes: number
  lastInsertRowid: number
}

export interface SqliteStatement {
  run(...params: unknown[]): RunResult
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
}

export type DriverName = 'node:sqlite' | 'better-sqlite3'

export interface SqliteHandle {
  readonly driver: DriverName
  exec(sql: string): void
  pragma(sql: string): void
  prepare(sql: string): SqliteStatement
  transaction<T>(fn: () => T): T
  close(): void
}

type BetterSqlite3Module = {
  default: new (file: string) => {
    exec(sql: string): void
    pragma(sql: string): unknown
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
      get(...params: unknown[]): Record<string, unknown> | undefined
      all(...params: unknown[]): Record<string, unknown>[]
    }
    transaction<T>(fn: () => T): () => T
    close(): void
  }
}

class NodeSqliteHandle implements SqliteHandle {
  readonly driver: DriverName = 'node:sqlite'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: any) {}

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(sql: string): void {
    this.db.exec(`PRAGMA ${sql}`)
  }

  prepare(sql: string): SqliteStatement {
    const stmt = this.db.prepare(sql)
    return {
      run: (...params: unknown[]): RunResult => {
        const res = stmt.run(...params)
        return {
          changes: Number(res?.changes ?? 0),
          lastInsertRowid: Number(res?.lastInsertRowid ?? 0)
        }
      },
      get: (...params: unknown[]) => stmt.get(...params) as Record<string, unknown> | undefined,
      all: (...params: unknown[]) => stmt.all(...params) as Record<string, unknown>[]
    }
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const out = fn()
      this.db.exec('COMMIT')
      return out
    } catch (err) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* 回滚失败时保留原始错误 */
      }
      throw err
    }
  }

  close(): void {
    this.db.close()
  }
}

class BetterSqlite3Handle implements SqliteHandle {
  readonly driver: DriverName = 'better-sqlite3'

  constructor(private readonly db: InstanceType<BetterSqlite3Module['default']>) {}

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(sql: string): void {
    this.db.pragma(sql)
  }

  prepare(sql: string): SqliteStatement {
    const stmt = this.db.prepare(sql)
    return {
      run: (...params: unknown[]): RunResult => {
        const res = stmt.run(...params)
        return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) }
      },
      get: (...params: unknown[]) => stmt.get(...params),
      all: (...params: unknown[]) => stmt.all(...params)
    }
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)()
  }

  close(): void {
    this.db.close()
  }
}

function loadNodeSqlite(): { DatabaseSync: new (file: string) => unknown } | null {
  try {
    // Electron 45 / Node 24 内置；打包后主进程仍可 require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('node:sqlite') as { DatabaseSync?: new (file: string) => unknown }
    return mod?.DatabaseSync ? { DatabaseSync: mod.DatabaseSync } : null
  } catch {
    return null
  }
}

function loadBetterSqlite3(): BetterSqlite3Module | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('better-sqlite3') as BetterSqlite3Module | BetterSqlite3Module['default']
    // CJS 的 module.exports 本身就是构造函数，没有 default 包装
    return (typeof mod === 'function' ? { default: mod } : mod) as BetterSqlite3Module
  } catch {
    return null
  }
}

export function openDatabase(file: string, preferred?: DriverName): SqliteHandle {
  const forced = (process.env['MALL_SQLITE_DRIVER'] as DriverName | undefined) ?? preferred
  const wantNode = forced !== 'better-sqlite3'

  if (wantNode) {
    const nodeSqlite = loadNodeSqlite()
    if (nodeSqlite) {
      return new NodeSqliteHandle(new nodeSqlite.DatabaseSync(file))
    }
    if (forced === 'node:sqlite') {
      throw new Error('node:sqlite 不可用，且已强制指定该驱动')
    }
  }

  const better = loadBetterSqlite3()
  if (better) {
    return new BetterSqlite3Handle(new better.default(file))
  }

  throw new Error('没有可用的 SQLite 驱动：node:sqlite 与 better-sqlite3 均不可用')
}
