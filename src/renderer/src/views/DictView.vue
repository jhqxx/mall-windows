<template>
  <div class="page">
    <h2 class="page-title">枚举管理</h2>
    <p class="page-subtitle">一个字典下最多两层：父项 → 子项；表单里对应树形下拉</p>

    <div class="dict-layout">
      <el-card class="section-card type-card" shadow="never">
        <template #header>
          <div class="card-head">
            <span class="section-title">字典</span>
            <el-button link type="primary" :icon="Plus" @click="openTypeDialog()">新增</el-button>
          </div>
        </template>

        <ul class="pick-list">
          <li
            v-for="item in types"
            :key="item.id"
            class="pick-item"
            :class="{ active: item.code === activeCode }"
            @click="selectType(item.code)"
          >
            <div class="pick-main">
              <span class="pick-name">{{ item.name }}</span>
              <span class="pick-count mono">{{ item.item_count }}</span>
            </div>
            <div class="pick-sub">
              <span class="pick-meta mono">{{ item.code }}</span>
              <span class="pick-ops">
                <el-tag v-if="item.builtin" size="small" effect="plain">内置</el-tag>
                <el-button v-else link type="danger" @click.stop="removeType(item)">删除</el-button>
              </span>
            </div>
          </li>
          <li v-if="!types.length" class="pick-empty mono">NO DICTIONARY</li>
        </ul>
      </el-card>

      <el-card class="section-card item-card" shadow="never">
        <template #header>
          <div class="card-head">
            <div class="card-title">
              <span class="section-title">{{ activeType?.name || '枚举项' }}</span>
              <span v-if="activeType" class="hint mono">{{ activeType.code }}</span>
            </div>
            <div class="card-actions">
              <el-button :icon="Refresh" @click="loadItems">刷新</el-button>
              <el-button type="primary" :icon="Plus" :disabled="!activeType" @click="openItemDialog()">
                新增父项
              </el-button>
            </div>
          </div>
        </template>

        <el-table
          v-loading="loading"
          :data="items"
          row-key="id"
          :tree-props="{ children: 'children' }"
          default-expand-all
          border
          stripe
        >
          <el-table-column label="显示名称" min-width="190">
            <template #default="{ row }">
              <div class="cell-label">{{ row.label }}</div>
              <div v-if="row.remark" class="cell-note">{{ row.remark }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="value" label="存储值" min-width="150" class-name="cell-mono" />
          <el-table-column prop="sort_no" label="排序" width="60" align="center" class-name="cell-mono" />
          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled === 1"
                size="small"
                @change="(value: string | number | boolean) => toggleItem(row, Boolean(value))"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="196" class-name="cell-actions">
            <template #default="{ row }">
              <el-button v-if="row.parent_id === null" link type="primary" @click="openItemDialog(undefined, row)">
                子项
              </el-button>
              <el-button link type="primary" @click="openItemDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeItem(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-state"><span>EMPTY</span><p>该字典还没有枚举项</p></div>
          </template>
        </el-table>

        <p class="table-foot">共 {{ totalItems }} 项（含子项）</p>
      </el-card>
    </div>

    <el-dialog v-model="typeDialog.visible" :title="typeDialog.id ? '编辑字典' : '新增字典'" width="30rem">
      <el-form ref="typeFormRef" :model="typeDialog.form" :rules="typeRules" label-width="6.5rem">
        <el-form-item label="字典名称" prop="name">
          <el-input v-model="typeDialog.form.name" maxlength="30" placeholder="例如：业务科室" />
        </el-form-item>
        <el-form-item label="字典编码" prop="code">
          <el-input
            v-model="typeDialog.form.code"
            class="mono"
            maxlength="30"
            :disabled="Boolean(typeDialog.id)"
            placeholder="小写字母开头，如 dept_type"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="typeDialog.form.remark" type="textarea" :rows="2" maxlength="120" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="typeDialog.saving" @click="submitType">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="itemDialog.visible"
      :title="dialogTitle"
      width="30rem"
    >
      <el-form ref="itemFormRef" :model="itemDialog.form" :rules="itemRules" label-width="6.5rem">
        <el-form-item v-if="itemDialog.parentLabel" label="上级项">
          <span class="parent-ref">{{ itemDialog.parentLabel }}</span>
        </el-form-item>
        <el-form-item label="显示名称" prop="label">
          <el-input v-model="itemDialog.form.label" maxlength="40" placeholder="下拉框里看到的文字" />
        </el-form-item>
        <el-form-item label="存储值" prop="value">
          <el-input v-model="itemDialog.form.value" class="mono" maxlength="40" placeholder="留空则与名称一致" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemDialog.form.sortNo" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="itemDialog.form.enabled" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemDialog.form.remark" type="textarea" :rows="2" maxlength="120" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="itemDialog.saving" @click="submitItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'

type DictType = {
  id: number
  code: string
  name: string
  remark: string | null
  builtin: number
  item_count: number
}

type DictItem = {
  id: number
  type_code: string
  parent_id: number | null
  label: string
  value: string
  sort_no: number
  enabled: number
  remark: string | null
  children?: DictItem[]
}

const types = ref<DictType[]>([])
const items = ref<DictItem[]>([])
const activeCode = ref('')
const loading = ref(false)

const activeType = computed(() => types.value.find((item) => item.code === activeCode.value))
const totalItems = computed(() =>
  items.value.reduce((sum, row) => sum + 1 + (row.children?.length ?? 0), 0)
)

const typeFormRef = ref<FormInstance>()
const itemFormRef = ref<FormInstance>()

const typeRules: FormRules = {
  name: [{ required: true, message: '请填写字典名称', trigger: 'blur' }],
  code: [
    { required: true, message: '请填写字典编码', trigger: 'blur' },
    {
      pattern: /^[a-z][a-z0-9_]{1,29}$/,
      message: '小写字母开头，可含小写字母、数字、下划线',
      trigger: 'blur'
    }
  ]
}

const itemRules: FormRules = {
  label: [{ required: true, message: '请填写显示名称', trigger: 'blur' }]
}

const typeDialog = reactive({
  visible: false,
  saving: false,
  id: 0,
  form: { code: '', name: '', remark: '' }
})

const itemDialog = reactive({
  visible: false,
  saving: false,
  id: 0,
  parentId: null as number | null,
  parentLabel: '',
  form: { label: '', value: '', sortNo: 0, enabled: true, remark: '' }
})

const dialogTitle = computed(() => {
  if (itemDialog.id) return '编辑枚举项'
  return itemDialog.parentId ? '新增子项' : '新增父项'
})

async function loadTypes(): Promise<void> {
  const res = await window.api.dict.types()
  if (!res?.ok) return
  types.value = res.rows
  if (!types.value.some((item) => item.code === activeCode.value)) {
    activeCode.value = types.value[0]?.code ?? ''
  }
}

async function loadItems(): Promise<void> {
  if (!activeCode.value) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const res = await window.api.dict.items({ typeCode: activeCode.value })
    if (res?.ok) items.value = res.rows
  } finally {
    loading.value = false
  }
}

