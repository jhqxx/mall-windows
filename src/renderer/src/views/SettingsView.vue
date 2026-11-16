<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">系统设置</h1>
        <p class="page-subtitle">数据库文件与附件目录的位置，可在本机任意磁盘间迁移</p>
      </div>
      <div class="head-actions">
        <el-button :icon="RefreshLeft" @click="resetDefaults">恢复默认</el-button>
        <el-button type="primary" :icon="Check" :loading="saving" @click="save">保存并应用</el-button>
      </div>
    </header>

    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">数据库文件</h2>
        <span class="state" :class="dbChanged ? 'state-warn' : 'state-ok'">
          {{ dbChanged ? '已改动，未应用' : '正在使用' }}
        </span>
      </div>
      <el-input v-model="form.dbPath" class="path" readonly placeholder="未设置">
        <template #append>
          <el-button :icon="FolderOpened" @click="pick('db')">选择目录</el-button>
        </template>
      </el-input>
      <p class="hint">默认 {{ defaults.dbPath }}</p>
      <el-checkbox v-model="form.copyData" :disabled="!dbChanged">
        迁移时复制当前数据库到新位置（不勾选则在新位置建一个空库）
      </el-checkbox>
    </section>

    <section class="panel">
      <div class="panel-head">
        <h2 class="panel-title">附件目录</h2>
        <span class="state" :class="dirChanged ? 'state-warn' : 'state-ok'">
          {{ dirChanged ? '已改动，未应用' : '正在使用' }}
        </span>
      </div>
      <el-input v-model="form.attachmentsDir" class="path" readonly placeholder="未设置">
        <template #append>
          <el-button :icon="FolderOpened" @click="pick('attachments')">选择目录</el-button>
        </template>
      </el-input>
      <p class="hint">默认 {{ defaults.attachmentsDir }}</p>
      <p class="hint">新上传的附件保存到该目录；已有记录里的绝对路径不受影响，仍可打开。</p>
    </section>

    <section class="panel panel-meta">
      <h2 class="panel-title">运行环境</h2>
      <dl class="meta">
        <div><dt>应用数据目录</dt><dd class="mono">{{ userData || '—' }}</dd></div>
        <div><dt>版本</dt><dd class="mono">{{ meta.version || '—' }}</dd></div>
        <div><dt>Electron</dt><dd class="mono">{{ meta.electron || '—' }}</dd></div>
        <div><dt>SQLite 驱动</dt><dd class="mono">{{ meta.driver || '—' }}</dd></div>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, FolderOpened, RefreshLeft } from '@element-plus/icons-vue'

const saving = ref(false)
const userData = ref('')
const meta = reactive<Record<string, string>>({})
const defaults = reactive({ dbPath: '', attachmentsDir: '' })
const current = reactive({ dbPath: '', attachmentsDir: '' })
const form = reactive({ dbPath: '', attachmentsDir: '', copyData: true })

const dbChanged = computed(() => form.dbPath.trim() !== current.dbPath)
const dirChanged = computed(() => form.attachmentsDir.trim() !== current.attachmentsDir)

async function load(): Promise<void> {
  const res = await window.api.settings.get()
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '读取设置失败')
    return
  }
  Object.assign(current, { dbPath: res.data.dbPath, attachmentsDir: res.data.attachmentsDir })
  Object.assign(defaults, res.data.defaults)
  Object.assign(form, { dbPath: res.data.dbPath, attachmentsDir: res.data.attachmentsDir, copyData: true })
  userData.value = res.data.userData
  const info = await window.api.app.meta()
  if (info?.ok) Object.assign(meta, info)
}

async function pick(kind: 'db' | 'attachments'): Promise<void> {
  const res = await window.api.settings.pick(kind)
  if (!res?.ok) {
    ElMessage.error(res?.error ?? '选择目录失败')
    return
  }
  if (!res.data) return
  if (kind === 'db') form.dbPath = res.data
  else form.attachmentsDir = res.data
}

function resetDefaults(): void {
  form.dbPath = defaults.dbPath
  form.attachmentsDir = defaults.attachmentsDir
  form.copyData = false
}

async function save(): Promise<void> {
  saving.value = true
  try {
    const res = await window.api.settings.save({
      dbPath: form.dbPath,
      attachmentsDir: form.attachmentsDir,
      copyData: form.copyData,
    })
    if (!res?.ok) {
      ElMessage.error(res?.error ?? '保存失败')
      return
    }
    Object.assign(current, { dbPath: res.data.dbFile, attachmentsDir: res.data.attachmentsDir })
    Object.assign(form, { dbPath: res.data.dbFile, attachmentsDir: res.data.attachmentsDir })
    ElMessage.success('已应用，数据库已重新连接')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 1.5rem 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  max-width: 62rem;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
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
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-3);
}

.panel {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-md);
  padding: 1rem 1.125rem 1.125rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--ink);
}

.path :deep(.el-input__inner) {
  font-family: var(--mono);
  font-size: 0.8125rem;
}

.hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--ink-3);
}

.state {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  font-size: 0.75rem;
}

.state::before {
  content: '';
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: currentColor;
}

.state-ok {
  color: #14664b;
}

.state-warn {
  color: #9a2c22;
}

.panel-meta .meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1.25rem;
  font-size: 0.8125rem;
}

.panel-meta dt {
  color: var(--ink-3);
  font-size: 0.75rem;
}

.panel-meta dd {
  margin: 0.125rem 0 0;
  color: var(--ink);
  word-break: break-all;
}
</style>
