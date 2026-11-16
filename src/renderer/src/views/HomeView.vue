<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">首页统计</h1>
        <p class="page-subtitle">信访与问题线索总体办理情况</p>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <el-button :icon="Download" @click="exportReport">导出报表</el-button>
      </div>
    </header>

    <section class="ledger">
      <article v-for="item in cards" :key="item.key" class="cell" :class="{ alert: item.alert }">
        <span class="cell-label">{{ item.label }}</span>
        <span class="cell-value">{{ item.value }}</span>
        <span class="cell-note">{{ item.note }}</span>
      </article>
    </section>

    <section class="panels">
      <div class="panel wide">
        <header class="panel-head">
          <h2>月度趋势</h2>
          <span class="panel-note mono">近 12 个月</span>
        </header>
        <el-table :data="monthly" size="small" height="300">
          <el-table-column prop="monthName" label="月份" min-width="120" />
          <el-table-column prop="count" label="接收数量" width="100" align="right" />
          <el-table-column prop="completedCount" label="办结数量" width="100" align="right" />
          <el-table-column prop="overdueCount" label="超期数量" width="100" align="right" />
          <el-table-column label="办结率" width="110" align="right">
            <template #default="{ row }">
              <span class="mono">{{ row.completionRate.toFixed(1) }}%</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pair">
      <div class="panel">
        <header class="panel-head">
          <h2>线索来源</h2>
          <span class="panel-note mono">按问题线索统计</span>
        </header>
        <el-table :data="clueSources" size="small" height="300">
          <el-table-column prop="name" label="线索来源" min-width="130" />
          <el-table-column prop="count" label="数量" width="80" align="right" />
          <el-table-column label="占比" min-width="170">
            <template #default="{ row }">
              <div class="share">
                <span class="mono share-num">{{ pct(row.percentage) }}</span>
                <span class="share-track">
                  <span class="share-fill" :style="{ width: barWidth(row.percentage) }" />
                </span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="panel">
        <header class="panel-head">
          <h2>处置形态</h2>
          <span class="panel-note mono">按问题线索统计</span>
        </header>
        <el-table :data="disposeForms" size="small" height="300">
          <el-table-column prop="name" label="处置形态" min-width="130" />
          <el-table-column prop="count" label="数量" width="80" align="right" />
          <el-table-column label="占比" min-width="170">
            <template #default="{ row }">
              <div class="share">
                <span class="mono share-num">{{ pct(row.percentage) }}</span>
                <span class="share-track">
                  <span class="share-fill" :style="{ width: barWidth(row.percentage) }" />
                </span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Refresh } from '@element-plus/icons-vue'

type Overview = {
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

type GroupRow = { key: string; name: string; count: number; percentage: number }
type MonthRow = {
  monthName: string
  count: number
  completedCount: number
  overdueCount: number
  completionRate: number
}

const overview = ref<Overview>({
  xfTotal: 0,
  xsTotal: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  archived: 0,
  overdue: 0,
  overdueRate: 0,
  completionRate: 0,
  reportCount: 0,
  accusationCount: 0,
})
const monthly = ref<MonthRow[]>([])
const clueSources = ref<GroupRow[]>([])
const disposeForms = ref<GroupRow[]>([])

const cards = computed(() => [
  { key: 'xs', label: '问题线索', value: overview.value.xsTotal, note: '线索总数', alert: false },
  { key: 'xf', label: '信访件', value: overview.value.xfTotal, note: '信访总数', alert: false },
  { key: 'real', label: '实名举报', value: overview.value.reportCount, note: '累计接收', alert: false },
  { key: 'anon', label: '匿名举报', value: overview.value.accusationCount, note: '累计接收', alert: false },
  { key: 'done', label: '已办结', value: overview.value.completed, note: '已完成办理', alert: false },
  { key: 'doing', label: '办理中', value: overview.value.processing, note: '进行中案件', alert: false },
  { key: 'overdue', label: '已超期', value: overview.value.overdue, note: `超期率 ${overview.value.overdueRate}%`, alert: overview.value.overdue > 0 },
  { key: 'rate', label: '办结率', value: `${overview.value.completionRate}%`, note: '整体完成率', alert: false },
])

async function load(): Promise<void> {
  const [ov, mo, clue, dispose] = await Promise.all([
    window.api.stats.overview(),
    window.api.stats.monthly(),
    window.api.stats.groups('ClueSource'),
    window.api.stats.groups('DisposeForm'),
  ])
  if (ov?.ok) overview.value = ov.data
  if (mo?.ok) monthly.value = mo.data
  if (clue?.ok) clueSources.value = clue.data
  if (dispose?.ok) disposeForms.value = dispose.data
}

async function exportReport(): Promise<void> {
  const res = await window.api.exports.stats()
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '导出失败')
    return
  }
  ElMessage.success(res.data ? `已导出到 ${res.data}` : '已取消导出')
}

function pct(percentage: number): string {
  return `${Number(percentage ?? 0).toFixed(1)}%`
}

function barWidth(percentage: number): string {
  const peak = Math.max(
    1,
    ...clueSources.value.map((row) => row.percentage),
    ...disposeForms.value.map((row) => row.percentage),
  )
  return `${Math.max(2, Math.round((percentage / peak) * 100))}%`
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 1.5rem 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
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

.ledger {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  overflow: hidden;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.875rem 1rem 1rem;
  border-right: 1px solid var(--rule);
}

.cell:last-child {
  border-right: none;
}

.cell-label {
  font-size: 0.75rem;
  color: var(--ink-3);
  letter-spacing: 0.04em;
}

.cell-value {
  font-size: clamp(1.5rem, 1.4vw + 0.95rem, 2rem);
  font-weight: 600;
  line-height: 1.1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.cell-note {
  font-size: 0.6875rem;
  color: var(--ink-3);
}

.cell.alert .cell-value {
  color: var(--signal);
}

.panels {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.875rem;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 0.875rem 1rem 1rem;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.625rem;
}

.panel-head h2 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ink);
}

.panel-note {
  font-size: 0.75rem;
  color: var(--ink-3);
}

@media (max-width: 76rem) {
  .ledger {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .cell:nth-child(4) {
    border-right: none;
  }

  .cell:nth-child(n + 5) {
    border-top: 1px solid var(--rule);
  }
}

@media (max-width: 60rem) {
  .ledger {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cell:nth-child(2n) {
    border-right: none;
  }

  .cell:nth-child(2n + 1) {
    border-right: 1px solid var(--rule);
  }

  .cell:nth-child(n + 3) {
    border-top: 1px solid var(--rule);
  }

  .pair {
    grid-template-columns: minmax(0, 1fr);
  }
}

.share {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.share-track {
  flex: 1;
  height: 0.375rem;
  background: var(--rule);
  border-radius: 0.125rem;
  overflow: hidden;
}
.share-fill {
  display: block;
  height: 100%;
  background: var(--harbor);
}
.share-num {
  flex: 0 0 3.25rem;
  text-align: right;
  white-space: nowrap;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
</style>
