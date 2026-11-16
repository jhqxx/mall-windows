<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">基础字典</h1>
        <p class="page-subtitle">{{ classes.length }} 个字典分类 · {{ totalItems }} 个字典项</p>
      </div>
    </header>

    <div class="layout">
      <section class="pane pane-left">
        <header class="pane-head">
          <span class="pane-title">字典分类</span>
          <el-button link type="primary" :icon="Plus" @click="openClassCreate">新增</el-button>
        </header>
        <ul class="class-list">
          <li
            v-for="item in classes"
            :key="item.Id"
            :class="['class-item', { active: item.Id === activeId }]"
            @click="selectClass(item.Id)"
          >
            <div class="class-main">
              <span class="class-name">{{ item.ClassName }}</span>
              <span class="class-count mono">{{ item.itemCount }}</span>
            </div>
            <span class="class-desc">{{ item.Description || '—' }}</span>
            <div class="class-actions">
              <el-button link type="primary" @click.stop="openClassEdit(item)">编辑</el-button>
              <el-button link type="danger" @click.stop="removeClass(item)">删除</el-button>
            </div>
          </li>
          <li v-if="!classes.length" class="class-empty">暂无字典分类</li>
        </ul>
      </section>

      <section class="pane pane-right">
        <header class="pane-head">
          <span class="pane-title">{{ activeClass?.ClassName || '字典项' }}</span>
          <el-button type="primary" size="small" :icon="Plus" :disabled="!activeId" @click="openItemCreate">
            新增字典项
          </el-button>
        </header>
        <el-table :data="items" border stripe size="small">
          <el-table-column prop="ItemKey" label="键值" min-width="120" class-name="cell-mono" />
          <el-table-column prop="ItemValue" label="显示值" min-width="160" />
          <el-table-column prop="SortOrder" label="排序" width="70" align="center" />
          <el-table-column prop="Description" label="说明" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">{{ row.Description || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="openItemEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="removeItem(row)">删除</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <div class="empty">该字典下暂无字典项</div>
          </template>
        </el-table>
      </section>
    </div>

    <el-dialog v-model="classDialog" :title="classForm.id ? '编辑字典分类' : '新增字典分类'" width="28rem" destroy-on-close>
      <el-form :model="classForm" label-width="5.5rem">
        <el-form-item label="字典名称" required>
          <el-input v-model="classForm.className" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="classForm.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitClass">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialog" :title="itemForm.id ? '编辑字典项' : '新增字典项'" width="30rem" destroy-on-close>
      <el-form :model="itemForm" label-width="5.5rem">
        <el-form-item label="键值" required>
          <el-input v-model="itemForm.itemKey" placeholder="如 XS1001" />
        </el-form-item>
        <el-form-item label="显示值" required>
          <el-input v-model="itemForm.itemValue" placeholder="如 基层报送" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sortOrder" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="itemForm.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitItem">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

type DictClass = {
  Id: number
  ClassName: string
  Description: string | null
  itemCount: number
}

type DictItem = {
  Id: number
  ClassId: number
  ItemKey: string
  ItemValue: string
  SortOrder: number
  Description: string | null
}

const classes = ref<DictClass[]>([])
const items = ref<DictItem[]>([])
const activeId = ref<number | null>(null)
const classDialog = ref(false)
const itemDialog = ref(false)
const saving = ref(false)

const classForm = reactive({ id: 0, className: '', description: '' })
const itemForm = reactive({ id: 0, itemKey: '', itemValue: '', sortOrder: 0, description: '' })

const activeClass = computed(() => classes.value.find((item) => item.Id === activeId.value) ?? null)
const totalItems = computed(() => classes.value.reduce((sum, item) => sum + item.itemCount, 0))

async function loadClasses(keepId?: number): Promise<void> {
  const res = await window.api.dict.classes()
  if (!res?.ok) return
  classes.value = res.data
  const next = keepId ?? activeId.value ?? res.data[0]?.Id ?? null
  if (next) selectClass(next)
  else {
    activeId.value = null
    items.value = []
  }
}

async function loadItems(): Promise<void> {
  if (!activeId.value) return
  const res = await window.api.dict.items(activeId.value)
  if (res?.ok) items.value = res.data
}

