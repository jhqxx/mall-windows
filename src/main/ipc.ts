import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  addAttachments,
  addLog,
  allLogs,
  checkPassword,
  copyAttachmentTo,
  createCase,
  createSession,
  deleteAttachments,
  deleteCase,
  deleteSession,
  findUser,
  findUserByToken,
  getAttachments,
  getCase,
  getPaths,
  initRememberFilePath,
  listAttachments,
  listCases,
  listLogs,
  stats,
  toSessionUser,
  type CaseInput,
  type SessionUser
} from './db'

let currentUser: SessionUser | null = null
let currentToken: string | null = null

function requireUser(): SessionUser {
  if (!currentUser) throw new Error('未登录')
  return currentUser
}

function rememberFile(): string {
  return initRememberFilePath()
}

// 系统钥匙串可用时用 safeStorage 加密；不可用时（如无钥匙串的沙箱/CI）降级为明文令牌，
// 文件权限固定 600，且只保存一个随机会话令牌，不含密码。
const PLAIN_PREFIX = 'PLAIN:'

function saveRemember(token: string): void {
  try {
    const file = rememberFile()
    if (safeStorage.isEncryptionAvailable()) {
      fs.writeFileSync(file, safeStorage.encryptString(token), { mode: 0o600 })
    } else {
      fs.writeFileSync(file, PLAIN_PREFIX + token, { mode: 0o600 })
    }
  } catch (err) {
    console.error('[remember] save failed', err)
  }
}

function clearRemember(): void {
  try {
    if (fs.existsSync(rememberFile())) fs.unlinkSync(rememberFile())
  } catch {
    /* ignore */
  }
}

function readRemember(): string | null {
  try {
    const file = rememberFile()
    if (!fs.existsSync(file)) return null
    const buf = fs.readFileSync(file)
    const text = buf.toString('utf8')
    if (text.startsWith(PLAIN_PREFIX)) return text.slice(PLAIN_PREFIX.length)
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(buf)
  } catch (err) {
    console.error('[remember] read failed', err)
    return null
  }
}

