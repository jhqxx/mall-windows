import { app } from 'electron'
import { openDatabase, type DriverName, type SqliteHandle } from './sqlite-driver'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { hashPassword, verifyPassword, newToken } from './auth'

export type SessionUser = { id: number; username: string; displayName: string; role: string }
export type AttachmentRow = {
  id: number
  case_id: number | null
  file_name: string
  file_size: number
  uploader: string
  stored_path: string
  created_at: string
}
export type CaseRow = {
  id: number
  case_no: string
  case_type: string
  is_closed: number
  closed_at: string | null
  is_overdue: number
  overdue_reason: string | null
  owner: string | null
  co_owner: string | null
  reviewer: string | null
  reviewed_at: string | null
  leader_approval: string | null
  approval_status: string | null
  report_detail: string | null
  remark: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
export type LogRow = {
  id: number
  username: string | null
  action: string
  target_type: string | null
  target_id: string | null
  detail: string | null
  machine: string | null
  result: string
  created_at: string
}

export type CaseInput = {
  caseType: string
  isClosed: boolean
  closedAt: string | null
  isOverdue: boolean
  overdueReason: string | null
  owner: string | null
  coOwner: string | null
  reviewer: string | null
  reviewedAt: string | null
  leaderApproval: string | null
  approvalStatus: string | null
  reportDetail: string | null
  remark: string | null
}

export type DictGroupRow = {
  id: number
  name: string
  sort_no: number
  remark: string | null
  created_at: string
  type_count: number
}

export type DictTypeRow = {
  id: number
  code: string
  name: string
  remark: string | null
  builtin: number
  group_id: number | null
  created_at: string
  item_count: number
}

export type DictItemRow = {
  id: number
  type_code: string
  label: string
  value: string
  sort_no: number
  enabled: number
  remark: string | null
  created_at: string
  updated_at: string
}

let db: SqliteHandle | null = null

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_no TEXT NOT NULL UNIQUE,
    case_type TEXT NOT NULL,
    is_closed INTEGER NOT NULL DEFAULT 0,
    closed_at TEXT,
    is_overdue INTEGER NOT NULL DEFAULT 0,
    overdue_reason TEXT,
    owner TEXT,
    co_owner TEXT,
    reviewer TEXT,
    reviewed_at TEXT,
    leader_approval TEXT,
    approval_status TEXT,
    report_detail TEXT,
    remark TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploader TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    detail TEXT,
    machine TEXT,
    result TEXT NOT NULL DEFAULT 'success',
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS dict_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    remark TEXT,
    builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS dict_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_code TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    sort_no INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (type_code, value)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_dict_items_type ON dict_items (type_code, sort_no);`,
  `CREATE TABLE IF NOT EXISTS dict_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_no INTEGER NOT NULL DEFAULT 0,
    remark TEXT,
    created_at TEXT NOT NULL
  );`,
  `ALTER TABLE dict_types ADD COLUMN group_id INTEGER;`
]

export const nowIso = (): string => new Date().toISOString()

export function getPaths(): { userData: string; dbFile: string; attachmentsDir: string } {
  const userData = app.getPath('userData')
  return {
    userData,
    dbFile: path.join(userData, 'app.db'),
    attachmentsDir: path.join(userData, 'attachments')
  }
}

export function initRememberFilePath(): string {
  return path.join(getPaths().userData, 'remember.bin')
}

export function initDb(): void {
  const paths = getPaths()
  fs.mkdirSync(paths.attachmentsDir, { recursive: true })
  db = openDatabase(paths.dbFile)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  migrate()
  seed()
}

function migrate(): void {
  const conn = conn_()
  conn.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);')
  const row = conn.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined
  let current = row?.version ?? 0
  for (let i = current; i < MIGRATIONS.length; i++) {
    const sql = MIGRATIONS[i]
    conn.transaction(() => {
      conn.exec(sql)
    })()
    current = i + 1
  }
  if (row) {
    conn.prepare('UPDATE schema_version SET version = ?').run(current)
  } else {
    conn.prepare('INSERT INTO schema_version (version) VALUES (?)').run(current)
  }
}

function seed(): void {
  const conn = conn_()
  const count = conn.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }
  if (count.n === 0) {
    const { salt, hash } = hashPassword('123456')
    conn
      .prepare(
        `INSERT INTO users (username, password_hash, salt, display_name, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('admin', hash, salt, '管理员', 'admin', nowIso())
  }
  seedDictionaries(conn)
}

