<template>
  <div class="page">
    <h2 class="page-title">操作日志</h2>

    <el-card class="section-card" shadow="never">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <el-select v-model="action" placeholder="全部动作" clearable style="width: 10rem" @change="reload">
            <el-option v-for="item in actions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-input v-model="keyword" placeholder="用户 / 详情 / 对象ID" clearable style="width: 15rem" :prefix-icon="Search"
            @keyup.enter="reload" @clear="reload" />
          <el-button type="primary" :icon="Search" @click="reload">查询</el-button>
        </div>
        <div class="toolbar-right">
          <el-button :icon="Refresh" @click="reload">刷新</el-button>
          <el-button type="primary" plain :icon="Download" @click="exportCsv">导出 CSV</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe>
        <el-table-column label="时间" min-width="168" class-name="cell-mono">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column prop="username" label="用户" min-width="88">
          <template #default="{ row }">{{ row.username || '-' }}</template>
        </el-table-column>
        <el-table-column label="动作" min-width="136">
          <template #default="{ row }">
            <span class="action-text">{{ actionLabel(row.action) }}</span>
            <div class="action-code">{{ row.action }}</div>
          </template>
        </el-table-column>
        <el-table-column label="对象" min-width="120" class-name="cell-mono">
          <template #default="{ row }">
            <span v-if="row.target_type">{{ row.target_type }}#{{ row.target_id }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="240" show-overflow-tooltip />
        <el-table-column prop="machine" label="机器名" min-width="132" show-overflow-tooltip />
        <el-table-column label="结果" min-width="84" align="center">
          <template #default="{ row }">
            <el-tag :type="row.result === 'success' ? 'success' : 'danger'" effect="plain" size="small">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-state"><span>NO RECORDS</span><p>当前筛选条件下没有日志</p></div>
        </template>
      </el-table>

      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
          :page-sizes="[10, 20, 50, 100]" layout="total, sizes, prev, pager, next, jumper" background
          @size-change="load" @current-change="load" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Refresh, Search } from '@element-plus/icons-vue'

type LogRow = Record<string, any>
type ActionOption = { value: string; label: string }

const rows = ref<LogRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const action = ref('')
const keyword = ref('')
const loading = ref(false)
const actions = ref<ActionOption[]>([])

const LABELS: Record<string, string> = {
  login: '登录成功',
  login_failed: '登录失败',
  auto_login: '自动登录',
  logout: '退出登录',
  create_case: '新增案件',
  delete_case: '删除案件',
  upload_attachment: '上传附件',
  delete_attachment: '删除附件',
  download_attachment: '下载附件',
  export_csv: '导出日志',
  save_dict_type: '维护字典类型',
  delete_dict_type: '删除字典类型',
  save_dict_item: '维护枚举项',
  delete_dict_item: '删除枚举项'
}

function actionLabel(value: string): string {
  if (value === 'login_failed') return '登录失败'
  return LABELS[value] ?? value
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await window.api.logs.list({
      page: page.value,
      pageSize: pageSize.value,
      action: action.value || undefined,
      keyword: keyword.value || undefined
    })
    if (res?.ok) {
      rows.value = res.rows
      total.value = res.total
    }
  } finally {
    loading.value = false
  }
}

function reload(): void {
  page.value = 1
  load()
}

async function exportCsv(): Promise<void> {
  const res = await window.api.logs.exportCsv()
  if (res?.ok) ElMessage.success(`已导出 ${res.count} 条日志`)
  else if (res?.message && res.message !== '已取消') ElMessage.error(res.message)
  load()
}

onMounted(async () => {
  const res = await window.api.logs.actions()
  if (res?.ok) actions.value = res.actions
  await load()
})
</script>

<style scoped>
:deep(.cell-mono) {
  font-family: var(--mono);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.action-text {
  font-size: 0.7812rem;
  color: var(--ink);
}

.action-code {
  margin-top: 2px;
  font-family: var(--mono);
  font-size: 0.6562rem;
  letter-spacing: 0.02em;
  color: var(--ink-3);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.875rem;
}
</style>
