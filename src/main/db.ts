import { app } from 'electron'
import { readSettings } from './settings'
import fs from 'node:fs'
import path from 'node:path'
import { hashPassword, isHashed, verifyPassword } from './password'
import { openDatabase, type DriverName, type SqliteHandle } from './sqlite-driver'
import { createSchema, seedIfEmpty } from './schema'

export interface SessionUser {
  id: number
  username: string
  realName: string
  role: string
  department: string
}

export interface UserRow {
  Id: number
  Username: string
  Password: string
  RealName: string | null
  Role: string
  Department: string | null
  Email: string | null
  Phone: string | null
  IsActive: number
  CreateTime: string
  LastLoginTime: string | null
  LastLoginIP: string | null
}

export type ComplaintRow = Record<string, string | number | null> & { Id: number }

export interface ComplaintFilter {
  category?: string
  /** none = 未归并到线索，any = 已归并 */
  parent?: string
  /** 只看某条线索下的信访件 */
  clue?: string
  isOverdue?: string
  reportForm?: string
  isCompleted?: string
  disposeForm?: string
  keyword?: string
  tab?: string
  /** true = 只查看回收站（已逻辑删除）中的记录 */
  deleted?: boolean
  page?: number
  pageSize?: number
}

export interface DictClassRow {
  Id: number
  ClassName: string
  Description: string | null
  CreateTime: string
  UpdateTime: string
  itemCount?: number
}

export interface DictItemRow {
  Id: number
  ClassId: number
  ParentId: number | null
  ItemKey: string
  ItemValue: string
  SortOrder: number
  Description: string | null
  CreateTime: string
  UpdateTime: string
  children?: DictItemRow[]
}

export interface LogRow {
  Id: number
  UserName: string
  UserRealName: string | null
  UserRole: string | null
  OperationType: string
  OperationModule: string
  OperationContent: string | null
  TargetId: string | null
  TargetName: string | null
  IPAddress: string | null
  OperationTime: string
  Remark: string | null
}

export interface AttachmentRow {
  Id: number
  OriginalCode: string
  FileName: string
  FilePath: string
  FileSize: number | null
  FileType: string | null
  UploadTime: string
  Uploader: string | null
}

let db: SqliteHandle | null = null
let paths: { userData: string; dbFile: string; attachmentsDir: string } | null = null

export function sqliteDriver(): DriverName {
  return db?.driver ?? 'node:sqlite'
}

export function getPaths() {
  if (!paths) {
    const userData = app.getPath('userData')
    const settings = readSettings()
    paths = {
      userData,
      dbFile: settings.dbPath,
      attachmentsDir: settings.attachmentsDir,
    }
  }
  return paths
}

/** 设置变更后重置路径缓存并重连数据库 */
export function reloadDb(): void {
  checkpoint()
  if (db) {
    db.close()
    db = null
  }
  paths = null
  initDb()
}

export function checkpoint(): void {
  try {
    db?.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  } catch (error) {
    console.error('[db] checkpoint 失败：', error)
  }
}