// 内置字典：与表单里的下拉项一一对应，可改列表但不能删除类型本身。
const DICT_GROUPS: { name: string; sort: number; remark: string }[] = [
  { name: '案件业务', sort: 1, remark: '案件办理单上的选项' },
  { name: '签批流程', sort: 2, remark: '签批与审核相关选项' },
  { name: '通用选项', sort: 3, remark: '跨模块复用的基础选项' }
]

const DICT_SEEDS: { code: string; name: string; group: string; items: string[] }[] = [
  { code: 'case_type', name: '案件类型', group: '案件业务', items: ['投诉举报', '业务咨询', '违规线索', '服务纠纷', '其他'] },
  { code: 'leader_approval', name: '领导签批', group: '签批流程', items: ['同意', '不同意', '待签批'] },
  { code: 'approval_status', name: '签批情况', group: '签批流程', items: ['已签批', '部分签批', '未签批'] },
  { code: 'yes_no', name: '是否', group: '通用选项', items: ['是', '否'] }
]

function seedDictionaries(conn: SqliteHandle): void {
  const ts = nowIso()
  const insertGroup = conn.prepare(
    `INSERT INTO dict_groups (name, sort_no, remark, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO NOTHING`
  )
  for (const group of DICT_GROUPS) insertGroup.run(group.name, group.sort, group.remark, ts)
  const groupIds = new Map<string, number>()
  for (const row of conn.prepare('SELECT id, name FROM dict_groups').all() as { id: number; name: string }[]) {
    groupIds.set(row.name, row.id)
  }
  const insertType = conn.prepare(
    `INSERT INTO dict_types (code, name, remark, builtin, group_id, created_at)
     VALUES (?, ?, ?, 1, ?, ?)
     ON CONFLICT(code) DO NOTHING`
  )
  const insertItem = conn.prepare(
    `INSERT INTO dict_items (type_code, label, value, sort_no, enabled, remark, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, NULL, ?, ?)
     ON CONFLICT(type_code, value) DO NOTHING`
  )
  const assignGroup = conn.prepare('UPDATE dict_types SET group_id = ? WHERE code = ? AND group_id IS NULL')
  for (const dict of DICT_SEEDS) {
    insertType.run(dict.code, dict.name, '系统内置字典', groupIds.get(dict.group) ?? null, ts)
    assignGroup.run(groupIds.get(dict.group) ?? null, dict.code)
    dict.items.forEach((label, index) => insertItem.run(dict.code, label, label, index + 1, ts, ts))
  }
  const orphans = conn.prepare('SELECT COUNT(*) AS c FROM dict_types WHERE group_id IS NULL').get() as { c: number }
  if (orphans.c > 0) {
    insertGroup.run('未分组', 99, '升级时未能自动归类的字典', ts)
    const row = conn.prepare("SELECT id FROM dict_groups WHERE name = '未分组'").get() as { id: number }
    conn.prepare('UPDATE dict_types SET group_id = ? WHERE group_id IS NULL').run(row.id)
  }
}

