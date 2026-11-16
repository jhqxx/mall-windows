import * as XLSX from 'xlsx'
import {
  complaintsForExport,
  dictLabelMap,
  logsForExport,
  monthlyStats,
  groupStats,
  overviewStats,
  type ComplaintRow,
  type LogFilter,
  type LogRow,
} from './db'

type Row = Record<string, string | number | null | undefined>

function toSheet(rows: Row[], header?: string[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows, header ? { header } : undefined)
}

function workbook(sheets: Array<{ name: string; rows: Row[]; header?: string[] }>): Buffer {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, toSheet(sheet.rows, sheet.header), sheet.name.slice(0, 31))
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function shortTime(value: unknown): string {
  return value === null || value === undefined || value === '' ? '' : String(value).slice(0, 19)
}

/** 把存储键翻译成显示值；找不到时保留原值 */
function translator(): (className: string, value: unknown) => string {
  const maps: Record<string, Record<string, string>> = {
    信访类别: dictLabelMap('信访类别'),
    线索来源: dictLabelMap('线索来源'),
    举报形式: dictLabelMap('举报形式'),
    性别: dictLabelMap('性别'),
    职位层级: dictLabelMap('职位层级'),
    政治面貌: dictLabelMap('政治面貌'),
    承办形式: dictLabelMap('承办形式'),
    处置方式: dictLabelMap('处置方式'),
    处置形态: dictLabelMap('处置形态'),
    处置结果: dictLabelMap('处置（核实）结果'),
    是否办结: dictLabelMap('是否办结'),
    是否超期: dictLabelMap('是否超期'),
    领导签批: dictLabelMap('领导签批'),
    签批情况: dictLabelMap('签批情况'),
    被反映人类型: { ORG: '单位', IND: '个人' },
  }
  return (className, value) => {
    if (value === null || value === undefined || value === '') return ''
    const key = String(value)
    return maps[className]?.[key] ?? key
  }
}

/** 部室多选：存储为逗号拼接的键值，导出翻译成名称 */
function joinDepts(className: string, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const map = dictLabelMap(className)
  const text = String(raw)
  return text
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => map[key] ?? key)
    .join('、')
}

export function buildComplaintWorkbook(codes?: string[]): Buffer {
  const translate = translator()
  const rows = complaintsForExport(codes).map((row: ComplaintRow) => ({
    原始编号: row.OriginalCode,
    线索编号: row.NewCode,
    信访编号: row.CategoryCode,
    信访类别: translate('信访类别', row.Category),
    线索来源: translate('线索来源', row.ClueSource),
    接收时间: shortTime(row.ReceiveTime),
    被反映人类型: translate('被反映人类型', row.TargetType),
    姓名: row.TargetName,
    单位名称: row.OrganizationName,
    法定代表人: row.LegalPerson,
    性别: translate('性别', row.Gender),
    职级: translate('职位层级', row.TargetRank),
    政治面貌: translate('政治面貌', row.PoliticalStatus),
    出生年月: shortTime(row.BirthDate),
    单位职务: row.TargetPost,
    工作经历: row.WorkExperience,
    联系方式: row.ContactPhone,
    联系地址: row.ContactAddress,
    举报形式: translate('举报形式', row.ReportForm),
    举报人: row.ReportName,
    举报电话: row.ReportPhone,
    反映问题摘要: row.ProblemSummary,
    分办时间: shortTime(row.AssignTime),
    分办部室: joinDepts('分办部室或片区', row.AssignDept),
    承办形式: translate('承办形式', row.UndertakeForm),
    承办部室: joinDepts('承办部室或片区', row.UndertakeDept),
    处置时间: shortTime(row.DisposeTime),
    处置方式: translate('处置方式', row.DisposeMethod),
    应办结时间: shortTime(row.Deadline),
    处置进度情况: row.DisposeProgress,
    办理情况: row.HandleStatus,
    处置形态: translate('处置形态', row.DisposeForm),
    处置结果: translate('处置结果', row.DisposeResult),
    是否办结: translate('是否办结', row.IsCompleted),
    办结时间: shortTime(row.CompleteTime),
    是否超期: translate('是否超期', row.IsOverdue),
    超期原因: row.OverdueReason,
    主办人: row.MainHandler,
    协办人: row.AssistantHandler,
    审核人: row.AuditHandler,
    领导签批: translate('领导签批', row.LeaderApproval),
    签批情况: translate('签批情况', row.ApprovalStatus),
    实名举报反馈情况: row.RealNameReport,
    备注: row.Remark,
    创建时间: shortTime(row.CreateTime),
    更新时间: shortTime(row.UpdateTime),
  }))
  return workbook([{ name: '信访数据', rows }])
}

export function buildLogWorkbook(filter: LogFilter): Buffer {
  const rows = logsForExport(filter).map((row: LogRow) => ({
    操作时间: shortTime(row.OperationTime),
    操作人: row.UserRealName || row.UserName,
    账号: row.UserName,
    角色: row.UserRole === 'Admin' ? '管理员' : '普通用户',
    操作类型: row.OperationType,
    操作模块: row.OperationModule,
    操作内容: row.OperationContent,
    操作对象: row.TargetName,
    对象编号: row.TargetId,
    IP地址: row.IPAddress,
    备注: row.Remark,
  }))
  return workbook([{ name: '操作日志', rows }])
}

export function buildStatsWorkbook(): Buffer {
  const overview = overviewStats()
  const summary = Object.entries({
    问题线索总数: overview.xsTotal,
    信访件总数: overview.xfTotal,
    实名举报: overview.reportCount,
    匿名举报: overview.accusationCount,
    已办结: overview.completed,
    办理中: overview.processing,
    已超期: overview.overdue,
    办结率: `${overview.completionRate}%`,
  }).map(([指标, 数值]) => ({ 指标, 数值 }))
  const monthly = monthlyStats().map((row) => ({
    月份: row.monthName,
    接收数量: row.count,
    已办结: row.completedCount,
    已超期: row.overdueCount,
    办结率: `${row.completionRate}%`,
  }))
  const source = groupStats('ClueSource').map((row) => ({ 线索来源: row.name, 数量: row.count, 占比: `${row.percentage}%` }))
  const form = groupStats('DisposeForm').map((row) => ({ 处置形态: row.name, 数量: row.count, 占比: `${row.percentage}%` }))
  const dept = groupStats('UndertakeDept').map((row) => ({ 承办部室: row.name, 数量: row.count }))
  return workbook([
    { name: '总体统计', rows: summary },
    { name: '月度趋势', rows: monthly },
    { name: '线索来源', rows: source },
    { name: '处置形态', rows: form },
    { name: '承办部室', rows: dept },
  ])
}
