import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface AppSettings {
  /** 数据库文件绝对路径，留空表示使用 userData/petition.db */
  dbPath: string
  /** 附件目录绝对路径，留空表示使用 userData/Attachments */
  attachmentsDir: string
}

const FILE_NAME = 'settings.json'

function file(): string {
  return path.join(app.getPath('userData'), FILE_NAME)
}

export function defaults(): AppSettings {
  const base = app.getPath('userData')
  return { dbPath: path.join(base, 'petition.db'), attachmentsDir: path.join(base, 'Attachments') }
}

export function readSettings(): AppSettings {
  const fallback = defaults()
  try {
    const raw = fs.readFileSync(file(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      dbPath: parsed.dbPath?.trim() ? parsed.dbPath : fallback.dbPath,
      attachmentsDir: parsed.attachmentsDir?.trim() ? parsed.attachmentsDir : fallback.attachmentsDir,
    }
  } catch {
    return fallback
  }
}

export function writeSettings(next: AppSettings): AppSettings {
  const normalized: AppSettings = {
    dbPath: next.dbPath.trim() || defaults().dbPath,
    attachmentsDir: next.attachmentsDir.trim() || defaults().attachmentsDir,
  }
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(file(), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

/** 目标数据库不存在时，把当前库整份复制过去（含 WAL 中的已提交数据） */
export function copyDatabase(from: string, to: string): boolean {
  if (!fs.existsSync(from) || fs.existsSync(to)) return false
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  return true
}