function conn_(): SqliteHandle {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

export function getRawDb(): SqliteHandle {
  return conn_()
}

/** 当前实际生效的驱动名（node:sqlite / better-sqlite3），用于诊断与展示 */
export function sqliteDriver(): DriverName {
  return conn_().driver
}

export function findUser(username: string):
  | { id: number; username: string; display_name: string; role: string; password_hash: string; salt: string }
  | undefined {
  return conn_()
    .prepare('SELECT id, username, display_name, role, password_hash, salt FROM users WHERE username = ?')
    .get(username) as any
}

export function checkPassword(
  user: { password_hash: string; salt: string },
  password: string
): boolean {
  return verifyPassword(password, user.salt, user.password_hash)
}

export function toSessionUser(user: { id: number; username: string; display_name: string; role: string }): SessionUser {
  return { id: user.id, username: user.username, displayName: user.display_name, role: user.role }
}

export function createSession(userId: number): string {
  const token = newToken()
  conn_()
    .prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, nowIso())
  return token
}

export function findUserByToken(token: string):
  | { id: number; username: string; display_name: string; role: string }
  | undefined {
  return conn_()
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as any
}

export function deleteSession(token: string): void {
  conn_().prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function createCase(input: CaseInput, operator: SessionUser, attachmentIds: number[]): CaseRow {
  const conn = conn_()
  const day = new Date()
  const stamp = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(
    day.getDate()
  ).padStart(2, '0')}`
  const created = conn
    .prepare(`SELECT COUNT(*) AS n FROM cases WHERE case_no LIKE ?`)
    .get(`CASE-${stamp}-%`) as { n: number }
  const caseNo = `CASE-${stamp}-${String(created.n + 1).padStart(4, '0')}`
  const ts = nowIso()

  const id = conn.transaction(() => {
    const info = conn
      .prepare(
        `INSERT INTO cases (case_no, case_type, is_closed, closed_at, is_overdue, overdue_reason,
          owner, co_owner, reviewer, reviewed_at, leader_approval, approval_status,
          report_detail, remark, created_by, created_at, updated_at)
         VALUES (@case_no, @case_type, @is_closed, @closed_at, @is_overdue, @overdue_reason,
          @owner, @co_owner, @reviewer, @reviewed_at, @leader_approval, @approval_status,
          @report_detail, @remark, @created_by, @created_at, @updated_at)`
      )
      .run({
        case_no: caseNo,
        case_type: input.caseType,
        is_closed: input.isClosed ? 1 : 0,
        closed_at: input.closedAt,
        is_overdue: input.isOverdue ? 1 : 0,
        overdue_reason: input.overdueReason,
        owner: input.owner,
        co_owner: input.coOwner,
        reviewer: input.reviewer,
        reviewed_at: input.reviewedAt,
        leader_approval: input.leaderApproval,
        approval_status: input.approvalStatus,
        report_detail: input.reportDetail,
        remark: input.remark,
        created_by: operator.username,
        created_at: ts,
        updated_at: ts
      })
    const caseId = Number(info.lastInsertRowid)
    if (attachmentIds.length) {
      const upd = conn.prepare('UPDATE attachments SET case_id = ? WHERE id = ?')
      for (const aid of attachmentIds) upd.run(caseId, aid)
    }
    return caseId
  })()

  const row = conn.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow
  return row
}

export function listCases(opts: { page: number; pageSize: number; keyword?: string }): {
  rows: CaseRow[]
  total: number
} {
  const conn = conn_()
  const kw = (opts.keyword ?? '').trim()
  const where = kw ? `WHERE case_no LIKE @kw OR case_type LIKE @kw OR owner LIKE @kw OR remark LIKE @kw` : ''
  // 注意：node:sqlite 对「传了 SQL 里不存在的命名参数」会直接报错（better-sqlite3 会忽略），
  // 因此参数集合必须按实际拼接的 SQL 精确构造。
  const pageParams: Record<string, unknown> = {}
  if (kw) pageParams.kw = `%${kw}%`
  const totalSql = `SELECT COUNT(*) AS n FROM cases ${where}`
  const total = ((kw ? conn.prepare(totalSql).get(pageParams) : conn.prepare(totalSql).get()) as { n: number }).n
  const listParams: Record<string, unknown> = {
    ...(kw ? { kw: `%${kw}%` } : {}),
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize
  }
  const rows = conn
    .prepare(`SELECT * FROM cases ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all(listParams) as CaseRow[]
  return { rows, total }
}

