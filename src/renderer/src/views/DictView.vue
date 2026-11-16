<template>
  <div class="page">
    <h2 class="page-title">枚举管理</h2>
    <p class="page-subtitle">分组 → 字典 → 枚举项，三级维护；停用的项不会出现在下拉框里</p>

    <div class="dict-layout">
      <el-card class="section-card group-card" shadow="never">
        <template #header>
          <div class="card-head">
            <span class="section-title">分组</span>
            <el-button link type="primary" :icon="Plus" @click="openGroupDialog()">新增</el-button>
          </div>
        </template>

        <ul class="pick-list">
          <li
            v-for="group in groups"
            :key="group.id"
            class="pick-item"
            :class="{ active: group.id === activeGroupId }"
            @click="selectGroup(group.id)"
          >
            <div class="pick-main">
              <span class="pick-name">{{ group.name }}</span>
              <span class="pick-count mono">{{ group.type_count }}</span>
            </div>
            <div class="pick-sub">
              <span class="pick-meta">{{ group.remark || '—' }}</span>
              <span class="pick-ops">
                <el-button link type="primary" @click.stop="openGroupDialog(group)">改名</el-button>
                <el-button link type="danger" @click.stop="removeGroup(group)">删除</el-button>
              </span>
            </div>
          </li>
          <li v-if="!groups.length" class="pick-empty mono">NO GROUP</li>
        </ul>
      </el-card>

      <el-card class="section-card type-card" shadow="never">
        <template #header>
          <div class="card-head">
            <span class="section-title">字典类型</span>
            <el-button link type="primary" :icon="Plus" :disabled="!activeGroupId" @click="openTypeDialog()">
              新增
            </el-button>
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
                新增枚举项
              </el-button>
            </div>
          </div>
        </template>

        <el-table v-loading="loading" :data="items" border stripe>
          <el-table-column label="显示名称" min-width="150">
            <template #default="{ row }">
              <div class="cell-label">{{ row.label }}</div>
              <div v-if="row.remark" class="cell-note">{{ row.remark }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="value" label="存储值" min-width="120" class-name="cell-mono" />
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
          <el-table-column label="操作" width="112" class-name="cell-actions">
            <template #default="{ row }">
              <el-button link type="primary" @click="openItemDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="removeItem(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty-state"><span>EMPTY</span><p>该字典还没有枚举项</p></div>
          </template>
        </el-table>

        <p class="table-foot">共 {{ items.length }} 项</p>
      </el-card>
    </div>

    <el-dialog v-model="groupDialog.visible" :title="groupDialog.id ? '编辑分组' : '新增分组'" width="26rem">
      <el-form ref="groupFormRef" :model="groupDialog.form" :rules="groupRules" label-width="5.5rem">
        <el-form-item label="分组名称" prop="name">
          <el-input v-model="groupDialog.form.name" maxlength="20" placeholder="例如：案件业务" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="groupDialog.form.sortNo" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="groupDialog.form.remark" type="textarea" :rows="2" maxlength="120" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="groupDialog.saving" @click="submitGroup">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="typeDialog.visible" :title="typeDialog.id ? '编辑字典类型' : '新增字典类型'" width="30rem">
      <el-form ref="typeFormRef" :model="typeDialog.form" :rules="typeRules" label-width="6.5rem">
        <el-form-item label="所属分组" prop="groupId">
          <el-select v-model="typeDialog.form.groupId" placeholder="选择分组">
            <el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
          </el-select>
        </el-form-item>
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
      :title="itemDialog.id ? '编辑枚举项' : '新增枚举项'"
      width="30rem"
    >
      <el-form ref="itemFormRef" :model="itemDialog.form" :rules="itemRules" label-width="6.5rem">
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

type DictGroup = {
  id: number
  name: string
  sort_no: number
  remark: string | null
  type_count: number
}

type DictType = {
  id: number
  code: string
  name: string
  remark: string | null
  builtin: number
  group_id: number | null
  item_count: number
}

type DictItem = {
  id: number
  type_code: string
  label: string
  value: string
  sort_no: number
  enabled: number
  remark: string | null
}

const groups = ref<DictGroup[]>([])
const types = ref<DictType[]>([])
const items = ref<DictItem[]>([])
const activeGroupId = ref<number | null>(null)
const activeCode = ref('')
const loading = ref(false)

const activeType = computed(() => types.value.find((item) => item.code === activeCode.value))

const groupFormRef = ref<FormInstance>()
const typeFormRef = ref<FormInstance>()
const itemFormRef = ref<FormInstance>()

const groupRules: FormRules = {
  name: [{ required: true, message: '请填写分组名称', trigger: 'blur' }]
}

const typeRules: FormRules = {
  groupId: [{ required: true, message: '请选择所属分组', trigger: 'change' }],
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

const groupDialog = reactive({
  visible: false,
  saving: false,
  id: 0,
  form: { name: '', sortNo: 0, remark: '' }
})

const typeDialog = reactive({
  visible: false,
  saving: false,
  id: 0,
  form: { code: '', name: '', groupId: null as number | null, remark: '' }
})

const itemDialog = reactive({
  visible: false,
  saving: false,
  id: 0,
  form: { label: '', value: '', sortNo: 0, enabled: true, remark: '' }
})

async function loadGroups(): Promise<void> {
  const res = await window.api.dict.groups()
  if (!res?.ok) return
  groups.value = res.rows
  if (!groups.value.some((item) => item.id === activeGroupId.value)) {
    activeGroupId.value = groups.value[0]?.id ?? null
  }
}

async function loadTypes(): Promise<void> {
  if (!activeGroupId.value) {
    types.value = []
    activeCode.value = ''
    return
  }
  const res = await window.api.dict.types({ groupId: activeGroupId.value })
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
  await loadGroups()
  await loadTypes()
  await loadItems()
}

function selectGroup(id: number): void {
  if (activeGroupId.value === id) return
  activeGroupId.value = id
  activeCode.value = ''
  loadTypes().then(loadItems)
}

function selectType(code: string): void {
  activeCode.value = code
  loadItems()
}

function openGroupDialog(row?: DictGroup): void {
  groupDialog.id = row?.id ?? 0
  groupDialog.form = row
    ? { name: row.name, sortNo: row.sort_no, remark: row.remark ?? '' }
    : { name: '', sortNo: groups.value.length + 1, remark: '' }
  groupDialog.visible = true
}

async function submitGroup(): Promise<void> {
  if (!groupFormRef.value) return
  const valid = await groupFormRef.value.validate().catch(() => false)
  if (!valid) return
  groupDialog.saving = true
  try {
    const res = await window.api.dict.saveGroup({
      id: groupDialog.id || undefined,
      name: groupDialog.form.name.trim(),
      sortNo: groupDialog.form.sortNo,
      remark: groupDialog.form.remark.trim()
    })
    if (!res?.ok) {
      ElMessage.error(res?.message || '保存失败')
      return
    }
    ElMessage.success('已保存')
    groupDialog.visible = false
    if (res.data?.id) activeGroupId.value = res.data.id
    await loadGroups()
    await loadTypes()
    await loadItems()
  } finally {
    groupDialog.saving = false
  }
}

async function removeGroup(row: DictGroup): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除分组「${row.name}」？分组下有字典时不能删除`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await window.api.dict.removeGroup({ id: row.id })
  if (!res?.ok) {
    ElMessage.error(res?.message || '删除失败')
    return
  }
  ElMessage.success('已删除')
  await refreshAll()
}

function openTypeDialog(row?: DictType): void {
  typeDialog.id = row?.id ?? 0
  typeDialog.form = row
    ? { code: row.code, name: row.name, groupId: row.group_id, remark: row.remark ?? '' }
    : { code: '', name: '', groupId: activeGroupId.value, remark: '' }
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
      groupId: typeDialog.form.groupId,
      remark: typeDialog.form.remark.trim()
    })
    if (!res?.ok) {
      ElMessage.error(res?.message || '保存失败')
      return
    }
    ElMessage.success('已保存')
    typeDialog.visible = false
    if (res.data?.group_id) activeGroupId.value = res.data.group_id
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

function openItemDialog(row?: DictItem): void {
  itemDialog.id = row?.id ?? 0
  itemDialog.form = row
    ? {
        label: row.label,
        value: row.value,
        sortNo: row.sort_no,
        enabled: row.enabled === 1,
        remark: row.remark ?? ''
      }
    : { label: '', value: '', sortNo: items.value.length + 1, enabled: true, remark: '' }
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
  try {
    await ElMessageBox.confirm(`删除枚举项「${row.label}」？已经保存的单据不受影响`, '删除确认', {
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
  await loadTypes()
  await loadItems()
}

onMounted(refreshAll)
</script>

<style scoped>
.dict-layout {
  display: grid;
  grid-template-columns: minmax(9.5rem, 11.5rem) minmax(11rem, 14rem) minmax(0, 1fr);
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

@media (max-width: 72rem) {
  .dict-layout {
    grid-template-columns: minmax(8.5rem, 10.5rem) minmax(9.5rem, 12rem) minmax(0, 1fr);
    gap: 0.75rem;
  }
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

.cell-label {
  color: var(--ink);
}

.cell-note {
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--ink-3);
  line-height: 1.3;
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
