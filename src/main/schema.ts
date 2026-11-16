import type { SqliteHandle } from './sqlite-driver'
import { hashPassword } from './password'
import seed from './seed/petition-seed.json'

export const TABLE_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS Users (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Username TEXT NOT NULL UNIQUE,
    Password TEXT NOT NULL,
    RealName TEXT,
    Role TEXT DEFAULT 'User',
    Department TEXT,
    Email TEXT,
    Phone TEXT,
    IsActive INTEGER DEFAULT 1,
    CreateTime DATETIME NOT NULL,
    LastLoginTime DATETIME,
    LastLoginIP TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS Complaint (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    OriginalCode TEXT UNIQUE,
    NewCode TEXT,
    CategoryCode TEXT,
    Category TEXT,
    ParentCode TEXT,
    ClueSource TEXT,
    ReceiveTime DATETIME NOT NULL,
    TargetType TEXT,
    TargetName TEXT,
    BirthDate DATETIME,
    Gender TEXT,
    WorkExperience TEXT,
    OrganizationName TEXT,
    LegalPerson TEXT,
    ContactPhone TEXT,
    ContactAddress TEXT,
    TargetPost TEXT,
    TargetRank TEXT,
    PoliticalStatus TEXT,
    ProblemSummary TEXT,
    ReportForm TEXT,
    ReportName TEXT,
    ReportPhone TEXT,
    AssignTime DATETIME,
    AssignDept TEXT,
    UndertakeDept TEXT,
    UndertakeForm TEXT,
    DisposeTime DATETIME,
    DisposeMethod TEXT,
    Deadline DATETIME,
    DisposeProgress TEXT,
    HandleStatus TEXT,
    DisposeForm TEXT,
    DisposeResult TEXT,
    IsCompleted TEXT,
    CompleteTime DATETIME,
    IsOverdue TEXT,
    OverdueReason TEXT,
    MainHandler TEXT,
    AssistantHandler TEXT,
    AuditHandler TEXT,
    LeaderApproval TEXT,
    ApprovalStatus TEXT,
    RealNameReport TEXT,
    Remark TEXT,
    CreateTime DATETIME NOT NULL,
    UpdateTime DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ComplaintAttachment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    OriginalCode TEXT NOT NULL,
    FileName TEXT NOT NULL,
    FilePath TEXT NOT NULL,
    FileSize INTEGER,
    FileType TEXT,
    UploadTime DATETIME NOT NULL,
    Uploader TEXT,
    FOREIGN KEY(OriginalCode) REFERENCES Complaint(OriginalCode) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS DictionaryClass (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ClassName TEXT NOT NULL UNIQUE,
    Description TEXT,
    CreateTime DATETIME NOT NULL,
    UpdateTime DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS DictionaryItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ClassId INTEGER NOT NULL,
    ItemKey TEXT NOT NULL,
    ItemValue TEXT NOT NULL,
    SortOrder INTEGER DEFAULT 0,
    Description TEXT,
    CreateTime DATETIME NOT NULL,
    UpdateTime DATETIME NOT NULL,
    FOREIGN KEY(ClassId) REFERENCES DictionaryClass(Id),
    UNIQUE(ClassId, ItemKey)
  )`,
  `CREATE TABLE IF NOT EXISTS OperationLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserName TEXT NOT NULL,
    UserRealName TEXT,
    UserRole TEXT,
    OperationType TEXT NOT NULL,
    OperationModule TEXT NOT NULL,
    OperationContent TEXT,
    TargetId TEXT,
    TargetName TEXT,
    IPAddress TEXT,
    OperationTime DATETIME NOT NULL,
    Remark TEXT
  )`,
]

export const COMPLAINT_COLUMNS = [
  'OriginalCode',
  'NewCode',
  'CategoryCode',
  'Category',
  'ClueSource',
  'ReceiveTime',
  'TargetType',
  'TargetName',
  'BirthDate',
  'Gender',
  'WorkExperience',
  'OrganizationName',
  'LegalPerson',
  'ContactPhone',
  'ContactAddress',
  'TargetPost',
  'TargetRank',
  'PoliticalStatus',
  'ProblemSummary',
  'ReportForm',
  'ReportName',
  'ReportPhone',
  'AssignTime',
  'AssignDept',
  'UndertakeDept',
  'UndertakeForm',
  'DisposeTime',
  'DisposeMethod',
  'Deadline',
  'DisposeProgress',
  'HandleStatus',
  'DisposeForm',
  'DisposeResult',
  'IsCompleted',
  'CompleteTime',
  'IsOverdue',
  'OverdueReason',
  'MainHandler',
  'AssistantHandler',
  'AuditHandler',
  'LeaderApproval',
  'ApprovalStatus',
  'RealNameReport',
  'Remark',
  'CreateTime',
  'UpdateTime',
] as const

type SeedRow = Record<string, unknown>

const INSERT_ORDER = [
  ['Users', seed.users],
  ['DictionaryClass', seed.dictClasses],
  ['DictionaryItem', seed.dictItems],
  ['Complaint', seed.complaints],
  ['ComplaintAttachment', seed.attachments],
  ['OperationLog', seed.logs],
] as const

export function createSchema(conn: SqliteHandle): void {
  for (const ddl of TABLE_DDL) conn.exec(ddl)
}

export function countRows(conn: SqliteHandle, table: string): number {
  const row = conn.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }
  return row.n
}

export function seedIfEmpty(conn: SqliteHandle): void {
  if (countRows(conn, 'Users') > 0) return
  // 原库存在 2 条指向不存在案件的附件（OriginalCode='asda'），灌种子时关掉外键以原样保留
  conn.pragma('foreign_keys = OFF')
  try {
    conn.transaction(() => {
      for (const [table, rows] of INSERT_ORDER) {
        for (const row of rows as SeedRow[]) {
          const data = table === 'Users' ? { ...row, Password: hashPassword(String(row.Password ?? '')) } : row
          insertRow(conn, table, data)
        }
      }
    })
  } finally {
    conn.pragma('foreign_keys = ON')
  }
}

function insertRow(conn: SqliteHandle, table: string, row: SeedRow): void {
  const cols = Object.keys(row)
  const sql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols
    .map((c) => `@${c}`)
    .join(', ')})`
  conn.prepare(sql).run(row)
}