export function getCase(id: number): CaseRow | undefined {
  return conn_().prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined
}

export function deleteCase(id: number): CaseRow | undefined {
  const conn = conn_()
  const row = getCase(id)
  if (!row) return undefined
  const files = listAttachments(id)
  conn.transaction(() => {
    conn.prepare('DELETE FROM cases WHERE id = ?').run(id)
    conn.prepare('DELETE FROM attachments WHERE case_id = ?').run(id)
  })()
  for (const f of files) removeFile(f.stored_path)
  return row
}

export function addAttachments(sourcePaths: string[], uploader: string): AttachmentRow[] {
  const conn = conn_()
  const dir = getPaths().attachmentsDir
  fs.mkdirSync(dir, { recursive: true })
  const out: AttachmentRow[] = []
  const insert = conn.prepare(
    `INSERT INTO attachments (case_id, file_name, file_size, uploader, stored_path, created_at)
     VALUES (NULL, ?, ?, ?, ?, ?)`
  )
  for (const src of sourcePaths) {
    try {
      const stat = fs.statSync(src)
      const base = path.basename(src)
      const stored = path.join(dir, `${crypto.randomUUID()}_${base}`)
      fs.copyFileSync(src, stored)
      const info = insert.run(base, stat.size, uploader, stored, nowIso())
      out.push(conn.prepare('SELECT * FROM attachments WHERE id = ?').get(Number(info.lastInsertRowid)) as AttachmentRow)
    } catch (err) {
      console.error('[attachment] copy failed', src, err)
    }
  }
  return out
}

export function listAttachments(caseId: number | null): AttachmentRow[] {
  const conn = conn_()
  if (caseId === null) {
    return conn.prepare('SELECT * FROM attachments WHERE case_id IS NULL ORDER BY id DESC').all() as AttachmentRow[]
  }
  return conn.prepare('SELECT * FROM attachments WHERE case_id = ? ORDER BY id DESC').all(caseId) as AttachmentRow[]
}

export function getAttachments(ids: number[]): AttachmentRow[] {
  if (!ids.length) return []
  const conn = conn_()
  const rows: AttachmentRow[] = []
  const stmt = conn.prepare('SELECT * FROM attachments WHERE id = ?')
  for (const id of ids) {
    const row = stmt.get(id) as AttachmentRow | undefined
    if (row) rows.push(row)
  }
  return rows
}

export function deleteAttachments(ids: number[]): AttachmentRow[] {
  const conn = conn_()
  const rows = getAttachments(ids)
  const del = conn.prepare('DELETE FROM attachments WHERE id = ?')
  conn.transaction(() => {
    for (const row of rows) del.run(row.id)
  })()
  for (const row of rows) removeFile(row.stored_path)
  return rows
}

function removeFile(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch (err) {
    console.error('[attachment] remove failed', filePath, err)
  }
}

export function copyAttachmentTo(row: AttachmentRow, targetDir: string): string {
  let target = path.join(targetDir, row.file_name)
  let i = 1
  while (fs.existsSync(target)) {
    const ext = path.extname(row.file_name)
    const base = path.basename(row.file_name, ext)
    target = path.join(targetDir, `${base}(${i})${ext}`)
    i += 1
  }
  fs.copyFileSync(row.stored_path, target)
  return target
}

