<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">{{ isClue ? '线索管理' : '信访管理' }}</h1>
        <p class="page-subtitle">
          共 {{ total }} 条记录，当前第 {{ page }} 页
          <span v-if="!isClue && filter.clue" class="scope-chip">
            仅看线索 {{ filter.clue }}
            <el-button link type="primary" size="small" @click="clearClueScope">取消</el-button>
          </span>
        </p>
      </div>
      <div class="head-actions">
        <el-button v-if="!filter.deleted" type="primary" :icon="Plus" @click="openNew">
          {{ isClue ? '新增线索' : '登记信访件' }}
        </el-button>
        <el-button v-if="!filter.deleted" :icon="Edit" :disabled="selection.length !== 1" @click="openEdit(selection[0])">
          编辑
        </el-button>
        <el-button v-if="!filter.deleted" :icon="Delete" :disabled="!selection.length" @click="removeSelected">
          批量删除
        </el-button>
        <el-button :icon="RefreshLeft" @click="toggleRecycle">
          {{ filter.deleted ? '返回列表' : '回收站' }}
        </el-button>
        <el-button v-if="filter.deleted" :icon="RefreshRight" :disabled="!selection.length" @click="restoreSelected">
          恢复选中
        </el-button>
        <el-dropdown v-if="!filter.deleted" trigger="click" @command="onExport">
          <el-button :icon="Download">
            导出<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="selected" :disabled="!selection.length">导出选中（{{ selection.length }} 条）</el-dropdown-item>
              <el-dropdown-item command="all">导出全部（{{ total }} 条）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-if="!isClue && !filter.deleted" :icon="Upload" @click="importExcel">导入 Excel</el-button>
        <el-button v-if="!filter.deleted" :icon="Printer" @click="printList">打印台账</el-button>
      </div>
    </header>

    <section class="filters">
      <el-select v-if="!isClue" v-model="filter.parent" placeholder="线索归属" clearable class="w-140" @change="reload">
        <el-option label="未归并" value="none" />
        <el-option label="已归并" value="any" />
      </el-select>
      <el-select v-model="filter.disposeForm" placeholder="处置形态" clearable class="w-160" @change="reload">
        <el-option v-for="item in disposeOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-if="!isClue" v-model="filter.reportForm" placeholder="举报形式" clearable class="w-140" @change="reload">
        <el-option label="实名" value="JB1001" />
        <el-option label="匿名" value="JB1002" />
      </el-select>
      <el-select v-model="filter.isCompleted" placeholder="是否办结" clearable class="w-130" @change="reload">
        <el-option label="是" value="BJ1001" />
        <el-option label="否" value="BJ1002" />
      </el-select>
      <el-input
        v-model="filter.keyword"
        placeholder="编号 / 姓名 / 问题摘要 / 主办人"
        clearable
        class="w-260"
        @keyup.enter="reload"
      />
      <el-button :icon="Search" @click="reload">搜索</el-button>
      <el-button :icon="RefreshLeft" @click="reset">重置</el-button>
    </section>

    <el-tabs v-if="!filter.deleted" v-model="filter.tab" class="tabs" @tab-change="reload">
      <el-tab-pane :label="`全部 (${tabs.all ?? 0})`" name="all" />
      <el-tab-pane v-if="!isClue" :label="`实名举报 (${tabs.real ?? 0})`" name="real" />
      <el-tab-pane v-if="!isClue" :label="`匿名举报 (${tabs.anonymous ?? 0})`" name="anonymous" />
      <el-tab-pane :label="`办理中 (${tabs.processing ?? 0})`" name="processing" />
      <el-tab-pane :label="`已办结 (${tabs.completed ?? 0})`" name="completed" />
      <el-tab-pane :label="`已超期 (${tabs.overdue ?? 0})`" name="overdue" />
    </el-tabs>

    <div ref="tableWrap" class="table-wrap">
      <el-table
      :data="rows"
      border
      stripe
      :height="tableHeight"
      row-key="OriginalCode"
      @selection-change="onSelectionChange"
      @row-dblclick="openDetail"
    >
      <el-table-column type="selection" width="46" fixed="left" />
      <el-table-column prop="OriginalCode" label="原始编号" width="118" class-name="cell-mono" fixed="left" />
      <el-table-column v-if="!isClue" label="所属线索" width="120" class-name="cell-mono">
        <template #default="{ row }">
          <el-button v-if="row.ParentCode" link type="primary" @click="focusClue(row.ParentCode)">
            {{ row.ParentCode }}
          </el-button>
          <span v-else class="muted">未归并</span>
        </template>
      </el-table-column>
      <el-table-column label="被反映对象" width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.TargetType === 'ORG' ? row.OrganizationName || '—' : row.TargetName || '—' }}</span>
          <span class="cell-sub">{{ targetTypeLabel(row.TargetType) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="ProblemSummary" label="问题摘要" min-width="160" show-overflow-tooltip />
      <el-table-column label="线索来源" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ labelOf(clueLabelMap, row.ClueSource) }}</template>
      </el-table-column>
      <el-table-column v-if="isClue" label="信访件" width="78">
        <template #default="{ row }">
          <el-button
            v-if="childCounts[row.OriginalCode]"
            link
            type="primary"
            @click="focusLetters(row.OriginalCode)"
          >
            {{ childCounts[row.OriginalCode] }}
          </el-button>
          <span v-else class="muted">0</span>
        </template>
      </el-table-column>
      <el-table-column prop="MainHandler" label="主办人" width="78" />
      <el-table-column label="状态" width="132">
        <template #default="{ row }">
          <span class="pill" :class="row.IsCompleted === 'BJ1001' ? 'pill-done' : 'pill-processing'">
            {{ row.IsCompleted === 'BJ1001' ? '已办结' : '办理中' }}
          </span>
          <span v-if="row.IsOverdue === 'CQ1001'" class="pill pill-overdue" style="margin-left: 0.25rem">超期</span>
        </template>
      </el-table-column>
      <el-table-column label="接收时间" width="150" class-name="cell-mono">
        <template #default="{ row }">{{ shortTime(row.ReceiveTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" :width="isClue ? 120 : 156" fixed="right" class-name="cell-actions">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
          <template v-if="filter.deleted">
            <el-button link @click="restoreRow(row)">恢复</el-button>
          </template>
          <template v-else>
            <el-button link @click="openEdit(row)">编辑</el-button>
            <el-button v-if="!isClue" link @click="openAssign(row)">归并</el-button>
          </template>
        </template>
      </el-table-column>
      <template #empty>
        <div class="empty">{{ filter.deleted ? '回收站为空' : '暂无记录' }}</div>
      </template>
    </el-table>
    </div>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="load"
        @size-change="reload"
      />
    </div>

    <el-drawer v-model="detailVisible" :title="isClue ? '线索详情' : '信访详情'" size="46%">
      <template #header>
        <div class="drawer-head">
          <span class="drawer-title">{{ isClue ? '线索详情' : '信访详情' }}</span>
          <el-button v-if="detail" size="small" :icon="Printer" @click="printOne">打印</el-button>
        </div>
      </template>
      <div v-if="detail" class="detail">
        <section v-if="!isClue && detail.ParentCode" class="linked">
          <h3>所属线索</h3>
          <p class="linked-row">
            <el-button link type="primary" class="mono" @click="openLinked(detail.ParentCode, 'clue')">
              {{ detail.ParentCode }}
            </el-button>
            <span class="linked-hint">点编号查看线索详情</span>
          </p>
        </section>

        <section v-if="isClue" class="linked">
          <h3>关联信访件（{{ related.length }}）</h3>
          <el-table v-if="related.length" :data="related" border size="small" class="related-table">
            <el-table-column prop="OriginalCode" label="原始编号" width="118" class-name="cell-mono" />
            <el-table-column prop="TargetName" label="被反映人" min-width="110" show-overflow-tooltip />
            <el-table-column prop="ProblemSummary" label="问题摘要" min-width="150" show-overflow-tooltip />
            <el-table-column label="状态" width="92">
              <template #default="{ row }">
                <span class="pill" :class="statusClass(row)">
                  {{ row.IsCompleted === 'BJ1001' ? '已办结' : '办理中' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ row }">
                <el-button link type="primary" @click="openLinked(row.OriginalCode, 'letter')">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
          <p v-else class="linked-hint">这条线索下还没有归并的信访件</p>
        </section>

        <section v-for="group in detailGroups" :key="group.title">
          <h3>{{ group.title }}</h3>
          <dl>
            <template v-for="field in group.fields" :key="field.label">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value || '—' }}</dd>
            </template>
          </dl>
        </section>
      </div>
    </el-drawer>

    <el-drawer v-model="linkedVisible" :title="linkedTitle" size="46%" append-to-body>
      <div v-if="linked" class="detail">
        <section v-if="linkedKind === 'letter' && linked.ParentCode" class="linked">
          <h3>所属线索</h3>
          <p class="linked-row">
            <el-button link type="primary" class="mono" @click="openLinked(linked.ParentCode, 'clue')">
              {{ linked.ParentCode }}
            </el-button>
            <span class="linked-hint">点编号查看线索详情</span>
          </p>
        </section>
        <section v-if="linkedKind === 'clue'" class="linked">
          <h3>关联信访件（{{ related.length }}）</h3>
          <p v-if="!related.length" class="linked-hint">这条线索下还没有归并的信访件</p>
        </section>
        <section v-for="group in linkedGroups" :key="group.title">
          <h3>{{ group.title }}</h3>
          <dl>
            <template v-for="field in group.fields" :key="field.label">
              <dt>{{ field.label }}</dt>
              <dd>{{ field.value || '—' }}</dd>
            </template>
          </dl>
        </section>
      </div>
    </el-drawer>

    <el-dialog v-model="assignVisible" title="归并到线索" width="32rem">
      <p class="assign-hint">已选 {{ assignCodes.length }} 件信访件。选择一条问题线索作为主单。</p>
      <el-select v-model="assignClue" filterable clearable placeholder="搜索编号 / 被反映人 / 摘要" class="assign-select">
        <el-option v-for="item in clueChoices" :key="item.code" :label="`${item.code} · ${item.name}`" :value="item.code">
          <span class="mono">{{ item.code }}</span>
          <span class="assign-summary">{{ item.name }} {{ item.summary ? '· ' + item.summary : '' }}</span>
        </el-option>
      </el-select>
      <template #footer>
        <el-button @click="assignVisible = false">取消</el-button>
        <el-button :disabled="!assignClue" type="primary" @click="confirmAssign">归并</el-button>
        <el-button @click="detachAssign">移出线索</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Delete, Download, Edit, Plus, Printer, RefreshLeft, RefreshRight, Search, Upload } from '@element-plus/icons-vue'

