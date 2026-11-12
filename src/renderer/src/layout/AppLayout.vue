<template>
  <el-container class="shell">
    <el-aside width="212px" class="sidebar">
      <div class="logo">
        <div class="logo-badge">MD</div>
        <div class="logo-text">
          <strong>Mall Desktop</strong>
          <span>案件办理工作台</span>
        </div>
      </div>

      <el-menu :default-active="activePath" router class="menu" background-color="#1f2a3c" text-color="#c4cdda"
        active-text-color="#ffffff">
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/cases/new">
          <el-icon><DocumentAdd /></el-icon>
          <span>案件录入</span>
        </el-menu-item>
        <el-menu-item index="/cases">
          <el-icon><Files /></el-icon>
          <span>案件列表</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><Tickets /></el-icon>
          <span>操作日志</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <span>v{{ version }}</span>
        <span>{{ platformLabel }}</span>
      </div>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div class="crumb">
          <span class="crumb-app">Mall Desktop</span>
          <el-icon class="crumb-sep"><ArrowRight /></el-icon>
          <span class="crumb-current">{{ currentTitle }}</span>
        </div>
        <el-dropdown trigger="click" @command="handleCommand">
          <span class="user-chip">
            <el-avatar :size="28" class="avatar">{{ initial }}</el-avatar>
            <span class="user-name">{{ session.user?.displayName }}</span>
            <el-tag size="small" effect="plain">{{ session.user?.role === 'admin' ? '管理员' : session.user?.role }}</el-tag>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>账号：{{ session.user?.username }}</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { setUser, session } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const version = ref('0.1.0')
const platform = ref('')

const activePath = computed(() => (route.path.startsWith('/cases/new') ? '/cases/new' : route.path))

const titles: Record<string, string> = {
  '/dashboard': '工作台',
  '/cases/new': '案件录入',
  '/cases': '案件列表',
  '/logs': '操作日志'
}
const currentTitle = computed(() => titles[route.path] ?? '工作台')
const initial = computed(() => (session.user?.displayName ?? 'U').slice(0, 1))
const platformLabel = computed(() =>
  platform.value === 'darwin' ? 'macOS' : platform.value === 'win32' ? 'Windows' : platform.value
)

onMounted(async () => {
  const meta = await window.api.app.meta()
  if (meta?.ok) {
    version.value = meta.version
    platform.value = meta.platform
  }
})

async function handleCommand(command: string): Promise<void> {
  if (command !== 'logout') return
  try {
    await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await window.api.auth.logout()
  setUser(null)
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<style scoped>
.shell {
  height: 100vh;
}

.sidebar {
  background: #1f2a3c;
  display: flex;
  flex-direction: column;
  color: #c4cdda;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.logo-badge {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, #409eff, #2f6fe4);
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.logo-text strong {
  color: #fff;
  font-size: 14px;
  letter-spacing: 0.3px;
}

.logo-text span {
  font-size: 11px;
  color: #7d8ca3;
}

.menu {
  border-right: none;
  flex: 1;
  padding-top: 8px;
}

.menu :deep(.el-menu-item) {
  height: 44px;
  margin: 4px 10px;
  border-radius: 8px;
}

.menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.07);
}

.menu :deep(.el-menu-item.is-active) {
  background: var(--el-color-primary);
}

.sidebar-footer {
  display: flex;
  justify-content: space-between;
  padding: 12px 18px;
  font-size: 11px;
  color: #6b7a91;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  height: 56px;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #909399;
}

.crumb-app {
  color: #606266;
}

.crumb-sep {
  font-size: 11px;
}

.crumb-current {
  color: #303133;
  font-weight: 600;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background 0.2s;
}

.user-chip:hover {
  background: #f5f7fa;
}

.avatar {
  background: #409eff;
  font-size: 12px;
}

.user-name {
  font-size: 13px;
  color: #303133;
}

.main {
  background: #f4f6fa;
  padding: 0;
  overflow-y: auto;
}
</style>