export function addLog(entry: {
  userId?: number | null
  username?: string | null
  action: string
  targetType?: string | null
  targetId?: string | number | null
  detail?: string | null
  result?: 'success' | 'failed'
}): void {
  conn_()
    .prepare(
      `INSERT INTO audit_logs (user_id, username, action, target_type, target_id, detail, machine, result, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry.userId ?? null,
      entry.username ?? null,
      entry.action,
      entry.targetType ?? null,
      entry.targetId === undefined || entry.targetId === null ? null : String(entry.targetId),
      entry.detail ?? null,
      os.hostname(),
      entry.result ?? 'success',
      nowIso()
    )
}

export function listLogs(opts: {
  page: number
  pageSize: number
  action?: string
  keyword?: string
}): { rows: LogRow[]; total: number } {
  const conn = conn_()
  const clauses: string[] = []
  const params: Record<string, any> = {
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize
  }
  if (opts.action) {
    clauses.push('action = @action')
    params.action = opts.action
  }
  if (opts.keyword && opts.keyword.trim()) {
    clauses.push('(username LIKE @kw OR detail LIKE @kw OR target_id LIKE @kw)')
    params.kw = `%${opts.keyword.trim()}%`
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const filterParams: Record<string, unknown> = {}
  if (opts.action) filterParams.action = opts.action
  if (opts.keyword && opts.keyword.trim()) filterParams.kw = `%${opts.keyword.trim()}%`
  const total = ((
    clauses.length
      ? conn.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${where}`).get(filterParams)
      : conn.prepare(`SELECT COUNT(*) AS n FROM audit_logs`).get()
  ) as { n: number }).n
  const rows = conn
    .prepare(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...filterParams, limit: opts.pageSize, offset: (opts.page - 1) * opts.pageSize }) as LogRow[]
  return { rows, total }
}

export function allLogs(): LogRow[] {
  return conn_().prepare('SELECT * FROM audit_logs ORDER BY id DESC').all() as LogRow[]
}

export function stats(): { cases: number; attachments: number; logs: number; driver: DriverName } {
  const conn = conn_()
  const c = conn.prepare('SELECT COUNT(*) AS n FROM cases').get() as { n: number }
  const a = conn.prepare('SELECT COUNT(*) AS n FROM attachments').get() as { n: number }
  const l = conn.prepare('SELECT COUNT(*) AS n FROM audit_logs').get() as { n: number }
  return { cases: c.n, attachments: a.n, logs: l.n, driver: conn.driver }
}

