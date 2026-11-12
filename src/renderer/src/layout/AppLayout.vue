<template>
  <el-container class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="brand-text">
          <strong>Mall Desktop</strong>
          <span>PORT OPS · 案件办理</span>
        </div>
      </div>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: activePath === item.path }"
        >
          <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-foot mono">
        <span>v{{ version }}</span>
        <span>{{ platformLabel }}</span>
      </div>
    </aside>

    <el-container>
      <el-header class="topbar">
        <div class="crumb">
          <span class="crumb-app mono">MALL DESKTOP</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">{{ currentTitle }}</span>
        </div>
        <el-dropdown trigger="click" @command="handleCommand">
          <span class="user-chip">
            <span class="avatar">{{ initial }}</span>
            <span class="user-name">{{ session.user?.displayName }}</span>
            <el-tag size="small" effect="plain" type="info">
              {{ session.user?.role === 'admin' ? '管理员' : session.user?.role }}
            </el-tag>
            <el-icon class="chev"><ArrowDown /></el-icon>
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
import { computed, markRaw, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, DocumentAdd, Files, Odometer, Tickets } from '@element-plus/icons-vue'
import { setUser, session } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const version = ref('0.1.0')
const platform = ref('')

const navItems = [
  { path: '/dashboard', label: '工作台', icon: markRaw(Odometer) },
  { path: '/cases/new', label: '案件录入', icon: markRaw(DocumentAdd) },
  { path: '/cases', label: '案件列表', icon: markRaw(Files) },
  { path: '/logs', label: '操作日志', icon: markRaw(Tickets) }
]

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
  width: 224px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--night);
  border-right: 1px solid var(--night-2);
  color: var(--night-text);
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 18px 18px 16px;
  border-bottom: 1px solid rgba(169, 183, 198, 0.12);
}

.mark {
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 3px;
  padding: 6px;
  border: 1px solid rgba(169, 183, 198, 0.32);
  border-radius: 2px;
  background: rgba(15, 111, 181, 0.14);
}

.mark i {
  display: block;
  background: #6fb3e0;
  border-radius: 1px;
}

.mark i:nth-child(1) {
  background: #8fc7e8;
}

.mark i:nth-child(4) {
  background: rgba(169, 183, 198, 0.45);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.brand-text strong {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #f2f6fa;
}

.brand-text span {
  font-family: var(--mono);
  font-size: 8.5px;
  letter-spacing: 0.12em;
  color: var(--night-muted);
  white-space: nowrap;
}

.nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  padding: 0 10px;
  border-radius: 2px;
  color: var(--night-text);
  font-size: 13px;
  text-decoration: none;
  position: relative;
  transition: color 0.16s ease, background-color 0.16s ease;
}

.nav-item::before {
  content: '';
  width: 3px;
  height: 3px;
  background: #6fb3e0;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.nav-item:hover {
  color: #e8eef4;
  background: rgba(169, 183, 198, 0.08);
}

.nav-item.active {
  color: #ffffff;
  background: rgba(15, 111, 181, 0.22);
  box-shadow: inset 0 0 0 1px rgba(111, 179, 224, 0.18);
}

.nav-item.active::before {
  opacity: 1;
}

.nav-icon {
  font-size: 15px;
  opacity: 0.9;
}

.sidebar-foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 18px 12px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--night-muted);
  border-top: 1px solid rgba(169, 183, 198, 0.12);
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
  padding: 0 24px;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 10px;
}

.crumb-app {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.crumb-sep {
  color: var(--rule-2);
  font-size: 11px;
}

.crumb-current {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 2px;
  transition: background-color 0.16s ease;
}

.user-chip:hover {
  background: var(--surface-alt);
}

.avatar {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  background: var(--night);
  color: #f2f6fa;
  font-size: 12px;
  border-radius: 2px;
}

.user-name {
  font-size: 12.5px;
  color: var(--ink-2);
}

.chev {
  font-size: 11px;
  color: var(--ink-3);
}

.main {
  background: var(--page);
  padding: 0;
  overflow-y: auto;
}
</style>
