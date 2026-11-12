<template>
  <div class="page">
    <h2 class="page-title">工作台</h2>

    <section class="ledger" aria-label="数据概览">
      <div class="ledger-cell">
        <span class="ledger-label">案件总数</span>
        <span class="ledger-num">{{ stats.cases }}</span>
      </div>
      <div class="ledger-cell">
        <span class="ledger-label">附件总数</span>
        <span class="ledger-num">{{ stats.attachments }}</span>
      </div>
      <div class="ledger-cell">
        <span class="ledger-label">操作日志</span>
        <span class="ledger-num">{{ stats.logs }}</span>
      </div>
      <div class="ledger-cell ledger-cell--meta">
        <span class="ledger-label">存储引擎</span>
        <span class="ledger-engine mono">{{ stats.driver }}</span>
      </div>
    </section>

    <div class="split">
      <section class="sheet">
        <header class="sheet-head">
          <h3 class="section-title">开始办理</h3>
        </header>
        <div class="entries">
          <button class="entry" type="button" @click="router.push('/cases/new')">
            <span class="entry-text">
              <strong>新建案件办理单</strong>
              <small>登记案件信息、办案人员与附件</small>
            </span>
            <el-icon class="entry-arrow"><ArrowRight /></el-icon>
          </button>
          <button class="entry" type="button" @click="router.push('/cases')">
            <span class="entry-text">
              <strong>查看案件列表</strong>
              <small>检索、查看与删除已登记的案件</small>
            </span>
            <el-icon class="entry-arrow"><ArrowRight /></el-icon>
          </button>
          <button class="entry" type="button" @click="router.push('/logs')">
            <span class="entry-text">
              <strong>查看操作日志</strong>
              <small>按动作与时间筛选，导出 CSV</small>
            </span>
            <el-icon class="entry-arrow"><ArrowRight /></el-icon>
          </button>
        </div>
      </section>

      <section class="sheet">
        <header class="sheet-head">
          <h3 class="section-title">系统</h3>
        </header>
        <dl class="env">
          <div class="env-row"><dt>应用版本</dt><dd class="mono">v{{ meta.version }}</dd></div>
          <div class="env-row"><dt>平台</dt><dd class="mono">{{ meta.platform }}</dd></div>
          <div class="env-row"><dt>SQLite 驱动</dt><dd class="mono">{{ stats.driver }}</dd></div>
        </dl>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

const router = useRouter()
const stats = reactive<{ cases: number; attachments: number; logs: number; driver: string }>({
  cases: 0,
  attachments: 0,
  logs: 0,
  driver: '-'
})
const meta = reactive({ version: '-', platform: '-' })

onMounted(async () => {
  const s = await window.api.app.stats()
  if (s?.ok) {
    stats.cases = s.cases
    stats.attachments = s.attachments
    stats.logs = s.logs
    stats.driver = s.driver ?? '-'
  }
  const m = await window.api.app.meta()
  if (m?.ok) {
    meta.version = m.version
    meta.platform = m.platform
  }
})
</script>

<style scoped>
.ledger {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.1fr);
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  margin-bottom: 1rem;
  overflow: hidden;
}

.ledger-cell {
  padding: 1rem 1.25rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-right: 1px solid var(--rule);
}

.ledger-cell:last-child {
  border-right: none;
}

.ledger-label {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--ink-3);
}

.ledger-num {
  font-size: clamp(1.75rem, 2vw + 0.75rem, 2.5rem);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.ledger-engine {
  font-size: 0.875rem;
  line-height: 1.1;
  padding-top: 0.75rem;
  color: var(--ink);
  word-break: break-all;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.sheet {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  overflow: hidden;
}

.sheet-head {
  padding: 0.75rem 1.125rem;
  border-bottom: 1px solid var(--rule);
}

.entries {
  display: flex;
  flex-direction: column;
}

.entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.9375rem 1.125rem;
  border: 0;
  border-bottom: 1px solid var(--rule);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.16s ease;
}

.entry:last-child {
  border-bottom: none;
}

.entry:hover {
  background: var(--surface-alt);
}

.entry-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.entry-text strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ink);
}

.entry-text small {
  font-size: 0.75rem;
  color: var(--ink-3);
}

.entry-arrow {
  font-size: 0.875rem;
  color: var(--rule-2);
  transition: color 0.16s ease, translate 0.16s ease;
}

.entry:hover .entry-arrow {
  color: var(--harbor);
  translate: 0.1875rem 0;
}

.env {
  margin: 0;
  padding: 0.25rem 1.125rem 0.75rem;
}

.env-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6875rem 0;
  border-bottom: 1px solid var(--rule);
}

.env-row:last-child {
  border-bottom: none;
}

.env-row dt {
  font-size: 0.75rem;
  color: var(--ink-3);
}

.env-row dd {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--ink);
  word-break: break-all;
  text-align: right;
}

@media (max-width: 68rem) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 46rem) {
  .ledger {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ledger-cell {
    border-bottom: 1px solid var(--rule);
  }

  .ledger-cell:nth-child(2n) {
    border-right: none;
  }
}
</style>
