<template>
  <div class="page">
    <h2 class="page-title">案件列表</h2>
    <p class="page-subtitle">共 {{ total }} 条记录，按创建时间倒序。</p>

    <el-card class="section-card" shadow="never">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <el-input v-model="keyword" placeholder="案件编号 / 类型 / 主办人 / 备注" clearable style="width: 280px"
            :prefix-icon="Search" @keyup.enter="reload" @clear="reload" />
          <el-button type="primary" :icon="Search" @click="reload">查询</el-button>
        </div>
        <div class="toolbar-right">
          <el-button :icon="Refresh" @click="reload">刷新</el-button>
          <el-button type="primary" plain :icon="DocumentAdd" @click="router.push('/cases/new')">新建案件</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe>
        <el-table-column prop="case_no" label="案件编号" width="170" />
        <el-table-column prop="case_type" label="案件类型" width="120" />
        <el-table-column label="是否办结" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_closed ? 'success' : 'info'" size="small">{{ row.is_closed ? '已办结' : '未办结' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="closed_at" label="办结时间" width="120">
          <template #default="{ row }">{{ row.closed_at || '-' }}</template>
        </el-table-column>
        <el-table-column label="是否超期" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_overdue ? 'danger' : 'success'" size="small">{{ row.is_overdue ? '超期' : '正常' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="owner" label="主办人" width="100">
          <template #default="{ row }">{{ row.owner || '-' }}</template>
        </el-table-column>
        <el-table-column prop="reviewer" label="审核人" width="100">
          <template #default="{ row }">{{ row.reviewer || '-' }}</template>
        </el-table-column>
        <el-table-column prop="approval_status" label="签批情况" width="110">
          <template #default="{ row }">{{ row.approval_status || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无案件，去「案件录入」新增一条" :image-size="80" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
          :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next, jumper" background
          @size-change="load" @current-change="load" />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="案件详情" width="760px">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="案件编号">{{ detail.case_no }}</el-descriptions-item>
          <el-descriptions-item label="案件类型">{{ detail.case_type }}</el-descriptions-item>
          <el-descriptions-item label="是否办结">{{ detail.is_closed ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="办结时间">{{ detail.closed_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="是否超期">{{ detail.is_overdue ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="超期原因">{{ detail.overdue_reason || '-' }}</el-descriptions-item>
          <el-descriptions-item label="主办人">{{ detail.owner || '-' }}</el-descriptions-item>
          <el-descriptions-item label="协办人">{{ detail.co_owner || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{ detail.reviewer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="审核时间">{{ detail.reviewed_at || '-' }}</el-descriptions-item>
          <el-descriptions-item label="领导签批">{{ detail.leader_approval || '-' }}</el-descriptions-item>
          <el-descriptions-item label="签批情况">{{ detail.approval_status || '-' }}</el-descriptions-item>
          <el-descriptions-item label="实名举报反映情况" :span="2">{{ detail.report_detail || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ detail.created_by || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(detail.created_at) }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="attach-title">附件（{{ detailAttachments.length }}）</h4>
        <el-table :data="detailAttachments" border size="small" max-height="220">
          <el-table-column prop="file_name" label="文件名" min-width="240" show-overflow-tooltip />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">{{ formatSize(row.file_size) }}</template>
          </el-table-column>
          <el-table-column prop="uploader" label="上传人" width="100" />
        </el-table>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DocumentAdd, Refresh, Search } from '@element-plus/icons-vue'

type CaseRow = Record<string, any>

const router = useRouter()
const rows = ref<CaseRow[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const detailVisible = ref(false)
const detail = ref<CaseRow | null>(null)
const detailAttachments = ref<any[]>([])

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await window.api.cases.list({ page: page.value, pageSize: pageSize.value, keyword: keyword.value })
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

async function openDetail(row: CaseRow): Promise<void> {
  const res = await window.api.cases.get({ id: row.id })
  if (!res?.ok) {
    ElMessage.error(res?.message || '读取失败')
    return
  }
  detail.value = res.data
  detailAttachments.value = res.attachments ?? []
  detailVisible.value = true
}

async function remove(row: CaseRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除案件「${row.case_no}」及其附件吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await window.api.cases.remove({ id: row.id })
  if (res?.ok) {
    ElMessage.success('已删除')
    load()
  } else {
    ElMessage.error(res?.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.attach-title {
  margin: 18px 0 10px;
  font-size: 14px;
  color: #303133;
}
</style>