type Row = Record<string, any>

const router = useRouter()
const route = useRoute()
const isClue = computed(() => route.meta.kind === 'clue')
const rows = ref<Row[]>([])
const childCounts = ref<Record<string, number>>({})
const clueChoices = ref<Array<{ code: string; name: string; summary: string }>>([])
const assignVisible = ref(false)
const assignCodes = ref<string[]>([])
const assignClue = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const tabs = ref<Record<string, number>>({})
const selection = ref<Row[]>([])
const disposeOptions = ref<Array<{ label: string; value: string }>>([])
const disposeLabelMap = ref<Record<string, string>>({})
const tableWrap = ref<HTMLElement | null>(null)
const tableHeight = ref(420)
let wrapObserver: ResizeObserver | null = null

function measureTable(): void {
  const el = tableWrap.value
  if (!el) return
  tableHeight.value = Math.max(240, Math.round(el.clientHeight))
}

onMounted(() => {
  measureTable()
  if (tableWrap.value) {
    wrapObserver = new ResizeObserver(measureTable)
    wrapObserver.observe(tableWrap.value)
  }
})

onUnmounted(() => {
  wrapObserver?.disconnect()
  wrapObserver = null
})

const detailVisible = ref(false)
const linkedVisible = ref(false)
const linked = ref<Record<string, any> | null>(null)
const linkedKind = ref<'clue' | 'letter'>('clue')
const related = ref<Array<Record<string, any>>>([])
const linkedTitle = computed(() => (linkedKind.value === 'clue' ? '线索详情' : '信访详情'))
const detail = ref<Row | null>(null)

