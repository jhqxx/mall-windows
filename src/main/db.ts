import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
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
  isOverdue?: string
  reportForm?: string
  isCompleted?: string
  disposeForm?: string
  keyword?: string
  tab?: string
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
  ItemKey: string
  ItemValue: string
  SortOrder: number
  Description: string | null
  CreateTime: string
  UpdateTime: string
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
    paths = {
      userData,
      dbFile: path.join(userData, 'petition.db'),
      attachmentsDir: path.join(userData, 'Attachments'),
    }
  }
  return paths
}

export function initDb(): void {
  const p = getPaths()
  fs.mkdirSync(p.attachmentsDir, { recursive: true })
  db = openDatabase(p.dbFile)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  createSchema(db)
  try {
    seedIfEmpty(db)
  } catch (error) {
    console.error('[db] 种子数据导入失败：', error)
  }
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
  const row = conn()
    .prepare(
      'SELECT * FROM Users WHERE Username = @username AND Password = @password AND IsActive = 1',
    )
    .get({ username, password }) as unknown as UserRow | undefined
  return row ?? null
}

export function getUserById(id: number): UserRow | null {
  return (conn().prepare('SELECT * FROM Users WHERE Id = @id').get({ id }) as unknown as UserRow) ?? null
}

export function touchLogin(id: number, ip: string): void {
  conn()
    .prepare('UPDATE Users SET LastLoginTime = @time, LastLoginIP = @ip WHERE Id = @id')
    .run({ id, time: now(), ip })
}

export function listUsers(): UserRow[] {
  return conn()
    .prepare('SELECT * FROM Users ORDER BY Id')
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
      params.password = input.password
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
      password: input.password ?? '',
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
  conn().prepare('DELETE FROM Users WHERE Id = @id').run({ id })
}

export function changePassword(id: number, password: string): void {
  conn().prepare('UPDATE Users SET Password = @password WHERE Id = @id').run({ id, password })
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
  const tab = filter.tab && TAB_CLAUSES[filter.tab]
  if (tab) clauses.push(tab.sql)
  if (filter.category) {
    clauses.push('Category = @category')
    params.category = filter.category
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

export function listComplaints(filter: ComplaintFilter): { rows: ComplaintRow[]; total: number } {
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
  return { rows, total }
}

export function complaintsForExport(codes?: string[]): ComplaintRow[] {
  if (codes?.length) {
    const params: Record<string, string> = {}
    const holes = codes.map((code, index) => {
      params[`c${index}`] = code
      return `@c${index}`
    })
    return conn()
      .prepare(`SELECT * FROM Complaint WHERE OriginalCode IN (${holes.join(',')}) ORDER BY ReceiveTime DESC, Id DESC`)
      .all(params) as unknown as ComplaintRow[]
  }
  return conn()
    .prepare('SELECT * FROM Complaint ORDER BY ReceiveTime DESC, Id DESC')
    .all() as unknown as ComplaintRow[]
}

export function tabCounts(): Record<string, number> {
  const c = conn()
  const pick = (sql: string) => (c.prepare(sql).get() as { n: number }).n
  return {
    all: pick('SELECT COUNT(*) AS n FROM Complaint'),
    real: pick("SELECT COUNT(*) AS n FROM Complaint WHERE ReportForm = 'JB1001'"),
    anonymous: pick("SELECT COUNT(*) AS n FROM Complaint WHERE ReportForm = 'JB1002'"),
    processing: pick("SELECT COUNT(*) AS n FROM Complaint WHERE IsCompleted = 'BJ1002'"),
    completed: pick("SELECT COUNT(*) AS n FROM Complaint WHERE IsCompleted = 'BJ1001'"),
    overdue: pick("SELECT COUNT(*) AS n FROM Complaint WHERE IsOverdue = 'CQ1001'"),
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
  data.CreateTime = isNew ? time : ((input.CreateTime as string) ?? time)
  data.UpdateTime = time
  const columns = Object.keys(data)
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
  c.transaction(() => {
    for (const code of codes) {
      c.prepare('DELETE FROM ComplaintAttachment WHERE OriginalCode = @code').run({ code })
      c.prepare('DELETE FROM Complaint WHERE OriginalCode = @code').run({ code })
    }
  })
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
  const all = conn().prepare('SELECT * FROM Complaint').all() as unknown as ComplaintRow[]
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
  const all = conn().prepare('SELECT * FROM Complaint').all() as unknown as ComplaintRow[]
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
  const all = conn().prepare('SELECT * FROM Complaint').all() as unknown as ComplaintRow[]
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
      `SELECT c.*, (SELECT COUNT(*) FROM DictionaryItem i WHERE i.ClassId = c.Id) AS itemCount
       FROM DictionaryClass c ORDER BY c.Id`,
    )
    .all() as unknown as DictClassRow[]
}

export function listDictItems(classId: number): DictItemRow[] {
  return conn()
    .prepare('SELECT * FROM DictionaryItem WHERE ClassId = @classId ORDER BY SortOrder, Id')
    .all({ classId }) as unknown as DictItemRow[]
}

export function dictOptions(className: string): Array<{ label: string; value: string }> {
  return conn()
    .prepare(
      `SELECT i.ItemValue AS label, i.ItemKey AS value
       FROM DictionaryItem i JOIN DictionaryClass c ON c.Id = i.ClassId
       WHERE c.ClassName = @className ORDER BY i.SortOrder, i.Id`,
    )
    .all({ className }) as Array<{ label: string; value: string }>
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
    c.prepare('DELETE FROM DictionaryItem WHERE ClassId = @id').run({ id })
    c.prepare('DELETE FROM DictionaryClass WHERE Id = @id').run({ id })
  })
}

export function saveDictItem(input: {
  id?: number
  classId: number
  itemKey: string
  itemValue: string
  sortOrder: number
  description: string
}): number {
  const c = conn()
  const time = now()
  if (input.id) {
    c.prepare(
      `UPDATE DictionaryItem SET ItemKey = @itemKey, ItemValue = @itemValue, SortOrder = @sortOrder,
       Description = @description, UpdateTime = @time WHERE Id = @id`,
    ).run({ ...input, time })
    return input.id
  }
  const info = c
    .prepare(
      `INSERT INTO DictionaryItem (ClassId, ItemKey, ItemValue, SortOrder, Description, CreateTime, UpdateTime)
       VALUES (@classId, @itemKey, @itemValue, @sortOrder, @description, @time, @time)`,
    )
    .run({ ...input, time })
  return Number(info.lastInsertRowid)
}

export function deleteDictItem(id: number): void {
  conn().prepare('DELETE FROM DictionaryItem WHERE Id = @id').run({ id })
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