function selectClass(id: number): void {
  activeId.value = id
  loadItems()
}

function openClassCreate(): void {
  Object.assign(classForm, { id: 0, className: '', description: '' })
  classDialog.value = true
}

function openClassEdit(row: DictClass): void {
  Object.assign(classForm, { id: row.Id, className: row.ClassName, description: row.Description ?? '' })
  classDialog.value = true
}

async function submitClass(): Promise<void> {
  if (!classForm.className.trim()) {
    ElMessage.warning('字典名称不能为空')
    return
  }
  saving.value = true
  try {
    const res = await window.api.dict.saveClass({
      id: classForm.id || undefined,
      className: classForm.className.trim(),
      description: classForm.description,
    })
    if (!res?.ok) {
      ElMessage.error(res?.error ?? '保存失败')
      return
    }
    ElMessage.success('已保存')
    classDialog.value = false
    await loadClasses(classForm.id || res.data)
  } finally {
    saving.value = false
  }
}

async function removeClass(row: DictClass): Promise<void> {
  try {
    await ElMessageBox.confirm(`删除字典「${row.ClassName}」会同时删除其下 ${row.itemCount} 个字典项，确认继续？`, '删除字典', {
      type: 'warning',
    })
  } catch {
    return
  }
  const res = await window.api.dict.removeClass(row.Id)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '删除失败')
    return
  }
  ElMessage.success('已删除')
  if (activeId.value === row.Id) activeId.value = null
  await loadClasses()
}

function openItemCreate(): void {
  Object.assign(itemForm, { id: 0, itemKey: '', itemValue: '', sortOrder: 0, description: '' })
  itemDialog.value = true
}

function openItemEdit(row: DictItem): void {
  Object.assign(itemForm, {
    id: row.Id,
    itemKey: row.ItemKey,
    itemValue: row.ItemValue,
    sortOrder: row.SortOrder,
    description: row.Description ?? '',
  })
  itemDialog.value = true
}

async function submitItem(): Promise<void> {
  if (!activeId.value) return
  if (!itemForm.itemKey.trim() || !itemForm.itemValue.trim()) {
    ElMessage.warning('键值与显示值不能为空')
    return
  }
  saving.value = true
  try {
    const res = await window.api.dict.saveItem({
      id: itemForm.id || undefined,
      classId: activeId.value,
      itemKey: itemForm.itemKey.trim(),
      itemValue: itemForm.itemValue.trim(),
      sortOrder: itemForm.sortOrder,
      description: itemForm.description,
    })
    if (!res?.ok) {
      ElMessage.error(res?.error ?? '保存失败')
      return
    }
    ElMessage.success('已保存')
    itemDialog.value = false
    await Promise.all([loadItems(), loadClasses(activeId.value ?? undefined)])
  } finally {
    saving.value = false
  }
}

async function removeItem(row: DictItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除字典项「${row.ItemValue}」？`, '删除字典项', { type: 'warning' })
  } catch {
    return
  }
  const res = await window.api.dict.removeItem(row.Id)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '删除失败')
    return
  }
  ElMessage.success('已删除')
  await Promise.all([loadItems(), loadClasses(activeId.value ?? undefined)])
}

onMounted(() => loadClasses())
</script>

<style scoped>
.page {
  padding: 1.5rem 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100%;
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

.layout {
  display: grid;
  grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.pane {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 0.75rem;
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.625rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--rule);
}

.pane-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ink);
}

.class-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.class-item {
  padding: 0.5rem 0.625rem;
  border-radius: var(--r-sm);
  cursor: pointer;
  border: 1px solid transparent;
}

.class-item:hover {
  background: var(--surface-alt);
}

.class-item.active {
  background: #eaf2f9;
  border-color: #c9dcee;
}

.class-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.class-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink);
}

.class-count {
  font-size: 0.75rem;
  color: var(--ink-3);
}

.class-desc {
  display: block;
  font-size: 0.75rem;
  color: var(--ink-3);
  margin-top: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.class-actions {
  display: none;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.class-item:hover .class-actions {
  display: flex;
}

.class-empty,
.empty {
  color: var(--ink-3);
  font-size: 0.875rem;
  padding: 0.75rem 0;
  text-align: center;
}

@media (max-width: 64rem) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