/** 老库补列：ParentCode 承载「线索（主）→ 信访件（子）」，ParentId 承载字典项的三级结构 */
function ensureColumns(handle: SqliteHandle): void {
  const add = (table: string, column: string, ddl: string): void => {
    const columns = handle.prepare(`PRAGMA table_info('${table}')`).all() as unknown as Array<{ name: string }>
    if (!columns.some((item) => item.name === column)) handle.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
  add('Complaint', 'ParentCode', 'ParentCode TEXT')
  add('DictionaryItem', 'ParentId', 'ParentId INTEGER')
  for (const table of ['Complaint', 'Users', 'DictionaryClass', 'DictionaryItem']) {
    add(table, 'IsDeleted', 'IsDeleted INTEGER DEFAULT 0')
    add(table, 'DeleteTime', 'DeleteTime DATETIME')
  }
}

export function initDb(): void {
  const p = getPaths()
  fs.mkdirSync(p.attachmentsDir, { recursive: true })
  db = openDatabase(p.dbFile)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  createSchema(db)
  ensureColumns(db)
  try {
    seedIfEmpty(db)
  } catch (error) {
    console.error('[db] 种子数据导入失败：', error)
  }
  const upgraded = upgradePlainPasswords()
  if (upgraded > 0) console.log(`[db] 已将 ${upgraded} 个明文密码升级为 scrypt 哈希`)
}

function conn(): SqliteHandle {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

export function now(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.Id,
    username: row.Username,
    realName: row.RealName ?? row.Username,
    role: row.Role || 'User',
    department: row.Department ?? '',
  }
}

export function findUserByLogin(username: string, password: string): UserRow | null {
  const c = conn()
  const row = c
    .prepare('SELECT * FROM Users WHERE Username = @username AND IsActive = 1 AND IsDeleted = 0')
    .get({ username }) as unknown as UserRow | undefined
  if (!row) return null
  const result = verifyPassword(password, row.Password)
  if (!result.ok) return null
  if (result.legacy) {
    c.prepare('UPDATE Users SET Password = @password WHERE Id = @id').run({
      id: row.Id,
      password: hashPassword(password),
    })
  }
  return row
}

/** 把库里遗留的明文密码统一升级为 scrypt 哈希（老库进来自动迁移） */
export function upgradePlainPasswords(): number {
  const c = conn()
  const rows = c.prepare('SELECT Id, Password FROM Users').all() as unknown as Array<{
    Id: number
    Password: string | null
  }>
  let changed = 0
  for (const row of rows) {
    if (isHashed(row.Password)) continue
    c.prepare('UPDATE Users SET Password = @password WHERE Id = @id').run({
      id: row.Id,
      password: hashPassword(row.Password ?? ''),
    })
    changed += 1
  }
  return changed
}

export function restoreUser(id: number): number {
  return conn().prepare('UPDATE Users SET IsDeleted = 0, DeleteTime = NULL, IsActive = 1 WHERE Id = @id AND IsDeleted = 1').run({ id }).changes
}

export function getUserById(id: number): UserRow | null {
  return (conn().prepare('SELECT * FROM Users WHERE Id = @id AND IsDeleted = 0').get({ id }) as unknown as UserRow) ?? null
}

export function touchLogin(id: number, ip: string): void {
  conn()
    .prepare('UPDATE Users SET LastLoginTime = @time, LastLoginIP = @ip WHERE Id = @id')
    .run({ id, time: now(), ip })
}

export function listUsers(deleted = false): UserRow[] {
  return conn()
    .prepare(`SELECT * FROM Users WHERE IsDeleted = ${deleted ? 1 : 0} ORDER BY Id`)
    .all() as unknown as UserRow[]
}

export interface UserInput {
  id?: number
  username: string
  password?: string
  realName: string
  role: string
  department: string
  email: string
  phone: string
  isActive: number
}

export function saveUser(input: UserInput): number {
  const c = conn()
  const time = now()
  if (input.id) {
    const sets = [
      'RealName = @realName',
      'Role = @role',
      'Department = @department',
      'Email = @email',
      'Phone = @phone',
      'IsActive = @isActive',
    ]
    const params: Record<string, unknown> = {
      id: input.id,
      realName: input.realName,
      role: input.role,
      department: input.department,
      email: input.email,
      phone: input.phone,
      isActive: input.isActive,
    }
    if (input.password) {
      sets.push('Password = @password')
      params.password = hashPassword(input.password)
    }
    c.prepare(`UPDATE Users SET ${sets.join(', ')} WHERE Id = @id`).run(params)
    return input.id
  }
  const info = c
    .prepare(
      `INSERT INTO Users (Username, Password, RealName, Role, Department, Email, Phone, IsActive, CreateTime)
       VALUES (@username, @password, @realName, @role, @department, @email, @phone, @isActive, @createTime)`,
    )
    .run({
      username: input.username,
      password: hashPassword(input.password ?? ''),
      realName: input.realName,
      role: input.role,
      department: input.department,
      email: input.email,
      phone: input.phone,
      isActive: input.isActive,
      createTime: time,
    })
  return Number(info.lastInsertRowid)
}

export function deleteUser(id: number): void {
  conn()
    .prepare('UPDATE Users SET IsDeleted = 1, DeleteTime = @time, IsActive = 0 WHERE Id = @id')
    .run({ id, time: now() })
}

export function changePassword(id: number, password: string): void {
  conn()
    .prepare('UPDATE Users SET Password = @password WHERE Id = @id')
    .run({ id, password: hashPassword(password) })
}

const TAB_CLAUSES: Record<string, { sql: string; params: Record<string, string> }> = {
  real: { sql: "ReportForm = 'JB1001'", params: {} },
  anonymous: { sql: "ReportForm = 'JB1002'", params: {} },
  processing: { sql: "IsCompleted = 'BJ1002'", params: {} },
  completed: { sql: "IsCompleted = 'BJ1001'", params: {} },
  overdue: { sql: "IsOverdue = 'CQ1001'", params: {} },
}

function buildComplaintWhere(filter: ComplaintFilter): { where: string; params: Record<string, string> } {
  const clauses: string[] = []
  const params: Record<string, string> = {}
  if (filter.deleted) {
    clauses.push('IsDeleted = 1')
    return { where: `WHERE ${clauses.join(' AND ')}`, params }
  }
  clauses.push('IsDeleted = 0')
  const tab = filter.tab && TAB_CLAUSES[filter.tab]
  if (tab) clauses.push(tab.sql)
  if (filter.category) {
    clauses.push('Category = @category')
    params.category = filter.category
  }
  if (filter.parent === 'none') {
    clauses.push("(ParentCode IS NULL OR ParentCode = '')")
  } else if (filter.parent === 'any') {
    clauses.push("(ParentCode IS NOT NULL AND ParentCode <> '')")
  }
  if (filter.clue) {
    clauses.push('ParentCode = @clue')
    params.clue = filter.clue
  }
  if (filter.isOverdue) {
    clauses.push('IsOverdue = @isOverdue')
    params.isOverdue = filter.isOverdue
  }
  if (filter.reportForm) {
    clauses.push('ReportForm = @reportForm')
    params.reportForm = filter.reportForm
  }
  if (filter.isCompleted) {
    clauses.push('IsCompleted = @isCompleted')
    params.isCompleted = filter.isCompleted
  }
  if (filter.disposeForm) {
    clauses.push('DisposeForm = @disposeForm')
    params.disposeForm = filter.disposeForm
  }
  const keyword = filter.keyword?.trim()
  if (keyword) {
    clauses.push(
      "(OriginalCode LIKE @kw OR NewCode LIKE @kw OR CategoryCode LIKE @kw OR TargetName LIKE @kw OR ProblemSummary LIKE @kw OR MainHandler LIKE @kw)",
    )
    params.kw = `%${keyword}%`
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export function listComplaints(filter: ComplaintFilter): {
  rows: ComplaintRow[]
  total: number
  tabs: Record<string, number>
  childCounts: Record<string, number>
} {
  const pageSize = Math.max(1, Math.min(200, filter.pageSize ?? 20))
  const page = Math.max(1, filter.page ?? 1)
  const { where, params } = buildComplaintWhere(filter)
  const total = (
    conn().prepare(`SELECT COUNT(*) AS n FROM Complaint ${where}`).get(params) as { n: number }
  ).n
  const rows = conn()
    .prepare(
      `SELECT * FROM Complaint ${where} ORDER BY ReceiveTime DESC, Id DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as unknown as ComplaintRow[]
  return { rows, total, tabs: tabCounts(filter), childCounts: childCounts(rows) }
}

/** 线索 → 名下信访件数量（只统计当前页出现的线索，避免整表扫描） */
function childCounts(rows: ComplaintRow[]): Record<string, number> {
  const codes = rows.filter((row) => row.Category === '0').map((row) => String(row.OriginalCode))
  if (!codes.length) return {}
  const params: Record<string, string> = {}
  const holes = codes.map((code, index) => {
    params[`p${index}`] = code
    return `@p${index}`
  })
  const list = conn()
    .prepare(
      `SELECT ParentCode, COUNT(*) AS n FROM Complaint WHERE IsDeleted = 0 AND ParentCode IN (${holes.join(',')}) GROUP BY ParentCode`,
    )
    .all(params) as unknown as Array<{ ParentCode: string; n: number }>
  const map: Record<string, number> = {}
  for (const item of list) map[item.ParentCode] = item.n
  return map
}

/** 线索下拉（归并信访件时选主单） */
export function clueOptions(): Array<{ code: string; name: string; summary: string }> {
  const rows = conn()
    .prepare(
      "SELECT OriginalCode, TargetName, OrganizationName, ProblemSummary FROM Complaint WHERE Category = '0' ORDER BY ReceiveTime DESC, Id DESC LIMIT 500",
    )
    .all() as unknown as Array<Record<string, string | null>>
  return rows.map((row) => ({
    code: String(row.OriginalCode),
    name: String(row.TargetName || row.OrganizationName || '未填写被反映人'),
    summary: String(row.ProblemSummary || ''),
  }))
}

/** 线索名下的信访件 */
export function lettersOfClue(clueCode: string): ComplaintRow[] {
  return conn()
    .prepare('SELECT * FROM Complaint WHERE IsDeleted = 0 AND ParentCode = @clue ORDER BY ReceiveTime DESC, Id DESC')
    .all({ clue: clueCode }) as unknown as ComplaintRow[]
}

/** 把信访件归并到线索（clueCode 为空表示移出） */
export function assignToClue(codes: string[], clueCode: string | null): number {
  if (!codes.length) return 0
  if (clueCode) {
    const clue = conn()
      .prepare("SELECT Category FROM Complaint WHERE OriginalCode = @code")
      .get({ code: clueCode }) as { Category: string } | undefined
    if (!clue) throw new Error('线索不存在')
    if (clue.Category !== '0') throw new Error('只能归并到问题线索')
  }
  const c = conn()
  const time = now()
  const params: Record<string, string | null> = { parent: clueCode, time }
  const holes = codes.map((code, index) => {
    params[`c${index}`] = code
    return `@c${index}`
  })
  const info = c
    .prepare(
      `UPDATE Complaint SET ParentCode = @parent, UpdateTime = @time WHERE OriginalCode IN (${holes.join(',')}) AND Category = '1'`,
    )
    .run(params)
  return Number(info.changes ?? 0)
}

export function complaintsForExport(codes?: string[], category?: string): ComplaintRow[] {
  if (codes?.length) {
    const params: Record<string, string> = {}
    const holes = codes.map((code, index) => {
      params[`c${index}`] = code
      return `@c${index}`
    })
    return conn()
      .prepare(
        `SELECT * FROM Complaint WHERE IsDeleted = 0 AND OriginalCode IN (${holes.join(',')}) ORDER BY ReceiveTime DESC, Id DESC`,
      )
      .all(params) as unknown as ComplaintRow[]
  }
  if (category) {
    return conn()
      .prepare('SELECT * FROM Complaint WHERE IsDeleted = 0 AND Category = @category ORDER BY ReceiveTime DESC, Id DESC')
      .all({ category }) as unknown as ComplaintRow[]
  }
  return conn()
    .prepare('SELECT * FROM Complaint WHERE IsDeleted = 0 ORDER BY ReceiveTime DESC, Id DESC')
    .all() as unknown as ComplaintRow[]
}

export function tabCounts(filter: ComplaintFilter = {}): Record<string, number> {
  const c = conn()
  const base = buildComplaintWhere({ ...filter, tab: undefined })
  const inner = base.where.replace(/^WHERE /, '')
  const count = (clause?: string): number => {
    const parts = [inner, clause].filter(Boolean).join(' AND ')
    const sql = `SELECT COUNT(*) AS n FROM Complaint ${parts ? `WHERE ${parts}` : ''}`
    return (c.prepare(sql).get(base.params) as { n: number }).n
  }
  return {
    all: count(),
    real: count("ReportForm = 'JB1001'"),
    anonymous: count("ReportForm = 'JB1002'"),
    processing: count("IsCompleted = 'BJ1002'"),
    completed: count("IsCompleted = 'BJ1001'"),
    overdue: count("IsOverdue = 'CQ1001'"),
  }
}

export function getComplaint(originalCode: string): ComplaintRow | null {
  return (
    (conn()
      .prepare('SELECT * FROM Complaint WHERE OriginalCode = @code')
      .get({ code: originalCode }) as unknown as ComplaintRow) ?? null
  )
}

export function nextOriginalCode(): string {
  const prefix = now().slice(0, 10).replace(/-/g, '')
  const row = conn()
    .prepare("SELECT MAX(CAST(SUBSTR(OriginalCode, 9) AS INTEGER)) AS seq FROM Complaint WHERE OriginalCode LIKE @p")
    .get({ p: `${prefix}%` }) as { seq: number | null }
  const seq = (row.seq ?? 0) + 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}

export function saveComplaint(input: Record<string, string | null>, isNew: boolean): string {
  const c = conn()
  const time = now()
  const data: Record<string, string | null> = { ...input }
  if (String(data.Category ?? '') === '0') data.ParentCode = null
  data.CreateTime = isNew ? time : ((input.CreateTime as string) ?? time)
  data.UpdateTime = time
  const columns = Object.keys(data)
  const existing = c
    .prepare('SELECT IsDeleted FROM Complaint WHERE OriginalCode = @code')
    .get({ code: String(data.OriginalCode) }) as unknown as { IsDeleted: number } | undefined
  if (isNew && existing?.IsDeleted) {
    const sets = columns.filter((k) => k !== 'OriginalCode').map((k) => `"${k}" = @${k}`)
    c.prepare(`UPDATE Complaint SET ${sets.join(', ')}, IsDeleted = 0, DeleteTime = NULL WHERE OriginalCode = @OriginalCode`).run(data)
    return String(data.OriginalCode)
  }
  if (isNew) {
    const sql = `INSERT INTO Complaint (${columns.map((k) => `"${k}"`).join(', ')}) VALUES (${columns
      .map((k) => `@${k}`)
      .join(', ')})`
    c.prepare(sql).run(data)
    return String(data.OriginalCode)
  }
  const sets = columns.filter((k) => k !== 'OriginalCode').map((k) => `"${k}" = @${k}`)
  c.prepare(`UPDATE Complaint SET ${sets.join(', ')} WHERE OriginalCode = @OriginalCode`).run(data)
  return String(data.OriginalCode)
}

export function deleteComplaints(codes: string[]): void {
  if (!codes.length) return
  const c = conn()
  const time = now()
  c.transaction(() => {
    for (const code of codes) {
      c.prepare('UPDATE Complaint SET IsDeleted = 1, DeleteTime = @time WHERE OriginalCode = @code').run({ code, time })
    }
  })
}

export function restoreComplaints(codes: string[]): number {
  if (!codes.length) return 0
  const c = conn()
  let changed = 0
  c.transaction(() => {
    for (const code of codes) {
      changed += c
        .prepare('UPDATE Complaint SET IsDeleted = 0, DeleteTime = NULL WHERE OriginalCode = @code AND IsDeleted = 1')
        .run({ code }).changes
    }
  })
  return changed
}

export function listAttachments(originalCode: string): AttachmentRow[] {
  return conn()
    .prepare('SELECT * FROM ComplaintAttachment WHERE OriginalCode = @code ORDER BY UploadTime DESC')
    .all({ code: originalCode }) as unknown as AttachmentRow[]
}

export function getAttachment(id: number): AttachmentRow | null {
  return (
    (conn().prepare('SELECT * FROM ComplaintAttachment WHERE Id = @id').get({ id }) as unknown as AttachmentRow) ??
    null
  )
}

export function addAttachment(row: Omit<AttachmentRow, 'Id'>): number {
  const info = conn()
    .prepare(
      `INSERT INTO ComplaintAttachment (OriginalCode, FileName, FilePath, FileSize, FileType, UploadTime, Uploader)
       VALUES (@OriginalCode, @FileName, @FilePath, @FileSize, @FileType, @UploadTime, @Uploader)`,
    )
    .run({ ...row })
  return Number(info.lastInsertRowid)
}

export function deleteAttachments(ids: number[]): void {
  if (!ids.length) return
  const c = conn()
  c.transaction(() => {
    for (const id of ids) c.prepare('DELETE FROM ComplaintAttachment WHERE Id = @id').run({ id })
  })
}

export interface StatsOverview {
  xfTotal: number
  xsTotal: number
  pending: number
  processing: number
  completed: number
  archived: number
  overdue: number
  overdueRate: number
  completionRate: number
  reportCount: number
  accusationCount: number
}

export function overviewStats(): StatsOverview {
  const all = conn().prepare('SELECT * FROM Complaint WHERE IsDeleted = 0').all() as unknown as ComplaintRow[]
  const xs = all.filter((r) => r.Category === '0')
  const count = (rows: ComplaintRow[], fn: (r: ComplaintRow) => boolean) => rows.filter(fn).length
  const xsTotal = xs.length
  const completed = count(xs, (r) => r.IsCompleted === 'BJ1001')
  const overdue = count(xs, (r) => r.IsOverdue === 'CQ1001')
  return {
    xfTotal: count(all, (r) => r.Category === '1'),
    xsTotal,
    pending: count(xs, (r) => r.DisposeForm === '0'),
    processing: count(xs, (r) => r.IsCompleted === 'BJ1002'),
    completed,
    archived: count(xs, (r) => r.DisposeForm === '3'),
    overdue,
    overdueRate: xsTotal ? Math.round((overdue / xsTotal) * 10000) / 100 : 0,
    completionRate: xsTotal ? Math.round((completed / xsTotal) * 10000) / 100 : 0,
    reportCount: count(all, (r) => r.ReportForm === 'JB1001'),
    accusationCount: count(all, (r) => r.ReportForm === 'JB1002'),
  }
}

export function monthlyStats(): Array<{
  monthName: string
  count: number
  completedCount: number
  overdueCount: number
  completionRate: number
}> {
  const all = conn().prepare('SELECT * FROM Complaint WHERE IsDeleted = 0').all() as unknown as ComplaintRow[]
  const out: Array<{
    monthName: string
    count: number
    completedCount: number
    overdueCount: number
    completionRate: number
  }> = []
  const base = new Date()
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rows = all.filter((r) => String(r.ReceiveTime ?? '').startsWith(prefix))
    const completedCount = rows.filter((r) => r.IsCompleted === 'BJ1001').length
    out.push({
      monthName: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      count: rows.length,
      completedCount,
      overdueCount: rows.filter((r) => r.IsOverdue === 'CQ1001').length,
      completionRate: rows.length ? Math.round((completedCount / rows.length) * 1000) / 10 : 0,
    })
  }
  return out
}

export function groupStats(field: 'ClueSource' | 'DisposeForm' | 'UndertakeDept') {
  const all = conn().prepare('SELECT * FROM Complaint WHERE IsDeleted = 0').all() as unknown as ComplaintRow[]
  const xs = all.filter((r) => r.Category === '0')
  const map = new Map<string, number>()
  for (const row of xs) {
    const key = String(row[field] ?? '')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  const dict = field === 'ClueSource' ? dictOptions('线索来源') : field === 'DisposeForm' ? dictOptions('处置形态') : []
  const label = (key: string) => dict.find((d) => d.value === key)?.label ?? (key || '未填写')
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      name: label(key),
      count,
      percentage: xs.length ? Math.round((count / xs.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

export function listDictClasses(): DictClassRow[] {
  return conn()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM DictionaryItem i WHERE i.ClassId = c.Id AND i.IsDeleted = 0) AS itemCount
       FROM DictionaryClass c WHERE c.IsDeleted = 0 ORDER BY c.Id`,
    )
    .all() as unknown as DictClassRow[]
}

export function listDictItems(classId: number): DictItemRow[] {
  const rows = conn()
    .prepare('SELECT * FROM DictionaryItem WHERE IsDeleted = 0 AND ClassId = @classId ORDER BY SortOrder, Id')
    .all({ classId }) as unknown as DictItemRow[]
  return buildDictTree(rows)
}

function buildDictTree(rows: DictItemRow[]): DictItemRow[] {
  const map = new Map<number, DictItemRow>()
  for (const row of rows) map.set(row.Id, { ...row, children: [] })
  const roots: DictItemRow[] = []
  for (const row of map.values()) {
    const parent = row.ParentId ? map.get(row.ParentId) : undefined
    if (parent) parent.children!.push(row)
    else roots.push(row)
  }
  for (const row of map.values()) if (!row.children?.length) delete row.children
  return roots
}

export function dictOptions(className: string): Array<{ label: string; value: string }> {
  const rows = conn()
    .prepare(
      `SELECT i.Id, i.ParentId, i.ItemValue AS ItemValue, i.ItemKey AS ItemKey
       FROM DictionaryItem i JOIN DictionaryClass c ON c.Id = i.ClassId
       WHERE c.ClassName = @className AND i.IsDeleted = 0 AND c.IsDeleted = 0 ORDER BY i.SortOrder, i.Id`,
    )
    .all({ className }) as unknown as Array<{ Id: number; ParentId: number | null; ItemKey: string; ItemValue: string }>
  const childrenOf = new Map<number, typeof rows>()
  const roots: typeof rows = []
  for (const row of rows) {
    if (!row.ParentId) {
      roots.push(row)
      continue
    }
    const list = childrenOf.get(row.ParentId) ?? []
    list.push(row)
    childrenOf.set(row.ParentId, list)
  }
  const flat: Array<{ label: string; value: string }> = []
  for (const root of roots) {
    flat.push({ label: root.ItemValue, value: root.ItemKey })
    for (const child of childrenOf.get(root.Id) ?? []) {
      flat.push({ label: `　${child.ItemValue}`, value: child.ItemKey })
    }
  }
  return flat
}

export function dictLabelMap(className: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const item of dictOptions(className)) map[item.value] = item.label
  return map
}

export function saveDictClass(input: { id?: number; className: string; description: string }): number {
  const c = conn()
  const time = now()
  if (input.id) {
    c.prepare('UPDATE DictionaryClass SET ClassName = @className, Description = @description, UpdateTime = @time WHERE Id = @id').run(
      { id: input.id, className: input.className, description: input.description, time },
    )
    return input.id
  }
  const info = c
    .prepare('INSERT INTO DictionaryClass (ClassName, Description, CreateTime, UpdateTime) VALUES (@className, @description, @time, @time)')
    .run({ className: input.className, description: input.description, time })
  return Number(info.lastInsertRowid)
}

export function deleteDictClass(id: number): void {
  const c = conn()
  c.transaction(() => {
    c.prepare('UPDATE DictionaryItem SET IsDeleted = 1, DeleteTime = @time WHERE ClassId = @id').run({ id, time: now() })
    c.prepare('UPDATE DictionaryClass SET IsDeleted = 1, DeleteTime = @time WHERE Id = @id').run({ id, time: now() })
  })
}

export function saveDictItem(input: {
  id?: number
  classId: number
  parentId: number | null
  itemKey: string
  itemValue: string
  sortOrder: number
  description: string
}): number {
  const c = conn()
  const time = now()
  if (input.id) {
    c.prepare(
      `UPDATE DictionaryItem SET ParentId = @parentId, ItemKey = @itemKey, ItemValue = @itemValue,
       SortOrder = @sortOrder, Description = @description, UpdateTime = @time WHERE Id = @id`,
    ).run({ ...input, time })
    return input.id
  }
  const info = c
    .prepare(
      `INSERT INTO DictionaryItem (ClassId, ParentId, ItemKey, ItemValue, SortOrder, Description, CreateTime, UpdateTime)
       VALUES (@classId, @parentId, @itemKey, @itemValue, @sortOrder, @description, @time, @time)`,
    )
    .run({ ...input, time })
  return Number(info.lastInsertRowid)
}

export function deleteDictItem(id: number): void {
  const c = conn()
  c.transaction(() => {
    const time = now()
    c.prepare('UPDATE DictionaryItem SET IsDeleted = 1, DeleteTime = @time WHERE ParentId = @id').run({ id, time })
    c.prepare('UPDATE DictionaryItem SET IsDeleted = 1, DeleteTime = @time WHERE Id = @id').run({ id, time })
  })
}

export function getDictItem(id: number): DictItemRow | null {
  const row = conn().prepare('SELECT * FROM DictionaryItem WHERE Id = @id AND IsDeleted = 0').get({ id }) as unknown as DictItemRow
  return row ?? null
}

export interface LogFilter {
  keyword?: string
  module?: string
  type?: string
  user?: string
  page?: number
  pageSize?: number
}

export function addLog(entry: {
  userName: string
  userRealName: string
  userRole: string
  operationType: string
  operationModule: string
  operationContent: string
  targetId?: string
  targetName?: string
  ipAddress?: string
  remark?: string
}): void {
  conn()
    .prepare(
      `INSERT INTO OperationLog (UserName, UserRealName, UserRole, OperationType, OperationModule,
        OperationContent, TargetId, TargetName, IPAddress, OperationTime, Remark)
       VALUES (@userName, @userRealName, @userRole, @operationType, @operationModule,
        @operationContent, @targetId, @targetName, @ipAddress, @time, @remark)`,
    )
    .run({
      ...entry,
      targetId: entry.targetId ?? '',
      targetName: entry.targetName ?? '',
      ipAddress: entry.ipAddress ?? '127.0.0.1',
      remark: entry.remark ?? '',
      time: now(),
    })
}

function buildLogWhere(filter: LogFilter): { where: string; params: Record<string, string> } {
  const clauses: string[] = []
  const params: Record<string, string> = {}
  if (filter.module) {
    clauses.push('OperationModule = @module')
    params.module = filter.module
  }
  if (filter.type) {
    clauses.push('OperationType = @type')
    params.type = filter.type
  }
  if (filter.user) {
    clauses.push('(UserName LIKE @user OR UserRealName LIKE @user)')
    params.user = `%${filter.user}%`
  }
  const keyword = filter.keyword?.trim()
  if (keyword) {
    clauses.push('(OperationContent LIKE @kw OR TargetName LIKE @kw OR TargetId LIKE @kw)')
    params.kw = `%${keyword}%`
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params }
}

export function logsForExport(filter: LogFilter): LogRow[] {
  const { where, params } = buildLogWhere(filter)
  return conn()
    .prepare(`SELECT * FROM OperationLog ${where} ORDER BY OperationTime DESC, Id DESC`)
    .all(params) as unknown as LogRow[]
}

export function listLogs(filter: LogFilter): { rows: LogRow[]; total: number } {
  const { where, params } = buildLogWhere(filter)
  const pageSize = Math.max(1, Math.min(200, filter.pageSize ?? 20))
  const page = Math.max(1, filter.page ?? 1)
  const total = (
    conn().prepare(`SELECT COUNT(*) AS n FROM OperationLog ${where}`).get(params) as { n: number }
  ).n
  const rows = conn()
    .prepare(`SELECT * FROM OperationLog ${where} ORDER BY OperationTime DESC, Id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize }) as unknown as LogRow[]
  return { rows, total }
}

export function logFacets(): { modules: string[]; types: string[] } {
  const c = conn()
  const modules = (c.prepare('SELECT DISTINCT OperationModule AS v FROM OperationLog ORDER BY v').all() as Array<{ v: string }>).map((r) => r.v)
  const types = (c.prepare('SELECT DISTINCT OperationType AS v FROM OperationLog ORDER BY v').all() as Array<{ v: string }>).map((r) => r.v)
  return { modules, types }
}

export function copyAttachmentTo(source: string, targetDir: string): string {
  const stamp = now().replace(/[-: ]/g, '')
  const rand = Math.random().toString(16).slice(2, 10)
  const ext = path.extname(source) || ''
  const dest = path.join(targetDir, `${stamp}_${rand}${ext}`)
  fs.copyFileSync(source, dest)
  return dest
}