const filter = reactive({
  deleted: false,
  tab: 'all',
  parent: '',
  clue: '',
  disposeForm: '',
  reportForm: '',
  isCompleted: '',
  keyword: '',
})

const categoryOptions = ref<Array<{ label: string; value: string }>>([])
const categoryMap = ref<Record<string, string>>({ '0': '问题线索', '1': '信访件' })
const targetTypeMap = ref<Record<string, string>>({ ORG: '单位', IND: '个人' })
const reportFormMap: Record<string, string> = { JB1001: '实名', JB1002: '匿名' }
const clueLabelMap = ref<Record<string, string>>({})
const dictMaps = ref<Record<string, Record<string, string>>>({})
const dictLabel = (className: string, value: unknown) => {
  if (value == null || value === '') return ''
  const map = dictMaps.value[className]
  return map?.[String(value)] ?? String(value)
}

const categoryLabel = (v: string) => categoryMap.value[v] ?? v ?? '—'
const targetTypeLabel = (v: string) => targetTypeMap.value[v] ?? v ?? '—'
const reportFormLabel = (v: string) => reportFormMap[v] ?? v ?? '—'
const labelOf = (map: Record<string, string>, v: string) => map[v] ?? v ?? '—'

function buildGroups(row: Record<string, any>) {
  const group = (title: string, fields: Array<[string, any]>) => ({
    title,
    fields: fields.map(([label, value]) => ({ label, value: value == null ? '' : String(value) })),
  })
  return [
    group('编号信息', [
      ['原始编号', row.OriginalCode],
      ['线索编号', row.NewCode],
      ['类别编号', row.CategoryCode],
    ]),
    group('基本信息', [
      ['信访类别', categoryLabel(row.Category)],
      ['线索来源', dictLabel('线索来源', row.ClueSource)],
      ['接收时间', shortTime(row.ReceiveTime)],
    ]),
    group('被反映人', [
      ['类型', targetTypeLabel(row.TargetType)],
      ['姓名', row.TargetName],
      ['性别', dictLabel('性别', row.Gender)],
      ['单位职务', row.TargetPost],
      ['职级', dictLabel('职位层级', row.TargetRank)],
      ['政治面貌', dictLabel('政治面貌', row.PoliticalStatus)],
      ['单位名称', row.OrganizationName],
      ['联系方式', row.ContactPhone],
      ['联系地址', row.ContactAddress],
    ]),
    group('信访内容', [
      ['举报形式', reportFormLabel(row.ReportForm)],
      ['举报人', row.ReportName],
      ['联系电话', row.ReportPhone],
      ['问题摘要', row.ProblemSummary],
    ]),
    group('分办信息', [
      ['分办时间', row.AssignTime],
      ['分办部室', row.AssignDept],
      ['承办部室', row.UndertakeDept],
      ['承办形式', dictLabel('承办形式', row.UndertakeForm)],
    ]),
    group('处置信息', [
      ['处置时间', row.DisposeTime],
      ['处置方式', dictLabel('处置方式', row.DisposeMethod)],
      ['应办结时间', row.Deadline],
      ['处置进度', row.DisposeProgress],
    ]),
    group('处置结果', [
      ['处置形态', labelOf(disposeLabelMap.value, row.DisposeForm)],
      ['处置结果', dictLabel('处置（核实）结果', row.DisposeResult)],
      ['是否办结', row.IsCompleted === 'BJ1001' ? '是' : '否'],
      ['办结时间', row.CompleteTime],
    ]),
    group('其他', [
      ['是否超期', row.IsOverdue === 'CQ1001' ? '是' : '否'],
      ['超期原因', row.OverdueReason],
      ['主办人', row.MainHandler],
      ['协办人', row.AssistantHandler],
      ['审核人', row.AuditHandler],
      ['领导签批', dictLabel('领导签批', row.LeaderApproval)],
      ['签批情况', dictLabel('签批情况', row.ApprovalStatus)],
      ['实名反馈', row.RealNameReport],
      ['备注', row.Remark],
    ]),
  ]
}