async function refreshAll(): Promise<void> {
  await loadTypes()
  await loadItems()
}

function selectType(code: string): void {
  activeCode.value = code
  loadItems()
}

function openTypeDialog(row?: DictType): void {
  typeDialog.id = row?.id ?? 0
  typeDialog.form = row
    ? { code: row.code, name: row.name, remark: row.remark ?? '' }
    : { code: '', name: '', remark: '' }
  typeDialog.visible = true
}

async function submitType(): Promise<void> {
  if (!typeFormRef.value) return
  const valid = await typeFormRef.value.validate().catch(() => false)
  if (!valid) return
  typeDialog.saving = true
  try {
    const res = await window.api.dict.saveType({
      id: typeDialog.id || undefined,
      code: typeDialog.form.code.trim(),
      name: typeDialog.form.name.trim(),
      remark: typeDialog.form.remark.trim()
    })
    if (!res?.ok) {
      ElMessage.error(res?.message || '保存失败')
      return
    }
    ElMessage.success('已保存')
    typeDialog.visible = false
    if (res.data?.code) activeCode.value = res.data.code
    await refreshAll()
  } finally {
    typeDialog.saving = false
  }
}

async function removeType(row: DictType): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除字典「${row.name}」及其下全部枚举项？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await window.api.dict.removeType({ id: row.id })
  if (!res?.ok) {
    ElMessage.error(res?.message || '删除失败')
    return
  }
  ElMessage.success('已删除')
  await refreshAll()
}