const ACTION_LABELS: Record<string, string> = {
  login: '登录成功',
  login_failed: '登录失败',
  auto_login: '自动登录',
  logout: '退出登录',
  create_case: '新增案件',
  delete_case: '删除案件',
  upload_attachment: '上传附件',
  delete_attachment: '删除附件',
  export_csv: '导出日志'
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {

  ipcMain.handle('auth:auto', () => {
    const token = readRemember()
    if (!token) return { ok: false }
    const row = findUserByToken(token)
    if (!row) {
      clearRemember()
      return { ok: false }
    }
    const user = toSessionUser(row)
    currentUser = user
    currentToken = token
    addLog({ userId: user.id, username: user.username, action: 'auto_login', detail: '记住我自动登录' })
    return { ok: true, user }
  })

  ipcMain.handle('auth:login', (_event, payload: { username: string; password: string; remember: boolean }) => {
    const username = String(payload?.username ?? '').trim()
    const password = String(payload?.password ?? '')
    const user = findUser(username)
    if (!user || !checkPassword(user, password)) {
      addLog({
        username: username || null,
        action: 'login_failed',
        result: 'failed',
        detail: user ? '密码错误' : '用户不存在'
      })
      return { ok: false, message: '用户名或密码错误' }
    }
    const su = toSessionUser(user)
    currentUser = su
    currentToken = createSession(user.id)
    addLog({ userId: su.id, username: su.username, action: 'login', detail: '登录成功' })
    if (payload?.remember) saveRemember(currentToken)
    else clearRemember()
    return { ok: true, user: su }
  })

  ipcMain.handle('auth:logout', () => {
    const user = currentUser
    if (currentToken) {
      deleteSession(currentToken)
      addLog({ userId: user?.id ?? null, username: user?.username ?? null, action: 'logout', detail: '退出登录' })
    }
    currentUser = null
    currentToken = null
    clearRemember()
    return { ok: true }
  })

  ipcMain.handle('auth:current', () => (currentUser ? { ok: true, user: currentUser } : { ok: false }))

  ipcMain.handle('case:create', (_event, payload: { input: CaseInput; attachmentIds: number[] }) => {
    try {
      const user = requireUser()
      const row = createCase(payload.input, user, payload.attachmentIds ?? [])
      addLog({
        userId: user.id,
        username: user.username,
        action: 'create_case',
        targetType: 'case',
        targetId: row.id,
        detail: `案件编号 ${row.case_no}，类型 ${row.case_type}，附件 ${payload.attachmentIds?.length ?? 0} 个`
      })
      return { ok: true, data: row }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle('case:list', (_event, payload: { page: number; pageSize: number; keyword?: string }) => {
    const { rows, total } = listCases({
      page: Math.max(1, payload?.page ?? 1),
      pageSize: Math.min(100, Math.max(1, payload?.pageSize ?? 10)),
      keyword: payload?.keyword
    })
    return { ok: true, rows, total }
  })

  ipcMain.handle('case:get', (_event, payload: { id: number }) => {
    const row = getCase(payload?.id)
    if (!row) return { ok: false, message: '案件不存在' }
    return { ok: true, data: row, attachments: listAttachments(row.id) }
  })

  ipcMain.handle('case:delete', (_event, payload: { id: number }) => {
    try {
      const user = requireUser()
      const row = deleteCase(payload?.id)
      if (!row) return { ok: false, message: '案件不存在' }
      addLog({
        userId: user.id,
        username: user.username,
        action: 'delete_case',
        targetType: 'case',
        targetId: row.id,
        detail: `删除案件 ${row.case_no}`
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  const uploadPaths = (paths: string[]): { ok: boolean; rows: any[]; message?: string } => {
    try {
      const user = requireUser()
      const rows = addAttachments(paths, user.username)
      if (rows.length) {
        addLog({
          userId: user.id,
          username: user.username,
          action: 'upload_attachment',
          targetType: 'attachment',
          targetId: rows.map((r) => r.id).join(','),
          detail: `上传 ${rows.length} 个附件：${rows.map((r) => r.file_name).join('、')}`
        })
      }
      return { ok: true, rows }
    } catch (err) {
      return { ok: false, message: (err as Error).message, rows: [] }
    }
  }

  ipcMain.handle('attachment:pick', async () => {
    try {
      requireUser()
      const win = getWindow()
      const result = win
        ? await dialog.showOpenDialog(win, { title: '选择附件', properties: ['openFile', 'multiSelections'] })
        : await dialog.showOpenDialog({ title: '选择附件', properties: ['openFile', 'multiSelections'] })
      if (result.canceled || !result.filePaths.length) return { ok: true, rows: [] }
      return uploadPaths(result.filePaths)
    } catch (err) {
      return { ok: false, message: (err as Error).message, rows: [] }
    }
  })

  // 仅用于自动化验收（MALL_TEST_HOOKS=1 时注册），走与原生选择框完全相同的上传逻辑
  if (process.env['MALL_TEST_HOOKS'] === '1') {
    ipcMain.handle('test:addAttachments', (_event, payload: { paths: string[] }) =>
      uploadPaths(payload?.paths ?? [])
    )
  }

  ipcMain.handle('attachment:pending', () => {
    try {
      const user = requireUser()
      return { ok: true, rows: listAttachments(null), operator: user.username }
    } catch (err) {
      return { ok: false, message: (err as Error).message, rows: [] }
    }
  })

  ipcMain.handle('attachment:delete', (_event, payload: { ids: number[]; pending?: boolean }) => {
    try {
      const user = requireUser()
      const rows = deleteAttachments(payload?.ids ?? [])
      if (rows.length) {
        addLog({
          userId: user.id,
          username: user.username,
          action: 'delete_attachment',
          targetType: 'attachment',
          targetId: rows.map((r) => r.id).join(','),
          detail: `删除 ${rows.length} 个附件：${rows.map((r) => r.file_name).join('、')}`
        })
      }
      return { ok: true, count: rows.length }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle('attachment:download', async (_event, payload: { ids: number[] }) => {
    try {
      const user = requireUser()
      const rows = getAttachments(payload?.ids ?? [])
      if (!rows.length) return { ok: false, message: '请先选择附件' }
      const win = getWindow()
      const opts = { title: '选择保存目录', properties: ['openDirectory', 'createDirectory'] as const }
      const result = win ? await dialog.showOpenDialog(win, opts as any) : await dialog.showOpenDialog(opts as any)
      if (result.canceled || !result.filePaths.length) return { ok: false, message: '已取消' }
      const dir = result.filePaths[0]
      let count = 0
      for (const row of rows) {
        try {
          copyAttachmentTo(row, dir)
          count += 1
        } catch (err) {
          console.error('[attachment] download failed', row.file_name, err)
        }
      }
      addLog({
        userId: user.id,
        username: user.username,
        action: 'download_attachment',
        targetType: 'attachment',
        targetId: rows.map((r) => r.id).join(','),
        detail: `导出 ${count} 个附件到 ${dir}`
      })
      return { ok: true, count, dir }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle(
    'log:list',
    (_event, payload: { page: number; pageSize: number; action?: string; keyword?: string }) => {
      const { rows, total } = listLogs({
        page: Math.max(1, payload?.page ?? 1),
        pageSize: Math.min(200, Math.max(1, payload?.pageSize ?? 10)),
        action: payload?.action,
        keyword: payload?.keyword
      })
      return { ok: true, rows, total }
    }
  )

  ipcMain.handle('log:actions', () => {
    const rows = allLogs().map((r) => r.action)
    const unique = Array.from(new Set(rows))
    return { ok: true, actions: unique.map((a) => ({ value: a, label: ACTION_LABELS[a] ?? a })) }
  })

  ipcMain.handle('log:export', async () => {
    try {
      const user = requireUser()
      const win = getWindow()
      const day = new Date()
      const stamp = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(
        day.getDate()
      ).padStart(2, '0')}`
      const opts = { title: '导出操作日志', defaultPath: `操作日志-${stamp}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] }
      const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (result.canceled || !result.filePath) return { ok: false, message: '已取消' }
      const rows = allLogs()
      const header = ['时间', '用户', '动作', '对象类型', '对象ID', '详情', '机器名', '结果'].map(csvCell).join(',')
      const lines = rows.map((r) =>
        [r.created_at, r.username, ACTION_LABELS[r.action] ?? r.action, r.target_type, r.target_id, r.detail, r.machine, r.result === 'failed' ? '失败' : '成功']
          .map(csvCell)
          .join(',')
      )
      fs.writeFileSync(result.filePath, '\uFEFF' + [header, ...lines].join('\r\n'), 'utf8')
      addLog({
        userId: user.id,
        username: user.username,
        action: 'export_csv',
        targetType: 'log',
        detail: `导出 ${rows.length} 条日志到 ${result.filePath}`
      })
      return { ok: true, count: rows.length, path: result.filePath }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle('app:stats', () => ({ ok: true, ...stats(), paths: getPaths() }))
  ipcMain.handle('app:meta', () => ({
    ok: true,
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    node: process.versions.node
  }))
}