const detailGroups = computed(() => buildGroups(detail.value ?? {}))
const linkedGroups = computed(() => buildGroups(linked.value ?? {}))

async function load(): Promise<void> {
  const res = await window.api.complaints.list({
    ...filter,
    category: isClue.value ? '0' : '1',
    page: page.value,
    pageSize: pageSize.value,
  })
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '加载失败')
    return
  }
  rows.value = res.data.rows
  total.value = res.data.total
  tabs.value = res.data.tabs
  childCounts.value = res.data.childCounts ?? {}
}

function reload(): void {
  page.value = 1
  load()
}

function reset(): void {
  filter.tab = 'all'
  filter.parent = ''
  filter.disposeForm = ''
  filter.reportForm = ''
  filter.isCompleted = ''
  filter.keyword = ''
  page.value = 1
  load()
}

function onSelectionChange(list: Row[]): void {
  selection.value = list
}

function openNew(): void {
  const base = isClue.value ? '/clues/new' : '/complaints/new'
  router.push(filter.clue && !isClue.value ? `${base}?clue=${encodeURIComponent(filter.clue)}` : base)
}

function openEdit(row: Row): void {
  if (!row) return
  const base = isClue.value ? '/clues' : '/complaints'
  router.push(`${base}/${encodeURIComponent(row.OriginalCode)}/edit`)
}

