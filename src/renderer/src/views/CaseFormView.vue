<template>
  <div class="page">
    <h2 class="page-title">案件办理单</h2>
    <p class="page-subtitle">带 <span class="required-mark">*</span> 为必填项，提交后可在「案件列表」查看。</p>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="128px" label-position="right" size="default"
      @submit.prevent>
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title"><em class="section-no">01</em>案件信息</span></template>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="案件类型" prop="caseType">
              <el-select v-model="form.caseType" placeholder="请选择案件类型" clearable style="width: 100%">
                <el-option v-for="item in caseTypes" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否办结" prop="isClosed">
              <el-select v-model="form.isClosed" placeholder="请选择" style="width: 100%">
                <el-option label="是" value="是" />
                <el-option label="否" value="否" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="办结时间" prop="closedAt">
              <el-date-picker v-model="form.closedAt" type="date" placeholder="请选择办结时间" value-format="YYYY-MM-DD"
                :disabled="form.isClosed !== '是'" :disabled-date="notFuture" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title"><em class="section-no">02</em>超期信息</span></template>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="是否超期" prop="isOverdue">
              <el-select v-model="form.isOverdue" placeholder="请选择是否超期">
                <el-option label="是" value="是" />
                <el-option label="否" value="否" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="超期原因" prop="overdueReason">
              <el-input v-model="form.overdueReason" type="textarea" :rows="2" maxlength="300" show-word-limit
                :disabled="form.isOverdue !== '是'" placeholder="存在超期时请填写超期原因" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title"><em class="section-no">03</em>办案人员</span></template>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="主办人" prop="owner">
              <el-input v-model="form.owner" placeholder="请输入主办人" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="协办人" prop="coOwner">
              <el-input v-model="form.coOwner" placeholder="请输入协办人" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="审核人" prop="reviewer">
              <el-input v-model="form.reviewer" placeholder="请输入审核人" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="审核时间" prop="reviewedAt">
              <el-date-picker v-model="form.reviewedAt" type="date" placeholder="请选择审核时间"
                value-format="YYYY-MM-DD" :disabled-date="auditDisabled" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title"><em class="section-no">04</em>签批信息</span></template>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="领导签批" prop="leaderApproval">
              <el-select v-model="form.leaderApproval" placeholder="请选择领导签批" clearable style="width: 100%">
                <el-option label="同意" value="同意" />
                <el-option label="不同意" value="不同意" />
                <el-option label="待签批" value="待签批" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="签批情况" prop="approvalStatus">
              <el-select v-model="form.approvalStatus" placeholder="请选择签批情况" clearable style="width: 100%">
                <el-option label="已签批" value="已签批" />
                <el-option label="部分签批" value="部分签批" />
                <el-option label="未签批" value="未签批" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>
      <el-card class="section-card" shadow="never">
        <template #header><span class="section-title"><em class="section-no">05</em>其他信息</span></template>
        <el-row :gutter="24">
          <el-col :span="24">
            <el-form-item label="实名举报反映情况" prop="reportDetail">
              <el-input v-model="form.reportDetail" type="textarea" :rows="2" maxlength="500" show-word-limit
                placeholder="请输入实名举报反映情况" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit
                placeholder="请输入备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>
      <el-card class="section-card" shadow="never">
        <template #header>
          <div class="attach-header">
            <span class="section-title"><em class="section-no">06</em>附件管理</span>
            <span class="attach-count">共 {{ attachments.length }} 个附件</span>
          </div>
        </template>

        <div class="table-toolbar">
          <div class="toolbar-left">
            <el-button type="primary" plain :icon="Upload" @click="pickFiles">批量上传</el-button>
            <el-button :icon="Download" :disabled="!selectedIds.length" @click="downloadSelected">批量下载</el-button>
            <el-button type="danger" plain :icon="Delete" :disabled="!selectedIds.length"
              @click="removeSelected">批量删除</el-button>
          </div>
          <div class="toolbar-right">
            <span class="attach-count">已选 {{ selectedIds.length }} 项</span>
          </div>
        </div>

        <el-table :data="attachments" border stripe height="240" @selection-change="onSelectionChange">
          <el-table-column type="selection" width="46" :selectable="() => true" />
          <el-table-column prop="file_name" label="文件名" min-width="240" show-overflow-tooltip />
          <el-table-column label="大小" width="110">
            <template #default="{ row }">{{ formatSize(row.file_size) }}</template>
          </el-table-column>
          <el-table-column prop="uploader" label="上传人" width="110" />
          <el-table-column label="上传时间" width="170">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" @click="removeOne(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <div class="attach-empty">
              <span class="attach-empty-tag">EMPTY</span>
              <p>尚未添加附件</p>
              <small>点击「批量上传」从本机选择文件，可多选。</small>
            </div>
          </template>
        </el-table>
      </el-card>

      <div class="form-actions">
        <el-button size="large" :icon="RefreshLeft" @click="resetForm">重 置</el-button>
        <el-button size="large" type="primary" :loading="submitting" @click="submit">
          <el-icon><Check /></el-icon> 提交
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Check, Delete, Download, RefreshLeft, Upload } from '@element-plus/icons-vue'

type AttachmentRow = {
  id: number
  file_name: string
  file_size: number
  uploader: string
  created_at: string
  stored_path: string
}

const router = useRouter()
const formRef = ref<FormInstance>()
const submitting = ref(false)
const attachments = ref<AttachmentRow[]>([])
const selectedIds = ref<number[]>([])

const caseTypes = ['投诉举报', '业务咨询', '违规线索', '服务纠纷', '其他']

