<template>
  <el-container class="shell">
    <aside class="sidebar">
      <div class="brand">
        <img class="logo logo-full" :src="logoLight" alt="蓝宝星球" />
        <img class="logo logo-mark" :src="logoMark" alt="蓝宝星球" />
      </div>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: activePath === item.path }"
          :title="item.label"
        >
          <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-foot mono">
        <span v-if="version">v{{ version }}</span>
        <span class="foot-platform">{{ platformLabel }}</span>
      </div>
    </aside>

    <el-container class="body">
      <el-header class="topbar">
        <div class="crumb">
          <span class="crumb-app mono">LANBAOSTAR</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-current">{{ currentTitle }}</span>
        </div>
        <el-dropdown trigger="click" @command="handleCommand">
          <span class="user-chip">
            <span class="avatar">{{ initial }}</span>
            <span class="user-id">
              <span class="user-name">{{ session.user?.realName }}</span>
              <span class="user-role mono">{{ session.user?.username }}</span>
            </span>
            <el-icon class="chev"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ session.user?.department }} · {{ session.user?.role === 'Admin' ? '管理员' : '普通用户' }}</el-dropdown-item>
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
import { ArrowDown, Collection, Files, Odometer, Tickets, User } from '@element-plus/icons-vue'
import { setUser, session } from '@/stores/session'
import logoLight from '@/assets/logo-light.png'
import logoMark from '@/assets/logo-mark.png'

const route = useRoute()
const router = useRouter()
const version = ref('')
const platform = ref('')

const navItems = computed(() =>
  [
    { path: '/home', label: '首页统计', icon: markRaw(Odometer) },
    { path: '/complaints', label: '信访管理', icon: markRaw(Files) },
    { path: '/dicts', label: '基础字典', icon: markRaw(Collection) },
    { path: '/users', label: '用户管理', icon: markRaw(User), admin: true },
    { path: '/logs', label: '操作日志', icon: markRaw(Tickets), admin: true }
  ].filter((item) => !item.admin || session.user?.role === 'Admin')
)

const activePath = computed(() => {
  if (route.path.startsWith('/complaints')) return '/complaints'
  return route.path
})

const titles: Record<string, string> = {
  '/home': '首页统计',
  '/complaints': '信访管理',
  '/complaints/new': '新增信访',
  '/dicts': '基础字典',
  '/users': '用户管理',
  '/logs': '操作日志'
}
const currentTitle = computed(() => {
  if (route.path.startsWith('/complaints/') && route.path.endsWith('/edit')) return '编辑信访'
  return titles[route.path] ?? '信访管理系统'
})
const initial = computed(() => (session.user?.realName ?? session.user?.username ?? 'U').slice(0, 1))
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
  width: clamp(11.5rem, 14vw, 15rem);
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--night);
  color: var(--night-text);
}

.brand {
  display: flex;
  align-items: center;
  padding: 1.125rem;
  border-bottom: 1px solid var(--night-2);
}

.logo {
  display: block;
  width: 8.75rem;
  max-width: 100%;
  height: auto;
  object-fit: contain;
}

.logo-mark {
  display: none;
  width: 1.75rem;
}

.nav {
  flex: 1;
  padding: 0.5rem 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border-radius: var(--r-md);
  color: var(--night-text);
  font-size: 0.9375rem;
  text-decoration: none;
  position: relative;
  transition: color 0.16s ease, background-color 0.16s ease;
}

.nav-item:hover {
  color: #eef3f7;
  background: var(--night-2);
}

.nav-item.active {
  color: #ffffff;
  background: var(--night-3);
}

.nav-icon {
  font-size: 1.0625rem;
  opacity: 0.92;
}

.sidebar-foot {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 1.125rem 0.75rem;
  font-size: 0.625rem;
  letter-spacing: 0.06em;
  color: var(--night-muted);
  border-top: 1px solid var(--night-2);
}

.body {
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 3.25rem;
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
  padding: 0 clamp(1rem, 2vw, 1.75rem);
}

.crumb {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.crumb-app {
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.crumb-sep {
  color: var(--rule-2);
  font-size: 0.6875rem;
}

.crumb-current {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.5625rem;
  cursor: pointer;
  padding: 0.25rem 0.375rem;
  border-radius: var(--r-sm);
  transition: background-color 0.16s ease;
}

.user-chip:hover {
  background: var(--surface-alt);
}

.avatar {
  width: 1.875rem;
  height: 1.875rem;
  display: grid;
  place-items: center;
  background: var(--harbor);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.5rem;
}

.user-id {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  line-height: 1.2;
}

.user-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ink);
}

.user-role {
  font-size: 0.6875rem;
  color: var(--ink-3);
}

.chev {
  font-size: 0.6875rem;
  color: var(--ink-3);
}

.main {
  background: var(--page);
  padding: 0;
  overflow-y: auto;
}

@media (max-width: 64rem) {
  .sidebar {
    width: 4.25rem;
  }

  .brand {
    justify-content: center;
    padding: 1rem 0.5rem;
  }

  .logo-full {
    display: none;
  }

  .logo-mark {
    display: block;
    width: 1.75rem;
  }

  .nav-item {
    justify-content: center;
    padding: 0 0;
  }

  .nav-label,
  .sidebar-foot,
  .user-name {
    display: none;
  }
}
</style>
