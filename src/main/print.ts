import {
  dictLabelMap,
  getComplaint,
  listComplaints,
  type ComplaintFilter,
  type ComplaintRow,
} from './db'

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const text = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '—' : esc(String(value).slice(0, 19))

function tr(className: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const map = dictLabelMap(className)
  return esc(map[String(value)] ?? String(value))
}

function depts(className: string, raw: unknown): string {
  if (!raw) return '—'
  const map = dictLabelMap(className)
  return esc(
    String(raw)
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
      .map((key) => map[key] ?? key)
      .join('、'),
  )
}

const targetType = (value: unknown): string =>
  value === 'ORG' ? '单位' : value === 'IND' ? '个人' : '—'

function frame(title: string, body: string, extraHead = ''): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 10.5pt;
    color: #14212e;
    background: #f2f6fb;
  }
  .toolbar {
    position: sticky; top: 0; z-index: 9;
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 10px 16px; background: #ffffff; border-bottom: 1px solid #dce7f1;
  }
  .toolbar button {
    font: inherit; padding: 6px 16px; border-radius: 4px; cursor: pointer;
    border: 1px solid #1f6fb2; background: #1f6fb2; color: #fff;
  }
  .toolbar button.ghost { background: #fff; color: #1f6fb2; }
  .sheet {
    width: 210mm; min-height: 297mm; margin: 16px auto; padding: 14mm;
    background: #fff; box-shadow: 0 6px 24px rgba(16, 22, 29, .08);
  }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 2mm; letter-spacing: .08em; }
  .org { text-align: center; font-size: 9pt; color: #5a6b7c; letter-spacing: .12em; margin-bottom: 6mm; }
  h2 { font-size: 10.5pt; margin: 5mm 0 2mm; padding-left: 2mm; border-left: 2.5pt solid #1f6fb2; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: .6pt solid #c2d4e4; padding: 1.6mm 2mm; vertical-align: top; font-size: 9.5pt; }
  th { background: #f2f7fc; font-weight: 500; text-align: left; width: 24mm; white-space: nowrap; }
  td.wide { width: auto; }
  .foot { margin-top: 8mm; display: flex; justify-content: space-between; font-size: 8.5pt; color: #5a6b7c; }
  .list th { width: auto; }
  .list td { font-size: 8.5pt; }
  .list td.nowrap { white-space: nowrap; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  }
${extraHead}
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">打印</button>
  <button class="ghost" onclick="window.close()">关闭</button>
</div>
${body}
</body>
</html>`
}

function sheetComplaint(row: ComplaintRow): string {
  const code = String(row.OriginalCode ?? '')
  const rows = (pairs: Array<[string, string]>): string => {
    const filled = pairs.filter(([, value]) => value !== '—')
    const list = filled.length ? filled : pairs.slice(0, 1)
    return list
      .map(
        ([label, value]) =>
          `<tr><th>${esc(label)}</th><td class="wide">${value}</td></tr>`,
      )
      .join('')
  }

  return `<section class="sheet">
  <h1>信访（问题线索）登记表</h1>
  <div class="org">连云港港口控股集团审查调查工作平台</div>

  <h2>基本信息</h2>
  <table>
    ${rows([
      ['原始编号', esc(code)],
      ['线索编号', text(row.NewCode)],
      ['信访编号', text(row.CategoryCode)],
      ['信访类别', tr('信访类别', row.Category)],
      ['线索来源', tr('线索来源', row.ClueSource)],
      ['接收时间', text(row.ReceiveTime)],
    ])}
  </table>

  <h2>被反映对象</h2>
  <table>
    ${rows([
      ['对象类型', targetType(row.TargetType)],
      ['姓名', text(row.TargetName)],
      ['单位名称', text(row.OrganizationName)],
      ['法定代表人', text(row.LegalPerson)],
      ['性别', tr('性别', row.Gender)],
      ['职级', tr('职位层级', row.TargetRank)],
      ['政治面貌', tr('政治面貌', row.PoliticalStatus)],
      ['出生年月', text(row.BirthDate)],
      ['单位职务', text(row.TargetPost)],
      ['联系方式', text(row.ContactPhone)],
      ['联系地址', text(row.ContactAddress)],
    ])}
  </table>

  <h2>信访内容</h2>
  <table>
    ${rows([
      ['举报形式', tr('举报形式', row.ReportForm)],
      ['举报人', text(row.ReportName)],
      ['举报电话', text(row.ReportPhone)],
      ['反映问题摘要', text(row.ProblemSummary)],
    ])}
  </table>

  <h2>办理情况</h2>
  <table>
    ${rows([
      ['分办时间', text(row.AssignTime)],
      ['分办部室', depts('分办部室或片区', row.AssignDept)],
      ['承办形式', tr('承办形式', row.UndertakeForm)],
      ['承办部室', depts('承办部室或片区', row.UndertakeDept)],
      ['处置时间', text(row.DisposeTime)],
      ['处置方式', tr('处置方式', row.DisposeMethod)],
      ['应办结时间', text(row.Deadline)],
      ['处置形态', tr('处置形态', row.DisposeForm)],
      ['处置结果', tr('处置结果', row.DisposeResult)],
      ['是否办结', tr('是否办结', row.IsCompleted)],
      ['办结时间', text(row.CompleteTime)],
      ['是否超期', tr('是否超期', row.IsOverdue)],
      ['超期原因', text(row.OverdueReason)],
    ])}
  </table>

  <h2>办案与签批</h2>
  <table>
    ${rows([
      ['主办人', text(row.MainHandler)],
      ['协办人', text(row.AssistantHandler)],
      ['审核人', text(row.AuditHandler)],
      ['领导签批', tr('领导签批', row.LeaderApproval)],
      ['签批情况', tr('签批情况', row.ApprovalStatus)],
      ['实名举报反馈', text(row.RealNameReport)],
      ['备注', text(row.Remark)],
    ])}
  </table>

  <div class="foot">
    <span>编号 ${esc(code)}</span>
    <span>打印时间 ${esc(new Date().toLocaleString('zh-CN'))}</span>
  </div>
</section>`
}

export function complaintPrintHtml(code: string): string {
  const row = getComplaint(code)
  if (!row) throw new Error(`未找到编号为 ${code} 的信访记录`)
  return frame(`信访登记表 ${code}`, sheetComplaint(row))
}

export function listPrintHtml(filter: ComplaintFilter): string {
  const { rows } = listComplaints({ ...filter, page: 1, pageSize: 200 })
  const body = rows
    .map(
      (row, index) => `<tr>
      <td>${index + 1}</td>
      <td>${esc(row.OriginalCode)}</td>
      <td>${tr('信访类别', row.Category)}</td>
      <td>${text(row.TargetName) === '—' ? esc(row.OrganizationName ?? '—') : text(row.TargetName)}</td>
      <td>${tr('线索来源', row.ClueSource)}</td>
      <td>${tr('举报形式', row.ReportForm)}</td>
      <td>${tr('处置形态', row.DisposeForm)}</td>
      <td>${tr('是否办结', row.IsCompleted)}</td>
      <td>${text(row.MainHandler)}</td>
      <td class="nowrap">${text(row.ReceiveTime)}</td>
    </tr>`,
    )
    .join('')

  return frame(
    '信访台账',
    `<section class="sheet">
  <h1>信访（问题线索）台账</h1>
  <div class="org">连云港港口控股集团审查调查工作平台</div>
  <table class="list">
    <thead>
      <tr>
        <th>序号</th><th>原始编号</th><th>信访类别</th><th>被反映人/单位</th><th>线索来源</th>
        <th>举报形式</th><th>处置形态</th><th>是否办结</th><th>主办人</th><th>接收时间</th>
      </tr>
    </thead>
    <tbody>${body || '<tr><td colspan="10">没有符合条件的记录</td></tr>'}</tbody>
  </table>
  <div class="foot">
    <span>共 ${rows.length} 条</span>
    <span>打印时间 ${esc(new Date().toLocaleString('zh-CN'))}</span>
  </div>
</section>`,
  )
}
