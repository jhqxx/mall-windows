<template>
  <div class="page">
    <header class="page-head">
      <div class="head-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div>
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-subtitle mono">{{ form.OriginalCode || '编号自动生成' }}</p>
        </div>
      </div>
      <div class="head-actions">
        <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存</el-button>
        <el-button :icon="Close" @click="goBack">取消</el-button>
      </div>
    </header>

    <el-form ref="formRef" :model="form" label-width="8.5rem" label-position="right">
      <section class="block">
        <h2 class="block-title">编号信息</h2>
        <div class="grid">
          <el-form-item label="原始编号"><el-input v-model="form.OriginalCode" disabled /></el-form-item>
          <el-form-item label="线索编号"><el-input v-model="form.NewCode" placeholder="选填" /></el-form-item>
          <el-form-item label="信访编号"><el-input v-model="form.CategoryCode" placeholder="选填" /></el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">基本信息</h2>
        <div class="grid">
          <el-form-item label="类别">
            <el-input :model-value="categoryName" disabled />
          </el-form-item>
          <el-form-item v-if="!isClue" label="所属线索">
            <el-select v-model="form.ParentCode" class="fill" clearable filterable placeholder="未归并">
              <el-option
                v-for="item in clueChoices"
                :key="item.code"
                :label="`${item.code} · ${item.name}`"
                :value="item.code"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="线索来源">
            <el-select v-model="form.ClueSource" class="fill" clearable filterable>
              <el-option v-for="o in options['线索来源']" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="接收时间" prop="ReceiveTime">
            <el-date-picker v-model="form.ReceiveTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" class="fill" />
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">被反映人信息</h2>
        <div class="grid">
          <el-form-item label="被反映人类型">
            <el-select v-model="form.TargetType" class="fill">
              <el-option v-for="o in options.被反映人类型" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isUnit" label="单位名称">
            <el-input v-model="form.OrganizationName" />
          </el-form-item>
          <el-form-item v-else label="姓名">
            <el-input v-model="form.TargetName" />
          </el-form-item>
          <template v-if="isUnit">
            <el-form-item label="法人姓名"><el-input v-model="form.LegalPerson" /></el-form-item>
          </template>
          <template v-else>
            <el-form-item label="性别">
              <el-select v-model="form.Gender" class="fill" clearable>
                <el-option v-for="o in options.性别" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="职级">
              <el-select v-model="form.TargetRank" class="fill" clearable>
                <el-option v-for="o in options.职位层级" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="政治面貌">
              <el-select v-model="form.PoliticalStatus" class="fill" clearable>
                <el-option v-for="o in options.政治面貌" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="出生年月">
              <el-date-picker v-model="form.BirthDate" type="date" value-format="YYYY-MM-DD" class="fill" />
            </el-form-item>
          </template>
          <el-form-item label="单位职务"><el-input v-model="form.TargetPost" /></el-form-item>
          <el-form-item label="工作经历"><el-input v-model="form.WorkExperience" /></el-form-item>
          <el-form-item label="联系方式"><el-input v-model="form.ContactPhone" /></el-form-item>
          <el-form-item label="联系地址"><el-input v-model="form.ContactAddress" /></el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">信访内容</h2>
        <div class="grid">
          <el-form-item label="举报形式">
            <el-select v-model="form.ReportForm" class="fill" clearable>
              <el-option v-for="o in options.举报形式" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="举报人姓名"><el-input v-model="form.ReportName" /></el-form-item>
          <el-form-item label="联系电话"><el-input v-model="form.ReportPhone" /></el-form-item>
          <el-form-item label="反映问题摘要" class="span-3">
            <el-input v-model="form.ProblemSummary" type="textarea" :rows="4" />
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">分办信息</h2>
        <div class="grid">
          <el-form-item label="分办时间">
            <el-date-picker v-model="form.AssignTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" class="fill" />
          </el-form-item>
          <el-form-item label="分办部室">
            <el-select v-model="assignDepts" multiple class="fill" collapse-tags collapse-tags-tooltip>
              <el-option v-for="o in options.分办部室或片区" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="承办形式">
            <el-select v-model="form.UndertakeForm" class="fill" clearable>
              <el-option v-for="o in options.承办形式" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="承办部室">
            <el-select v-model="undertakeDepts" multiple class="fill" collapse-tags collapse-tags-tooltip>
              <el-option v-for="o in options.承办部室或片区" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">处置信息</h2>
        <div class="grid">
          <el-form-item label="处置时间">
            <el-date-picker v-model="form.DisposeTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" class="fill" />
          </el-form-item>
          <el-form-item label="处置方式">
            <el-select v-model="form.DisposeMethod" class="fill" clearable>
              <el-option v-for="o in options.处置方式" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="应办结时间">
            <el-date-picker v-model="form.Deadline" type="date" value-format="YYYY-MM-DD" class="fill" />
          </el-form-item>
          <el-form-item label="处置进度情况">
            <el-input v-model="form.DisposeProgress" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="办理情况">
            <el-input v-model="form.HandleStatus" type="textarea" :rows="3" />
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">处置（核实）结果</h2>
        <div class="grid">
          <el-form-item label="处置形态">
            <el-select v-model="form.DisposeForm" class="fill" clearable>
              <el-option v-for="o in options.处置形态" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="处置结果">
            <el-select v-model="form.DisposeResult" class="fill" clearable>
              <el-option v-for="o in options['处置（核实）结果']" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否办结">
            <el-select v-model="form.IsCompleted" class="fill">
              <el-option v-for="o in options.是否办结" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="办结时间">
            <el-date-picker v-model="form.CompleteTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" class="fill" />
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">超期信息</h2>
        <div class="grid">
          <el-form-item label="是否超期">
            <el-select v-model="form.IsOverdue" class="fill" clearable>
              <el-option v-for="o in options.是否超期" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="超期原因" class="span-2">
            <el-input v-model="form.OverdueReason" />
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">办案人员</h2>
        <div class="grid">
          <el-form-item label="主办人"><el-input v-model="form.MainHandler" /></el-form-item>
          <el-form-item label="协办人"><el-input v-model="form.AssistantHandler" /></el-form-item>
          <el-form-item label="审核人"><el-input v-model="form.AuditHandler" /></el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">签批信息</h2>
        <div class="grid">
          <el-form-item label="领导签批">
            <el-select v-model="form.LeaderApproval" class="fill" clearable>
              <el-option v-for="o in options.领导签批" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="签批情况">
            <el-select v-model="form.ApprovalStatus" class="fill" clearable>
              <el-option v-for="o in options.签批情况" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <h2 class="block-title">其他信息</h2>
        <div class="grid">
          <el-form-item label="实名举报反馈情况" class="span-3">
            <el-input v-model="form.RealNameReport" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="备注" class="span-3">
            <el-input v-model="form.Remark" type="textarea" :rows="2" />
          </el-form-item>
        </div>
      </section>

      <section class="block">
        <header class="block-head">
          <h2 class="block-title no-border">附件管理</h2>
          <div class="attach-actions">
            <el-button size="small" :icon="Upload" @click="upload">批量上传</el-button>
            <el-button size="small" :icon="Download" :disabled="!checked.length" @click="download">批量下载</el-button>
            <el-button size="small" :icon="Delete" :disabled="!checked.length" @click="removeAttachments">
              批量删除
            </el-button>
            <span class="attach-count mono">共 {{ attachments.length }} 个附件</span>
          </div>
        </header>
        <el-table :data="attachments" size="small" border height="220" @selection-change="onAttachSelect">
          <el-table-column type="selection" width="46" />
          <el-table-column prop="FileName" label="文件名" min-width="220" show-overflow-tooltip />
          <el-table-column label="大小" width="110" align="right">
            <template #default="{ row }">{{ formatSize(row.FileSize) }}</template>
          </el-table-column>
          <el-table-column prop="Uploader" label="上传人" width="140" />
          <el-table-column prop="UploadTime" label="上传时间" width="160" class-name="cell-mono" />
          <template #empty>
            <div class="empty">尚未添加附件</div>
          </template>
        </el-table>
      </section>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Check, Close, Delete, Download, Upload } from '@element-plus/icons-vue'