function focusLetters(clueCode: string): void {
  router.push({ path: '/complaints', query: { clue: clueCode } })
}

function focusClue(clueCode: string): void {
  router.push({ path: '/clues', query: { code: clueCode } })
}

function clearClueScope(): void {
  filter.clue = ''
  router.replace('/complaints')
  reload()
}

async function openAssign(row: Row): Promise<void> {
  assignCodes.value = row ? [String(row.OriginalCode)] : selection.value.map((item) => String(item.OriginalCode))
  if (!assignCodes.value.length) return
  if (!clueChoices.value.length) {
    const res = await window.api.complaints.clueOptions()
    if (res?.ok) clueChoices.value = res.data
  }
  assignClue.value = (row?.ParentCode as string) ?? ''
  assignVisible.value = true
}

async function confirmAssign(): Promise<void> {
  const res = await window.api.complaints.assign({ codes: assignCodes.value, clueCode: assignClue.value })
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '归并失败')
    return
  }
  ElMessage.success(`已归并 ${res.data} 件信访件`)
  assignVisible.value = false
  load()
}

async function detachAssign(): Promise<void> {
  const res = await window.api.complaints.assign({ codes: assignCodes.value, clueCode: null })
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '移出失败')
    return
  }
  ElMessage.success(`已移出 ${res.data} 件信访件`)
  assignVisible.value = false
  load()
}

async function openDetail(row: Row): Promise<void> {
  const res = await window.api.complaints.get(row.OriginalCode)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '加载详情失败')
    return
  }
  detail.value = res.data
  related.value = []
  detailVisible.value = true
  if (isClue.value) {
    const letters = await window.api.complaints.letters(res.data.OriginalCode)
    if (letters?.ok) related.value = letters.data
  }
}

function statusClass(row: Record<string, any>): string {
  if (row.IsCompleted === 'BJ1001') return 'pill-done'
  if (row.IsOverdue === 'CQ1001') return 'pill-overdue'
  return 'pill-processing'
}

async function openLinked(code: string, kind: 'clue' | 'letter'): Promise<void> {
  const res = await window.api.complaints.get(code)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '加载失败')
    return
  }
  linkedKind.value = kind
  linked.value = res.data
  linkedVisible.value = true
}

function onExport(command: string): void {
  if (command === 'selected') exportRows()
  else exportAll()
}

async function importExcel(): Promise<void> {
  const res = await window.api.complaints.importExcel()
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '导入失败')
    return
  }
  const data = res.data as { imported: number; skipped: number; failed: number; canceled: boolean; errors?: string[] }
  if (data.canceled) return
  if (data.errors?.length) ElMessage.warning(data.errors.join('；'))
  ElMessage.success(`导入完成：新增 ${data.imported} 条，跳过重复 ${data.skipped} 条，失败 ${data.failed} 条`)
  await load()
}

async function printList(): Promise<void> {
  const res = await window.api.complaints.printList({ ...filter })
  if (!res?.ok) ElMessage.error(res?.error ?? '无法打开打印预览')
}

async function printOne(): Promise<void> {
  if (!detail.value) return
  const res = await window.api.complaints.print(String(detail.value.OriginalCode))
  if (!res?.ok) ElMessage.error(res?.error ?? '无法打开打印预览')
}

async function exportRows(): Promise<void> {
  if (!selection.value.length) return
  const res = await window.api.exports.complaints(selection.value.map((row) => row.OriginalCode))
  notifyExport(res)
}

async function exportAll(): Promise<void> {
  const res = await window.api.exports.complaints({ category: isClue.value ? '0' : '1' })
  notifyExport(res)
}

function notifyExport(res: { ok: boolean; data?: string | null; error?: string }): void {
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '导出失败')
    return
  }
  ElMessage.success(res.data ? `已导出到 ${res.data}` : '已取消导出')
}

function toggleRecycle(): void {
  filter.deleted = !filter.deleted
  selection.value = []
  page.value = 1
  load()
}

async function restoreSelected(): Promise<void> {
  const codes = selection.value.map((row) => row.OriginalCode)
  try {
    await ElMessageBox.confirm(`恢复 ${codes.length} 条记录？`, '从回收站恢复', { type: 'warning' })
  } catch {
    return
  }
  const res = await window.api.complaints.restore(codes)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '恢复失败')
    return
  }
  ElMessage.success(`已恢复 ${res.data} 条`)
  selection.value = []
  load()
}