export function listDictGroups(): DictGroupRow[] {
  return conn_()
    .prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM dict_types t WHERE t.group_id = g.id) AS type_count
       FROM dict_groups g
       ORDER BY g.sort_no ASC, g.id ASC`
    )
    .all() as DictGroupRow[]
}

export function saveDictGroup(input: {
  id?: number
  name: string
  sortNo?: number
  remark?: string | null
}): DictGroupRow {
  const conn = conn_()
  if (input.id) {
    conn
      .prepare('UPDATE dict_groups SET name = ?, sort_no = ?, remark = ? WHERE id = ?')
      .run(input.name, input.sortNo ?? 0, input.remark ?? null, input.id)
    return conn.prepare('SELECT * FROM dict_groups WHERE id = ?').get(input.id) as DictGroupRow
  }
  const info = conn
    .prepare('INSERT INTO dict_groups (name, sort_no, remark, created_at) VALUES (?, ?, ?, ?)')
    .run(input.name, input.sortNo ?? 0, input.remark ?? null, nowIso())
  return conn.prepare('SELECT * FROM dict_groups WHERE id = ?').get(Number(info.lastInsertRowid)) as DictGroupRow
}

export function deleteDictGroup(id: number): { ok: boolean; message?: string; name?: string } {
  const conn = conn_()
  const row = conn.prepare('SELECT * FROM dict_groups WHERE id = ?').get(id) as DictGroupRow | undefined
  if (!row) return { ok: false, message: '分组不存在' }
  const used = conn.prepare('SELECT COUNT(*) AS c FROM dict_types WHERE group_id = ?').get(id) as { c: number }
  if (used.c > 0) return { ok: false, message: '该分组下还有字典，先移走或删除' }
  conn.prepare('DELETE FROM dict_groups WHERE id = ?').run(id)
  return { ok: true, name: row.name }
}

export function listDictTypes(groupId?: number): DictTypeRow[] {
  const conn = conn_()
  const sql = `SELECT t.*, (SELECT COUNT(*) FROM dict_items i WHERE i.type_code = t.code) AS item_count
       FROM dict_types t`
  const order = ' ORDER BY t.builtin DESC, t.id ASC'
  if (groupId === undefined) return conn.prepare(sql + order).all() as DictTypeRow[]
  return conn.prepare(sql + ' WHERE t.group_id = ?' + order).all(groupId) as DictTypeRow[]
}

export function listDictItems(typeCode: string): DictItemRow[] {
  return conn_()
    .prepare('SELECT * FROM dict_items WHERE type_code = ? ORDER BY sort_no ASC, id ASC')
    .all(typeCode) as DictItemRow[]
}

/** 表单下拉用：只取启用项，按排序号升序 */
export function dictOptions(code: string): { label: string; value: string }[] {
  return conn_()
    .prepare(
      'SELECT label, value FROM dict_items WHERE type_code = ? AND enabled = 1 ORDER BY sort_no ASC, id ASC'
    )
    .all(code) as { label: string; value: string }[]
}

export function saveDictType(input: {
  id?: number
  code: string
  name: string
  groupId?: number | null
  remark?: string | null
}): DictTypeRow {
  const conn = conn_()
  if (input.id) {
    conn
      .prepare('UPDATE dict_types SET name = ?, remark = ?, group_id = ? WHERE id = ?')
      .run(input.name, input.remark ?? null, input.groupId ?? null, input.id)
    return conn.prepare('SELECT * FROM dict_types WHERE id = ?').get(input.id) as DictTypeRow
  }
  const info = conn
    .prepare('INSERT INTO dict_types (code, name, remark, builtin, group_id, created_at) VALUES (?, ?, ?, 0, ?, ?)')
    .run(input.code, input.name, input.remark ?? null, input.groupId ?? null, nowIso())
  return conn.prepare('SELECT * FROM dict_types WHERE id = ?').get(Number(info.lastInsertRowid)) as DictTypeRow
}

export function deleteDictType(id: number): { ok: boolean; message?: string; name?: string } {
  const conn = conn_()
  const row = conn.prepare('SELECT * FROM dict_types WHERE id = ?').get(id) as DictTypeRow | undefined
  if (!row) return { ok: false, message: '字典不存在' }
  if (row.builtin) return { ok: false, message: '内置字典用于表单下拉，不可删除' }
  conn.transaction(() => {
    conn.prepare('DELETE FROM dict_items WHERE type_code = ?').run(row.code)
    conn.prepare('DELETE FROM dict_types WHERE id = ?').run(id)
  })()
  return { ok: true, name: row.name }
}

export function saveDictItem(input: {
  id?: number
  typeCode: string
  label: string
  value: string
  sortNo: number
  enabled: boolean
  remark?: string | null
}): DictItemRow {
  const conn = conn_()
  const ts = nowIso()
  if (input.id) {
    conn
      .prepare(
        'UPDATE dict_items SET label = ?, value = ?, sort_no = ?, enabled = ?, remark = ?, updated_at = ? WHERE id = ?'
      )
      .run(input.label, input.value, input.sortNo, input.enabled ? 1 : 0, input.remark ?? null, ts, input.id)
    return conn.prepare('SELECT * FROM dict_items WHERE id = ?').get(input.id) as DictItemRow
  }
  const info = conn
    .prepare(
      `INSERT INTO dict_items (type_code, label, value, sort_no, enabled, remark, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(input.typeCode, input.label, input.value, input.sortNo, input.enabled ? 1 : 0, input.remark ?? null, ts, ts)
  return conn.prepare('SELECT * FROM dict_items WHERE id = ?').get(Number(info.lastInsertRowid)) as DictItemRow
}

export function deleteDictItem(id: number): DictItemRow | undefined {
  const conn = conn_()
  const row = conn.prepare('SELECT * FROM dict_items WHERE id = ?').get(id) as DictItemRow | undefined
  if (!row) return undefined
  conn.prepare('DELETE FROM dict_items WHERE id = ?').run(id)
  return row
}
