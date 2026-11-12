<template>
  <div class="page">
    <h2 class="page-title">工作台</h2>
    <p class="page-subtitle">数据保存在本机 userData 目录，卸载应用不会自动清除。</p>

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
        <p class="note">
          演示路径：登录（记住我 / 错误密码留痕）→ 案件录入（条件校验 / 附件上传）→ 列表 → 操作日志。
        </p>
      </section>

      <section class="sheet">
        <header class="sheet-head">
          <h3 class="section-title">运行环境</h3>
        </header>
        <dl class="env">
          <div class="env-row"><dt>应用版本</dt><dd class="mono">v{{ meta.version }}</dd></div>
          <div class="env-row"><dt>Electron</dt><dd class="mono">{{ meta.electron }}</dd></div>
          <div class="env-row"><dt>Node</dt><dd class="mono">{{ meta.node }}</dd></div>
          <div class="env-row"><dt>SQLite 驱动</dt><dd class="mono">{{ stats.driver }}</dd></div>
          <div class="env-row"><dt>平台</dt><dd class="mono">{{ meta.platform }}</dd></div>
          <div class="env-row env-row--path">
            <dt>数据目录</dt>
            <dd class="mono path">{{ stats.paths?.userData }}</dd>
          </div>
        </dl>
        <p class="env-note">数据只落在本机 SQLite 文件，不经过任何服务端。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

const router = useRouter()
const stats = reactive<{
  cases: number
  attachments: number
  logs: number
  driver: string
  paths?: { userData: string }
}>({
  cases: 0,
  attachments: 0,
  logs: 0,
  driver: '-'
})
const meta = reactive({ version: '-', electron: '-', node: '-', platform: '-' })

onMounted(async () => {
  const s = await window.api.app.stats()
  if (s?.ok) {
    stats.cases = s.cases
    stats.attachments = s.attachments
    stats.logs = s.logs
    stats.driver = s.driver ?? '-'
    stats.paths = s.paths
  }
  const m = await window.api.app.meta()
  if (m?.ok) {
    meta.version = m.version
    meta.electron = m.electron
    meta.node = m.node
    meta.platform = m.platform
  }
})
</script>

<style scoped>
.ledger {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.15fr);
  background: var(--surface);
  border: 1px solid var(--rule);
  border-top: 2px solid var(--harbor);
  margin-bottom: 18px;
}

.ledger-cell {
  padding: 16px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-right: 1px solid var(--rule);
}

.ledger-cell:last-child {
  border-right: none;
}

.ledger-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.ledger-num {
  font-family: var(--display);
  font-size: 38px;
  line-height: 1;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.ledger-engine {
  font-family: var(--mono);
  font-size: 14px;
  color: var(--ink);
  padding-top: 12px;
  word-break: break-all;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.sheet {
  border: 1px solid var(--rule);
  background: var(--surface);
}

.sheet-head {
  padding: 12px 18px;
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
  gap: 16px;
  width: 100%;
  padding: 13px 18px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--rule);
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
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
  gap: 4px;
}

.entry-text strong {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
}

.entry-text small {
  font-size: 12px;
  color: var(--ink-3);
}

.entry-arrow {
  font-size: 13px;
  color: var(--rule-2);
  transition: transform 0.16s ease, color 0.16s ease;
}

.entry:hover .entry-arrow {
  transform: translateX(3px);
  color: var(--harbor);
}

.note {
  margin: 0;
  padding: 12px 18px 14px;
  border-top: 1px solid var(--rule);
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-3);
}

.env {
  margin: 0;
  padding: 0;
}

.env-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 14px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--rule);
}

.env-row:last-child {
  border-bottom: none;
}

.env-row dt {
  font-size: 11.5px;
  color: var(--ink-3);
  padding-top: 2px;
}

.env-row dd {
  margin: 0;
  font-size: 12px;
  color: var(--ink-2);
}

.env-note {
  margin: 0;
  padding: 12px 18px 14px;
  border-top: 1px solid var(--rule);
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-3);
}

.path {
  word-break: break-all;
  font-size: 11px;
  line-height: 1.6;
}
</style>