async function restoreRow(row: { OriginalCode: string }): Promise<void> {
  const res = await window.api.complaints.restore([row.OriginalCode])
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '恢复失败')
    return
  }
  ElMessage.success('已恢复')
  load()
}

async function removeSelected(): Promise<void> {
  const codes = selection.value.map((row) => row.OriginalCode as string)
  if (!codes.length) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${codes.length} 条记录吗？删除后不可恢复。`, '确认删除', {
      type: 'warning',
    })
  } catch {
    return
  }
  const res = await window.api.complaints.remove(codes)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '删除失败')
    return
  }
  ElMessage.success('删除成功')
  load()
}

function shortTime(value: string | null): string {
  if (!value) return '—'
  return String(value).slice(0, 19)
}

watch(
  () => route.fullPath,
  () => {
    filter.clue = typeof route.query.clue === 'string' ? route.query.clue : ''
    filter.tab = 'all'
    page.value = 1
    load()
  },
)

onMounted(async () => {
  const classes = ['线索来源', '职位层级', '政治面貌', '性别', '承办形式', '处置方式', '处置（核实）结果', '领导签批', '签批情况', '分办部室或片区', '承办部室或片区']
  const [dispose, disposeLabels, category, categoryLabels, targetTypes, clueLabels, ...labelSets] = await Promise.all([
    window.api.dict.options('处置形态'),
    window.api.dict.labels('处置形态'),
    window.api.dict.options('信访类别'),
    window.api.dict.labels('信访类别'),
    window.api.dict.labels('被反映人类型'),
    window.api.dict.labels('线索来源'),
    ...classes.map((name) => window.api.dict.labels(name)),
  ])
  const maps: Record<string, Record<string, string>> = {}
  classes.forEach((name, index) => {
    const res = labelSets[index]
    if (res?.ok) maps[name] = res.data
  })
  dictMaps.value = maps
  if (dispose?.ok) disposeOptions.value = dispose.data
  if (disposeLabels?.ok) disposeLabelMap.value = disposeLabels.data
  if (category?.ok) categoryOptions.value = category.data
  if (categoryLabels?.ok && Object.keys(categoryLabels.data).length) categoryMap.value = categoryLabels.data
  if (targetTypes?.ok && Object.keys(targetTypes.data).length) targetTypeMap.value = targetTypes.data
  if (clueLabels?.ok) clueLabelMap.value = clueLabels.data
  filter.clue = typeof route.query.clue === 'string' ? route.query.clue : ''
  load()
})
</script>

<style scoped>
.linked {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 0.75rem;
}

.linked-row {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.linked-hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--ink-3);
}

.related-table {
  margin-top: 0.5rem;
}

.page {
  padding: 1.5rem 1.75rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  min-height: calc(100vh - 3.25rem);
}

.table-wrap {
  flex: 1 1 auto;
  min-height: 0;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  color: var(--ink);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.w-130 { width: 8.125rem; }
.w-140 { width: 8.75rem; }
.w-160 { width: 10rem; }
.w-260 { width: 16.25rem; }

.tabs {
  margin-bottom: -0.5rem;
}

.pager {
  display: flex;
  justify-content: flex-end;
}

.empty {
  color: var(--ink-3);
  font-size: 0.875rem;
  padding: 1rem 0;
}

.muted {
  color: var(--ink-3);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail h3 {
  margin: 0 0 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ink);
  border-left: 2px solid var(--harbor);
  padding-left: 0.5rem;
}

.detail dl {
  margin: 0;
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.detail dt {
  color: var(--ink-3);
}

.detail dd {
  margin: 0;
  color: var(--ink);
  word-break: break-word;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-right: 1rem;
}

.drawer-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
}
.scope-chip {
  margin-left: 0.5rem;
  padding: 0.0625rem 0.375rem;
  border: 1px solid var(--rule-2);
  border-radius: 0.25rem;
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--ink-2);
}

.assign-hint {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.assign-select {
  width: 100%;
}

.assign-summary {
  margin-left: 0.5rem;
  color: var(--ink-3);
  font-size: 0.8125rem;
}

.cell-sub {
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  color: var(--ink-3);
  white-space: nowrap;
}

:deep(.cell-actions .cell) {
  white-space: nowrap;
}

:deep(.el-table__row .cell) {
  line-height: 1.4;
}
</style>
