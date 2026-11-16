import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  addAttachment,
  addLog,
  changePassword,
  copyAttachmentTo,
  deleteAttachments,
  deleteComplaints,
  deleteDictClass,
  deleteDictItem,
  deleteUser,
  dictLabelMap,
  dictOptions,
  getAttachment,
  getComplaint,
  getPaths,
  getUserById,
  listAttachments,
  listComplaints,
  listDictClasses,
  listDictItems,
  listLogs,
  listUsers,
  logFacets,
  nextOriginalCode,
  overviewStats,
  monthlyStats,
  groupStats,
  saveComplaint,
  saveDictClass,
  saveDictItem,
  saveUser,
  findUserByLogin,
  tabCounts,
  toSessionUser,
  touchLogin,
  type ComplaintFilter,
  type SessionUser,
} from './db'

let currentUser: SessionUser | null = null

function requireUser(): SessionUser {
  if (!currentUser) throw new Error('请先登录')
  return currentUser
}

function requireAdmin(): SessionUser {
  const user = requireUser()
  if (user.role !== 'Admin') throw new Error('仅管理员可执行该操作')
  return user
}

function ok<T>(data: T) {
  return { ok: true as const, data }
}

function fail(message: string) {
  return { ok: false as const, error: message }
}

function localIp(): string {
  const nets = os.networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

function userTag(user: SessionUser): string {
  return `${user.realName}(${user.username})`
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('auth:login', (_e, payload: { username: string; password: string }) => {
    const username = payload.username?.trim() ?? ''
    const password = payload.password ?? ''
    if (!username || !password) return fail('请输入用户名和密码')
    const row = findUserByLogin(username, password)
    if (!row) {
      addLog({
        userName: username,
        userRealName: username,
        userRole: '',
        operationType: '登录失败',
        operationModule: '系统登录',
        operationContent: `用户名或密码错误：${username}`,
        ipAddress: localIp(),
      })
      return fail('用户名或密码错误，或该账号已被禁用')
    }
    currentUser = toSessionUser(row)
    touchLogin(row.Id, localIp())
    addLog({
      userName: currentUser.username,
      userRealName: currentUser.realName,
      userRole: currentUser.role,
      operationType: '登录',
      operationModule: '系统登录',
      operationContent: `${userTag(currentUser)} 登录系统`,
      ipAddress: localIp(),
    })
    return ok(currentUser)
  })

  ipcMain.handle('auth:current', () => ok(currentUser))

  ipcMain.handle('auth:logout', () => {
    if (currentUser) {
      addLog({
        userName: currentUser.username,
        userRealName: currentUser.realName,
        userRole: currentUser.role,
        operationType: '退出',
        operationModule: '系统登录',
        operationContent: `${userTag(currentUser)} 退出系统`,
        ipAddress: localIp(),
      })
    }
    currentUser = null
    return ok(true)
  })

  ipcMain.handle('complaint:list', (_e, filter: ComplaintFilter) => {
    requireUser()
    return ok({ ...listComplaints(filter), tabs: tabCounts() })
  })

  ipcMain.handle('complaint:get', (_e, code: string) => {
    requireUser()
    const row = getComplaint(code)
    return row ? ok(row) : fail('信访记录不存在')
  })

  ipcMain.handle('complaint:nextCode', () => {
    requireUser()
    return ok(nextOriginalCode())
  })

  ipcMain.handle('complaint:save', (_e, payload: { isNew: boolean; data: Record<string, string | null> }) => {
    const user = requireUser()
    const data = payload.data
    if (!data.OriginalCode) return fail('原始编号不能为空')
    if (!data.ReceiveTime) return fail('接收时间不能为空')
    try {
      const code = saveComplaint(data, payload.isNew)
      addLog({
        userName: user.username,
        userRealName: user.realName,
        userRole: user.role,
        operationType: payload.isNew ? '新增' : '修改',
        operationModule: '信访管理',
        operationContent: `${payload.isNew ? '新增' : '修改'}信访记录 ${code}`,
        targetId: code,
        targetName: String(data.TargetName ?? ''),
        ipAddress: localIp(),
      })
      return ok(code)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UNIQUE')) return fail('原始编号已存在，请更换编号')
      return fail(message)
    }
  })

  ipcMain.handle('complaint:delete', (_e, codes: string[]) => {
    const user = requireUser()
    if (!codes?.length) return fail('请选择要删除的记录')
    deleteComplaints(codes)
    addLog({
      userName: user.username,
      userRealName: user.realName,
      userRole: user.role,
      operationType: '删除',
      operationModule: '信访管理',
      operationContent: `删除信访记录 ${codes.join('、')}`,
      targetId: codes.join(','),
      ipAddress: localIp(),
    })
    return ok(true)
  })

  ipcMain.handle('dict:classes', () => {
    requireUser()
    return ok(listDictClasses())
  })

  ipcMain.handle('dict:items', (_e, classId: number) => {
    requireUser()
    return ok(listDictItems(classId))
  })

  ipcMain.handle('dict:options', (_e, className: string) => {
    requireUser()
    return ok(dictOptions(className))
  })

  ipcMain.handle('dict:labels', (_e, className: string) => {
    requireUser()
    return ok(dictLabelMap(className))
  })

  ipcMain.handle('dict:class:save', (_e, input: { id?: number; className: string; description: string }) => {
    const user = requireUser()
    if (!input.className?.trim()) return fail('字典名称不能为空')
    try {
      const id = saveDictClass({ ...input, className: input.className.trim() })
      addLog({
        userName: user.username,
        userRealName: user.realName,
        userRole: user.role,
        operationType: input.id ? '修改' : '新增',
        operationModule: '基础字典',
        operationContent: `${input.id ? '修改' : '新增'}字典 ${input.className.trim()}`,
        targetId: String(id),
        ipAddress: localIp(),
      })
      return ok(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('UNIQUE')) return fail('该字典名称已存在')
      return fail(message)
    }
  })

  ipcMain.handle('dict:class:delete', (_e, id: number) => {
    const user = requireUser()
    deleteDictClass(id)
    addLog({
      userName: user.username,
      userRealName: user.realName,
      userRole: user.role,
      operationType: '删除',
      operationModule: '基础字典',
      operationContent: `删除字典 Id=${id}`,
      targetId: String(id),
      ipAddress: localIp(),
    })
    return ok(true)
  })

  ipcMain.handle(
    'dict:item:save',
    (
      _e,
      input: { id?: number; classId: number; itemKey: string; itemValue: string; sortOrder: number; description: string },
    ) => {
      const user = requireUser()
      if (!input.itemKey?.trim()) return fail('键值不能为空')
      if (!input.itemValue?.trim()) return fail('显示值不能为空')
      try {
        const id = saveDictItem({
          ...input,
          itemKey: input.itemKey.trim(),
          itemValue: input.itemValue.trim(),
        })
        addLog({
          userName: user.username,
          userRealName: user.realName,
          userRole: user.role,
          operationType: input.id ? '修改' : '新增',
          operationModule: '基础字典',
          operationContent: `${input.id ? '修改' : '新增'}字典项 ${input.itemValue.trim()}`,
          targetId: String(id),
          ipAddress: localIp(),
        })
        return ok(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('UNIQUE')) return fail('同一字典下已存在相同的键值')
        return fail(message)
      }
    },
  )

  ipcMain.handle('dict:item:delete', (_e, id: number) => {
    requireUser()
    deleteDictItem(id)
    return ok(true)
  })

  ipcMain.handle('attachment:list', (_e, code: string) => {
    requireUser()
    return ok(listAttachments(code))
  })

  ipcMain.handle('attachment:pick', async () => {
    requireUser()
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (result.canceled) return ok([])
    return ok(result.filePaths)
  })

  ipcMain.handle(
    'attachment:add',
    (_e, payload: { code: string; files: Array<{ path: string; name: string; size: number; type: string }> }) => {
      const user = requireUser()
      const dir = getPaths().attachmentsDir
      const stored = payload.files.map((file) => {
        const target = copyAttachmentTo(file.path, dir)
        return {
          OriginalCode: payload.code,
          FileName: file.name,
          FilePath: target,
          FileSize: file.size,
          FileType: file.type,
          UploadTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
          Uploader: userTag(user),
        }
      })
      const ids = stored.map((row) => addAttachment(row))
      if (stored.length) {
        addLog({
          userName: user.username,
          userRealName: user.realName,
          userRole: user.role,
          operationType: '上传附件',
          operationModule: '信访管理',
          operationContent: `为 ${payload.code} 上传 ${stored.length} 个附件`,
          targetId: payload.code,
          ipAddress: localIp(),
        })
      }
      return ok(ids)
    },
  )

  ipcMain.handle('attachment:delete', (_e, ids: number[]) => {
    const user = requireUser()
    const files = ids.map((id) => getAttachment(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))
    deleteAttachments(ids)
    for (const file of files) {
      try {
        if (fs.existsSync(file.FilePath)) fs.unlinkSync(file.FilePath)
      } catch {
        // 附件文件可能已不存在
      }
    }
    addLog({
      userName: user.username,
      userRealName: user.realName,
      userRole: user.role,
      operationType: '删除附件',
      operationModule: '信访管理',
      operationContent: `删除 ${ids.length} 个附件`,
      ipAddress: localIp(),
    })
    return ok(true)
  })

  ipcMain.handle('attachment:download', async (_e, ids: number[]) => {
    requireUser()
    const rows = ids.map((id) => getAttachment(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))
    if (!rows.length) return fail('没有可下载的附件')
    const win = getWindow()
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return ok(0)
    const dir = result.filePaths[0]
    let count = 0
    for (const row of rows) {
      if (!fs.existsSync(row.FilePath)) continue
      let target = path.join(dir, row.FileName)
      if (fs.existsSync(target)) {
        const ext = path.extname(row.FileName)
        target = path.join(dir, `${path.basename(row.FileName, ext)}_${row.Id}${ext}`)
      }
      fs.copyFileSync(row.FilePath, target)
      count += 1
    }
    return ok(count)
  })

  ipcMain.handle('attachment:open', async (_e, id: number) => {
    requireUser()
    const row = getAttachment(id)
    if (!row || !fs.existsSync(row.FilePath)) return fail('文件不存在')
    await shell.openPath(row.FilePath)
    return ok(true)
  })

  ipcMain.handle('users:list', () => {
    requireAdmin()
    return ok(listUsers().map(({ Password: _password, ...rest }) => rest))
  })

  ipcMain.handle(
    'users:save',
    (
      _e,
      input: {
        id?: number
        username: string
        password?: string
        realName: string
        role: string
        department: string
        email: string
        phone: string
        isActive: number
      },
    ) => {
      const admin = requireAdmin()
      if (!input.username?.trim()) return fail('用户名不能为空')
      if (!input.id && !input.password) return fail('新增用户必须设置密码')
      try {
        const id = saveUser({ ...input, username: input.username.trim() })
        addLog({
          userName: admin.username,
          userRealName: admin.realName,
          userRole: admin.role,
          operationType: input.id ? '修改' : '新增',
          operationModule: '用户管理',
          operationContent: `${input.id ? '修改' : '新增'}用户 ${input.username.trim()}`,
          targetId: String(id),
          ipAddress: localIp(),
        })
        return ok(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('UNIQUE')) return fail('用户名已存在')
        return fail(message)
      }
    },
  )

  ipcMain.handle('users:delete', (_e, id: number) => {
    const admin = requireAdmin()
    const target = getUserById(id)
    if (!target) return fail('用户不存在')
    if (target.Username === 'admin') return fail('不能删除管理员账户')
    deleteUser(id)
    addLog({
      userName: admin.username,
      userRealName: admin.realName,
      userRole: admin.role,
      operationType: '删除',
      operationModule: '用户管理',
      operationContent: `删除用户 ${target.Username}`,
      targetId: String(id),
      ipAddress: localIp(),
    })
    return ok(true)
  })

  ipcMain.handle('users:resetPassword', (_e, payload: { id: number; password: string }) => {
    const admin = requireAdmin()
    if (!payload.password) return fail('新密码不能为空')
    changePassword(payload.id, payload.password)
    addLog({
      userName: admin.username,
      userRealName: admin.realName,
      userRole: admin.role,
      operationType: '重置密码',
      operationModule: '用户管理',
      operationContent: `重置用户 Id=${payload.id} 的密码`,
      targetId: String(payload.id),
      ipAddress: localIp(),
    })
    return ok(true)
  })

  ipcMain.handle('logs:list', (_e, filter) => {
    requireAdmin()
    return ok(listLogs(filter))
  })

  ipcMain.handle('logs:facets', () => {
    requireAdmin()
    return ok(logFacets())
  })

  ipcMain.handle('stats:overview', () => {
    requireUser()
    return ok(overviewStats())
  })

  ipcMain.handle('stats:monthly', () => {
    requireUser()
    return ok(monthlyStats())
  })

  ipcMain.handle('stats:groups', (_e, field: 'ClueSource' | 'DisposeForm' | 'UndertakeDept') => {
    requireUser()
    return ok(groupStats(field))
  })

  ipcMain.handle('app:meta', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    driver: 'node:sqlite',
  }))
}

