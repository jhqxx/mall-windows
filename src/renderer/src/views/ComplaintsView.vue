<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">信访管理</h1>
        <p class="page-subtitle">共 {{ total }} 条记录，当前第 {{ page }} 页</p>
      </div>
      <div class="head-actions">
        <el-button type="primary" :icon="Plus" @click="openNew">新增信访</el-button>
        <el-button :icon="Edit" :disabled="selection.length !== 1" @click="openEdit(selection[0])">编辑</el-button>
        <el-button :icon="Delete" :disabled="!selection.length" @click="removeSelected">批量删除</el-button>
      </div>
    </header>

    <section class="filters">
      <el-select v-model="filter.category" placeholder="信访类别" clearable class="w-140" @change="reload">
        <el-option label="问题线索" value="0" />
        <el-option label="信访件" value="1" />
      </el-select>
      <el-select v-model="filter.disposeForm" placeholder="处置形态" clearable class="w-160" @change="reload">
        <el-option v-for="item in disposeOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="filter.reportForm" placeholder="举报形式" clearable class="w-140" @change="reload">
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

    <el-tabs v-model="filter.tab" class="tabs" @tab-change="reload">
      <el-tab-pane :label="`全部 (${tabs.all ?? 0})`" name="all" />
      <el-tab-pane :label="`实名举报 (${tabs.real ?? 0})`" name="real" />
      <el-tab-pane :label="`匿名举报 (${tabs.anonymous ?? 0})`" name="anonymous" />
      <el-tab-pane :label="`办理中 (${tabs.processing ?? 0})`" name="processing" />
      <el-tab-pane :label="`已办结 (${tabs.completed ?? 0})`" name="completed" />
      <el-tab-pane :label="`已超期 (${tabs.overdue ?? 0})`" name="overdue" />
    </el-tabs>

    <el-table
      :data="rows"
      border
      stripe
      height="calc(100vh - 21rem)"
      row-key="OriginalCode"
      @selection-change="onSelectionChange"
      @row-dblclick="openDetail"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column prop="OriginalCode" label="原始编号" width="140" class-name="cell-mono" />
      <el-table-column prop="NewCode" label="新建编号" width="120" class-name="cell-mono" />
      <el-table-column label="信访类别" width="100">
        <template #default="{ row }">{{ categoryLabel(row.Category) }}</template>
      </el-table-column>
      <el-table-column label="被反映类型" width="110">
        <template #default="{ row }">{{ targetTypeLabel(row.TargetType) }}</template>
      </el-table-column>
      <el-table-column prop="TargetName" label="被反映人" width="110" show-overflow-tooltip />
      <el-table-column prop="OrganizationName" label="被反映单位" min-width="130" show-overflow-tooltip />
      <el-table-column prop="ProblemSummary" label="问题摘要" min-width="260" show-overflow-tooltip />
      <el-table-column label="举报形式" width="94">
        <template #default="{ row }">{{ reportFormLabel(row.ReportForm) }}</template>
      </el-table-column>
      <el-table-column label="处置形态" width="110">
        <template #default="{ row }">{{ labelOf(disposeLabelMap, row.DisposeForm) }}</template>
      </el-table-column>
      <el-table-column prop="MainHandler" label="主办人" width="96" />
      <el-table-column prop="AssistantHandler" label="协办人" width="96" />
      <el-table-column label="是否办结" width="94">
        <template #default="{ row }">
          <el-tag :type="row.IsCompleted === 'BJ1001' ? 'success' : 'info'" effect="plain" size="small">
            {{ row.IsCompleted === 'BJ1001' ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否超期" width="94">
        <template #default="{ row }">
          <el-tag v-if="row.IsOverdue === 'CQ1001'" type="danger" effect="plain" size="small">是</el-tag>
          <span v-else class="muted">否</span>
        </template>
      </el-table-column>
      <el-table-column label="接收时间" width="150" class-name="cell-mono">
        <template #default="{ row }">{{ shortTime(row.ReceiveTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="132" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
          <el-button link @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <div class="empty">暂无信访记录</div>
      </template>
    </el-table>

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

    <el-drawer v-model="detailVisible" title="信访详情" size="46%">
      <div v-if="detail" class="detail">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, RefreshLeft, Search } from '@element-plus/icons-vue'

type Row = Record<string, any>

const router = useRouter()
const rows = ref<Row[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const tabs = ref<Record<string, number>>({})
const selection = ref<Row[]>([])
const disposeOptions = ref<Array<{ label: string; value: string }>>([])
const disposeLabelMap = ref<Record<string, string>>({})
const detailVisible = ref(false)
const detail = ref<Row | null>(null)

const filter = reactive({
  tab: 'all',
  category: '',
  disposeForm: '',
  reportForm: '',
  isCompleted: '',
  keyword: '',
})

const categoryMap: Record<string, string> = { '0': '问题线索', '1': '信访件' }
const targetTypeMap: Record<string, string> = { ORG: '单位', IND: '个人' }
const reportFormMap: Record<string, string> = { JB1001: '实名', JB1002: '匿名' }

const categoryLabel = (v: string) => categoryMap[v] ?? v ?? '—'
const targetTypeLabel = (v: string) => targetTypeMap[v] ?? v ?? '—'
const reportFormLabel = (v: string) => reportFormMap[v] ?? v ?? '—'
const labelOf = (map: Record<string, string>, v: string) => map[v] ?? v ?? '—'

const detailGroups = computed(() => {
  const row = detail.value ?? {}
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
      ['线索来源', row.ClueSource],
      ['接收时间', shortTime(row.ReceiveTime)],
    ]),
    group('被反映人', [
      ['类型', targetTypeLabel(row.TargetType)],
      ['姓名', row.TargetName],
      ['性别', row.Gender],
      ['单位职务', row.TargetPost],
      ['职级', row.TargetRank],
      ['政治面貌', row.PoliticalStatus],
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
      ['承办形式', row.UndertakeForm],
    ]),
    group('处置信息', [
      ['处置时间', row.DisposeTime],
      ['处置方式', row.DisposeMethod],
      ['应办结时间', row.Deadline],
      ['处置进度', row.DisposeProgress],
    ]),
    group('处置结果', [
      ['处置形态', labelOf(disposeLabelMap.value, row.DisposeForm)],
      ['处置结果', row.DisposeResult],
      ['是否办结', row.IsCompleted === 'BJ1001' ? '是' : '否'],
      ['办结时间', row.CompleteTime],
    ]),
    group('其他', [
      ['是否超期', row.IsOverdue === 'CQ1001' ? '是' : '否'],
      ['超期原因', row.OverdueReason],
      ['主办人', row.MainHandler],
      ['协办人', row.AssistantHandler],
      ['审核人', row.AuditHandler],
      ['领导签批', row.LeaderApproval],
      ['签批情况', row.ApprovalStatus],
      ['实名反馈', row.RealNameReport],
      ['备注', row.Remark],
    ]),
  ]
})

async function load(): Promise<void> {
  const res = await window.api.complaints.list({
    ...filter,
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
}

function reload(): void {
  page.value = 1
  load()
}

function reset(): void {
  filter.tab = 'all'
  filter.category = ''
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
  router.push('/complaints/new')
}

function openEdit(row: Row): void {
  if (!row) return
  router.push(`/complaints/${encodeURIComponent(row.OriginalCode)}/edit`)
}

async function openDetail(row: Row): Promise<void> {
  const res = await window.api.complaints.get(row.OriginalCode)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '加载详情失败')
    return
  }
  detail.value = res.data
  detailVisible.value = true
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

onMounted(async () => {
  const [dispose, labels] = await Promise.all([
    window.api.dict.options('处置形态'),
    window.api.dict.labels('处置形态'),
  ])
  if (dispose?.ok) disposeOptions.value = dispose.data
  if (labels?.ok) disposeLabelMap.value = labels.data
  load()
})
</script>

<style scoped>
.page {
  padding: 1.5rem 1.75rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
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
</style>