function emptyForm() {
  return {
    caseType: '',
    isClosed: '否',
    closedAt: null as string | null,
    isOverdue: '否',
    overdueReason: '',
    owner: '',
    coOwner: '',
    reviewer: '',
    reviewedAt: null as string | null,
    leaderApproval: '',
    approvalStatus: '',
    reportDetail: '',
    remark: ''
  }
}

const form = reactive(emptyForm())

const todayStart = (): number => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const notFuture = (date: Date): boolean => date.getTime() > Date.now()

const auditDisabled = (date: Date): boolean => {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  oneYearAgo.setHours(0, 0, 0, 0)
  return date.getTime() < oneYearAgo.getTime() || date.getTime() > Date.now()
}

const rules = computed<FormRules>(() => ({
  caseType: [{ required: true, message: '请选择案件类型', trigger: 'change' }],
  isClosed: [{ required: true, message: '请选择是否办结', trigger: 'change' }],
  isOverdue: [{ required: true, message: '请选择是否超期', trigger: 'change' }],
  closedAt: [
    {
      validator: (_rule, value, callback) => {
        if (form.isClosed !== '是') return callback()
        if (!value) return callback(new Error('已办结时必须填写办结时间'))
        const t = new Date(String(value)).getTime()
        if (Number.isNaN(t)) return callback(new Error('办结时间格式不正确'))
        if (t > todayStart()) return callback(new Error('办结时间不能晚于今天'))
        callback()
      },
      trigger: 'change'
    }
  ],
  overdueReason: [
    {
      validator: (_rule, value, callback) => {
        if (form.isOverdue === '是' && !String(value ?? '').trim()) {
          return callback(new Error('存在超期时请填写超期原因'))
        }
        callback()
      },
      trigger: 'blur'
    }
  ],
  reviewedAt: [
    {
      validator: (_rule, value, callback) => {
        if (!value) return callback()
        const t = new Date(String(value)).getTime()
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        oneYearAgo.setHours(0, 0, 0, 0)
        if (t < oneYearAgo.getTime()) return callback(new Error('审核时间不得早于今天前一年'))
        if (t > todayStart()) return callback(new Error('审核时间不能晚于今天'))
        callback()
      },
      trigger: 'change'
    }
  ]
}))

function formatSize(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function onSelectionChange(rows: AttachmentRow[]): void {
  selectedIds.value = rows.map((r) => r.id)
}

async function loadPending(): Promise<void> {
  const res = await window.api.attachments.pending()
  if (res?.ok) attachments.value = res.rows ?? []
}

async function pickFiles(): Promise<void> {
  const res = await window.api.attachments.pick()
  if (!res?.ok) {
    ElMessage.error(res?.message || '上传失败')
    return
  }
  if (!res.rows?.length) return
  attachments.value = [...res.rows, ...attachments.value]
  ElMessage.success(`已上传 ${res.rows.length} 个附件`)
}

async function downloadSelected(): Promise<void> {
  if (!selectedIds.value.length) return
  const res = await window.api.attachments.download({ ids: selectedIds.value })
  if (res?.ok) ElMessage.success(`已导出 ${res.count} 个附件到 ${res.dir}`)
  else if (res?.message && res.message !== '已取消') ElMessage.error(res.message)
}

async function removeSelected(): Promise<void> {
  if (!selectedIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个附件吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await window.api.attachments.remove({ ids: selectedIds.value })
  if (res?.ok) {
    const removed = new Set(selectedIds.value)
    attachments.value = attachments.value.filter((a) => !removed.has(a.id))
    selectedIds.value = []
    ElMessage.success('已删除')
  } else {
    ElMessage.error(res?.message || '删除失败')
  }
}

async function removeOne(row: AttachmentRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除附件「${row.file_name}」吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  const res = await window.api.attachments.remove({ ids: [row.id] })
  if (res?.ok) {
    attachments.value = attachments.value.filter((a) => a.id !== row.id)
    ElMessage.success('已删除')
  } else {
    ElMessage.error(res?.message || '删除失败')
  }
}

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const res = await window.api.cases.create({
      input: {
        caseType: form.caseType,
        isClosed: form.isClosed === '是',
        closedAt: form.closedAt || null,
        isOverdue: form.isOverdue === '是',
        overdueReason: form.overdueReason || null,
        owner: form.owner || null,
        coOwner: form.coOwner || null,
        reviewer: form.reviewer || null,
        reviewedAt: form.reviewedAt || null,
        leaderApproval: form.leaderApproval || null,
        approvalStatus: form.approvalStatus || null,
        reportDetail: form.reportDetail || null,
        remark: form.remark || null
      },
      attachmentIds: attachments.value.map((a) => a.id)
    })
    if (!res.ok) {
      ElMessage.error(res.message || '提交失败')
      return
    }
    ElMessage.success(`提交成功，案件编号 ${res.data.case_no}`)
    resetForm()
    router.push('/cases')
  } finally {
    submitting.value = false
  }
}

function resetForm(): void {
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
  attachments.value = []
  selectedIds.value = []
}

onMounted(loadPending)
</script>

<style scoped>
.required-mark {
  color: var(--el-color-danger);
}

.attach-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.attach-count {
  font-size: 12.5px;
  letter-spacing: 0.02em;
  color: var(--ink-3);
}

.section-no {
  font-family: var(--mono);
  font-style: normal;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  margin-right: -2px;
}

.attach-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 30px 0 34px;
}

.attach-empty-tag {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ink-3);
  border: 1px solid var(--rule);
  padding: 3px 7px;
  background: var(--surface-alt);
}

.attach-empty p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ink-2);
}

.attach-empty small {
  font-size: 12px;
  color: var(--ink-3);
}
</style>