type Option = { label: string; value: string }
type Attachment = {
  Id: number
  FileName: string
  FileSize: number | null
  UploadTime: string
  Uploader: string | null
}

const route = useRoute()
const router = useRouter()
const formRef = ref()
const saving = ref(false)
const attachments = ref<Attachment[]>([])
const checked = ref<Attachment[]>([])
const options = reactive<Record<string, Option[]>>({})
const assignDepts = ref<string[]>([])
const undertakeDepts = ref<string[]>([])

const code = computed(() => (route.params.code as string) ?? '')
const isNew = computed(() => !code.value)
const isClue = computed(() => route.meta.kind === 'clue')
const pageTitle = computed(() => {
  const noun = isClue.value ? '线索' : '信访件'
  return isNew.value ? `新增${noun}` : `编辑${noun}`
})
const categoryName = computed(() => (isClue.value ? '问题线索' : '信访件'))
const clueChoices = ref<Array<{ code: string; name: string; summary: string }>>([])
const isUnit = computed(() => form.TargetType === 'ORG')

const form = reactive<Record<string, any>>({
  OriginalCode: '',
  NewCode: '',
  CategoryCode: '',
  Category: '0',
  ParentCode: '',
  ClueSource: '',
  ReceiveTime: '',
  TargetType: 'IND',
  TargetName: '',
  BirthDate: '',
  Gender: '',
  WorkExperience: '',
  OrganizationName: '',
  LegalPerson: '',
  ContactPhone: '',
  ContactAddress: '',
  TargetPost: '',
  TargetRank: '',
  PoliticalStatus: '',
  ProblemSummary: '',
  ReportForm: '',
  ReportName: '',
  ReportPhone: '',
  AssignTime: '',
  AssignDept: '',
  UndertakeDept: '',
  UndertakeForm: '',
  DisposeTime: '',
  DisposeMethod: '',
  Deadline: '',
  DisposeProgress: '',
  HandleStatus: '',
  DisposeForm: '',
  DisposeResult: '',
  IsCompleted: 'BJ1002',
  CompleteTime: '',
  IsOverdue: '',
  OverdueReason: '',
  MainHandler: '',
  AssistantHandler: '',
  AuditHandler: '',
  LeaderApproval: '',
  ApprovalStatus: '',
  RealNameReport: '',
  Remark: '',
})

