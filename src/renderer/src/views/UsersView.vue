<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">用户管理</h1>
        <p class="page-subtitle">{{ deleted ? '回收站' : `合计 ${rows.length} 个账户` }}</p>
      </div>
      <div class="head-actions">
        <el-button :icon="RefreshLeft" @click="toggleRecycle">{{ deleted ? '返回列表' : '回收站' }}</el-button>
        <el-button v-if="!deleted" type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
      </div>
    </header>

    <section class="block">
      <el-table :data="rows" border stripe size="small">
        <el-table-column prop="Username" label="用户名" min-width="120" />
        <el-table-column prop="RealName" label="姓名" min-width="110" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <span class="pill" :class="row.Role === 'Admin' ? 'pill-admin' : 'pill-muted'">
              {{ row.Role === 'Admin' ? '管理员' : '普通用户' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="Department" label="部门" min-width="130" show-overflow-tooltip />
        <el-table-column prop="Phone" label="联系电话" width="130" />
        <el-table-column prop="Email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <span :class="['dot', row.IsActive ? 'on' : 'off']" />{{ row.IsActive ? '启用' : '停用' }}
          </template>
        </el-table-column>
        <el-table-column prop="LastLoginTime" label="最后登录" width="160" class-name="cell-mono">
          <template #default="{ row }">{{ row.LastLoginTime || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <template v-if="deleted">
              <el-button link type="primary" @click="restore(row)">恢复</el-button>
            </template>
            <template v-else>
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button link type="primary" @click="openReset(row)">重置密码</el-button>
              <el-button link type="danger" :disabled="row.Username === 'admin'" @click="remove(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑用户' : '新增用户'" width="32rem" destroy-on-close>
      <el-form ref="formRef" :model="form" label-width="6.5rem">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" :disabled="editing" />
        </el-form-item>
        <el-form-item v-if="!editing" label="密码" required>
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" required><el-input v-model="form.realName" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" class="fill">
            <el-option label="普通用户" value="User" />
            <el-option label="管理员" value="Admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门"><el-input v-model="form.department" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetVisible" title="重置密码" width="26rem" destroy-on-close>
      <p class="reset-hint">
        为 <strong>{{ resetTarget?.RealName }}</strong>（{{ resetTarget?.Username }}）设置新密码
      </p>
      <el-input v-model="newPassword" type="password" show-password placeholder="新密码" />
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReset">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshLeft } from '@element-plus/icons-vue'

type UserRow = {
  Id: number
  Username: string
  RealName: string
  Role: string
  Department: string | null
  Email: string | null
  Phone: string | null
  IsActive: number
  LastLoginTime: string | null
}

const rows = ref<UserRow[]>([])
const deleted = ref(false)
const dialogVisible = ref(false)
const resetVisible = ref(false)
const saving = ref(false)
const editing = ref<UserRow | null>(null)
const resetTarget = ref<UserRow | null>(null)
const newPassword = ref('')
const formRef = ref()

const form = reactive({
  username: '',
  password: '',
  realName: '',
  role: 'User',
  department: '',
  email: '',
  phone: '',
  isActive: true,
})

async function load(): Promise<void> {
  const res = await window.api.users.list({ deleted: deleted.value })
  if (res?.ok) rows.value = res.data
}

function openCreate(): void {
  editing.value = null
  Object.assign(form, {
    username: '',
    password: '',
    realName: '',
    role: 'User',
    department: '',
    email: '',
    phone: '',
    isActive: true,
  })
  dialogVisible.value = true
}

function openEdit(row: UserRow): void {
  editing.value = row
  Object.assign(form, {
    username: row.Username,
    password: '',
    realName: row.RealName,
    role: row.Role,
    department: row.Department ?? '',
    email: row.Email ?? '',
    phone: row.Phone ?? '',
    isActive: row.IsActive === 1,
  })
  dialogVisible.value = true
}

function openReset(row: UserRow): void {
  resetTarget.value = row
  newPassword.value = ''
  resetVisible.value = true
}

async function submit(): Promise<void> {
  if (!form.username.trim() || !form.realName.trim()) {
    ElMessage.warning('用户名与姓名不能为空')
    return
  }
  if (!editing.value && !form.password) {
    ElMessage.warning('请设置初始密码')
    return
  }
  saving.value = true
  try {
    const res = await window.api.users.save({
      id: editing.value?.Id,
      username: form.username.trim(),
      password: form.password || undefined,
      realName: form.realName.trim(),
      role: form.role,
      department: form.department,
      email: form.email,
      phone: form.phone,
      isActive: form.isActive ? 1 : 0,
    })
    if (!res?.ok) {
      ElMessage.error(res?.error ?? '保存失败')
      return
    }
    ElMessage.success('已保存')
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function submitReset(): Promise<void> {
  if (!newPassword.value) {
    ElMessage.warning('请输入新密码')
    return
  }
  saving.value = true
  try {
    const res = await window.api.users.resetPassword({ id: resetTarget.value!.Id, password: newPassword.value })
    if (!res?.ok) {
      ElMessage.error(res?.error ?? '重置失败')
      return
    }
    ElMessage.success('密码已重置')
    resetVisible.value = false
  } finally {
    saving.value = false
  }
}

function toggleRecycle(): void {
  deleted.value = !deleted.value
  load()
}

async function restore(row: UserRow): Promise<void> {
  const res = await window.api.users.restore(row.Id)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '恢复失败')
    return
  }
  ElMessage.success('已恢复')
  load()
}

async function remove(row: UserRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.RealName}」？`, '删除用户', { type: 'warning' })
  } catch {
    return
  }
  const res = await window.api.users.remove(row.Id)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '删除失败')
    return
  }
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<style scoped>
.head-actions {
  display: flex;
  gap: 0.5rem;
}

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
  padding: 0.5rem;
}

.dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  margin-right: 0.375rem;
  vertical-align: middle;
}

.dot.on { background: var(--ok); }
.dot.off { background: var(--rule-2); }

.reset-hint {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--ink-2);
}

.fill { width: 100%; }
</style>