function openItemDialog(row?: DictItem, parent?: DictItem): void {
  itemDialog.id = row?.id ?? 0
  itemDialog.parentId = row?.parent_id ?? parent?.id ?? null
  itemDialog.parentLabel = parent?.label ?? ''
  itemDialog.form = row
    ? {
        label: row.label,
        value: row.value,
        sortNo: row.sort_no,
        enabled: row.enabled === 1,
        remark: row.remark ?? ''
      }
    : { label: '', value: '', sortNo: (parent?.children?.length ?? items.value.length) + 1, enabled: true, remark: '' }
  itemDialog.visible = true
}

async function submitItem(): Promise<void> {
  if (!itemFormRef.value) return
  const valid = await itemFormRef.value.validate().catch(() => false)
  if (!valid) return
  itemDialog.saving = true
  try {
    const res = await window.api.dict.saveItem({
      id: itemDialog.id || undefined,
      typeCode: activeCode.value,
      parentId: itemDialog.parentId,
      label: itemDialog.form.label.trim(),
      value: itemDialog.form.value.trim(),
      sortNo: itemDialog.form.sortNo,
      enabled: itemDialog.form.enabled,
      remark: itemDialog.form.remark.trim()
    })
    if (!res?.ok) {
      ElMessage.error(res?.message || '保存失败')
      return
    }
    ElMessage.success('已保存')
    itemDialog.visible = false
    await loadTypes()
    await loadItems()
  } finally {
    itemDialog.saving = false
  }
}

async function toggleItem(row: DictItem, enabled: boolean): Promise<void> {
  const res = await window.api.dict.saveItem({
    id: row.id,
    typeCode: row.type_code,
    parentId: row.parent_id,
    label: row.label,
    value: row.value,
    sortNo: row.sort_no,
    enabled,
    remark: row.remark
  })
  if (!res?.ok) {
    ElMessage.error(res?.message || '状态更新失败')
    return
  }
  ElMessage.success(enabled ? '已启用' : '已停用')
  await loadItems()
}

async function removeItem(row: DictItem): Promise<void> {
  const hint = row.children?.length ? `，同时删除 ${row.children.length} 个子项` : ''
  try {
    await ElMessageBox.confirm(`删除枚举项「${row.label}」${hint}？已经保存的单据不受影响`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await window.api.dict.removeItem({ id: row.id })
  if (!res?.ok) {
    ElMessage.error(res?.message || '删除失败')
    return
  }
  ElMessage.success('已删除')
  await refreshAll()
}

onMounted(refreshAll)
</script>

<style scoped>
.dict-layout {
  display: grid;
  grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.card-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint {
  font-size: 0.6875rem;
  letter-spacing: 0.02em;
  color: var(--ink-3);
}

.pick-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.pick-item {
  padding: 0.5rem 0.625rem;
  border-radius: var(--r-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.pick-item:hover {
  background: var(--surface-alt);
}

.pick-item:hover .pick-ops {
  opacity: 1;
}

.pick-item.active {
  background: var(--surface-alt);
  border-color: var(--rule-2);
}

.pick-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink);
}

.pick-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-count {
  flex: none;
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.pick-sub {
  position: relative;
  display: flex;
  align-items: center;
  margin-top: 0.125rem;
  min-height: 1.25rem;
}

.pick-meta {
  font-size: 0.6875rem;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-ops {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-left: 0.5rem;
  background: var(--surface);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.pick-item.active .pick-ops {
  background: var(--surface-alt);
}

.pick-item:focus-within .pick-ops {
  opacity: 1;
}

.pick-empty {
  padding: 1.25rem 0;
  text-align: center;
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  color: var(--ink-3);
}

.table-foot {
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  color: var(--ink-3);
}

.cell-label {
  color: var(--ink);
}

.cell-note {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--ink-3);
  line-height: 1.3;
}

.parent-ref {
  font-size: 0.875rem;
  color: var(--ink-2);
}

@media (max-width: 56rem) {
  .dict-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .pick-ops {
    position: static;
    opacity: 1;
  }
}

:deep(.cell-mono) {
  font-family: var(--mono);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

:deep(.mono input),
.mono :deep(input) {
  font-family: var(--mono);
}

:deep(.cell-actions .cell) {
  white-space: nowrap;
}

:deep(.cell-actions .el-button + .el-button) {
  margin-left: 0.5rem;
}
</style>