const DICT_CLASSES = [
  '信访类别',
  '被反映人类型',
  '线索来源',
  '职位层级',
  '政治面貌',
  '举报形式',
  '分办部室或片区',
  '承办部室或片区',
  '承办形式',
  '处置方式',
  '处置形态',
  '处置（核实）结果',
  '是否办结',
  '是否超期',
  '领导签批',
  '签批情况',
  '性别',
]

function formatSize(size: number | null): string {
  if (!size) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

async function loadOptions(): Promise<void> {
  await Promise.all(
    DICT_CLASSES.map(async (name) => {
      const res = await window.api.dict.options(name)
      if (res?.ok) options[name] = res.data
    }),
  )
}

async function loadComplaint(): Promise<void> {
  const res = await window.api.complaints.get(code.value)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '加载失败')
    return
  }
  Object.assign(form, res.data)
  assignDepts.value = String(form.AssignDept ?? '').split(',').filter(Boolean)
  undertakeDepts.value = String(form.UndertakeDept ?? '').split(',').filter(Boolean)
}

async function loadAttachments(): Promise<void> {
  if (!code.value) return
  const res = await window.api.attachments.list(code.value)
  if (res?.ok) attachments.value = res.data
}

async function save(): Promise<void> {
  if (!form.ReceiveTime) {
    ElMessage.warning('请填写接收时间')
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    payload.Category = isClue.value ? '0' : '1'
    if (isClue.value) payload.ParentCode = null
    payload.AssignDept = assignDepts.value.join(',')
    payload.UndertakeDept = undertakeDepts.value.join(',')
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = null
    }
    payload.OriginalCode = form.OriginalCode
    const res = await window.api.complaints.save({ isNew: isNew.value, data: payload })
    if (!res?.ok) {
      ElMessage.error(res?.error ?? '保存失败')
      return
    }
    ElMessage.success(isNew.value ? '新增成功' : '保存成功')
    router.replace(isClue.value ? '/clues' : '/complaints')
  } finally {
    saving.value = false
  }
}

async function upload(): Promise<void> {
  if (isNew.value) {
    ElMessage.warning('请先保存信访记录，再上传附件')
    return
  }
  const picked = await window.api.attachments.pick()
  if (!picked?.ok || !picked.data?.length) return
  const files = picked.data.map((filePath: string) => ({
    path: filePath,
    name: filePath.split(/[\\/]/).pop(),
    size: 0,
    type: (filePath.split('.').pop() ?? '').toUpperCase(),
  }))
  const res = await window.api.attachments.add({ code: form.OriginalCode, files })
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '上传失败')
    return
  }
  ElMessage.success('上传成功')
  loadAttachments()
}

async function download(): Promise<void> {
  const res = await window.api.attachments.download(checked.value.map((item) => item.Id))
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '下载失败')
    return
  }
  if (res.data > 0) ElMessage.success(`已导出 ${res.data} 个附件`)
}

async function removeAttachments(): Promise<void> {
  const res = await window.api.attachments.remove(checked.value.map((item) => item.Id))
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '删除失败')
    return
  }
  ElMessage.success('已删除')
  loadAttachments()
}

function onAttachSelect(list: Attachment[]): void {
  checked.value = list
}

function goBack(): void {
  router.push(isClue.value ? '/clues' : '/complaints')
}

onMounted(async () => {
  await loadOptions()
  if (!isClue.value) {
    const res = await window.api.complaints.clueOptions()
    if (res?.ok) clueChoices.value = res.data
    const fromQuery = route.query.clue
    if (isNew.value && typeof fromQuery === 'string') form.ParentCode = fromQuery
  }
  if (isNew.value) {
    const res = await window.api.complaints.nextCode()
    if (res?.ok) form.OriginalCode = res.data
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    form.ReceiveTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  } else {
    await loadComplaint()
    await loadAttachments()
  }
})
</script>

<style scoped>
.page {
  padding: 1.5rem 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.block {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 0.875rem 1rem 0.5rem;
  margin-bottom: 0.875rem;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.block-title {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ink);
  border-left: 2px solid var(--harbor);
  padding-left: 0.5rem;
}

.block-title.no-border {
  border-left: none;
  padding-left: 0;
  margin-bottom: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 1rem;
}

.span-2 { grid-column: span 2; }
.span-3 { grid-column: 1 / -1; }

.fill { width: 100%; }

.attach-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.attach-count {
  font-size: 0.8125rem;
  color: var(--ink-3);
}

.empty {
  color: var(--ink-3);
  font-size: 0.875rem;
  padding: 0.75rem 0;
}

@media (max-width: 72rem) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
