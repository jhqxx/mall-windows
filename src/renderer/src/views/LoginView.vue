<template>
  <div class="login">
    <aside class="cover">
      <header class="cover-head">
        <img class="logo" :src="logoLight" alt="蓝宝星球" />
      </header>

      <div class="cover-copy">
        <h1>案件办理<br />桌面终端</h1>
      </div>

      <footer class="cover-foot mono">
        <span>v{{ version }}</span>
      </footer>
    </aside>

    <main class="pane">
      <div class="pane-inner">
        <header class="pane-head">
          <h2>账号登录</h2>
          <p class="tip mono">admin / 123456</p>
        </header>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          @submit.prevent
        >
          <el-form-item prop="username" label="账号">
            <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" clearable />
          </el-form-item>
          <el-form-item prop="password" label="密码">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-checkbox v-model="form.remember">记住我</el-checkbox>
          <el-button type="primary" class="login-button" :loading="loading" @click="submit">
            登录
          </el-button>
        </el-form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { setUser } from '@/stores/session'
import logoLight from '@/assets/logo-light.png'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)
const version = ref('0.1.0')

const form = reactive({ username: 'admin', password: '123456', remember: false })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(async () => {
  const meta = await window.api.app.meta()
  if (meta?.ok) {
    version.value = meta.version
  }
  const auto = await window.api.auth.auto()
  if (auto?.ok && auto.user) {
    setUser(auto.user)
    ElMessage.success(`欢迎回来，${auto.user.displayName}`)
    router.replace((route.query.redirect as string) || '/dashboard')
  }
})

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await window.api.auth.login({
      username: form.username,
      password: form.password,
      remember: form.remember
    })
    if (!res.ok) {
      ElMessage.error(res.message || '登录失败')
      return
    }
    setUser(res.user)
    ElMessage.success('登录成功')
    router.replace((route.query.redirect as string) || '/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login {
  height: 100%;
  display: flex;
  background: var(--page);
}

.cover {
  position: relative;
  flex: 0 0 42%;
  max-width: 34rem;
  background: var(--night);
  color: var(--night-text);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  overflow: hidden;
}

.cover::before {
  content: '';
  position: absolute;
  left: clamp(1.5rem, 3vw, 2.5rem);
  right: 0;
  bottom: 4.75rem;
  height: 1px;
  background: var(--night-2);
}

.cover-head {
  display: flex;
  align-items: center;
}

.logo {
  display: block;
  width: clamp(8rem, 10vw, 10.5rem);
  height: auto;
}

.cover-copy h1 {
  margin: 0;
  font-size: clamp(1.5rem, 2.2vw + 0.6rem, 2.25rem);
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #f4f8fb;
}

.cover-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.875rem;
  border-top: 1px solid transparent;
  font-size: 0.625rem;
  letter-spacing: 0.14em;
  color: var(--night-muted);
}

.pane {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem clamp(1.25rem, 4vw, 4rem);
}

.pane-inner {
  width: min(24rem, 100%);
  padding: clamp(1.5rem, 2.4vw, 2.25rem);
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-lg);
  box-shadow: 0 0.5rem 1.5rem rgba(16, 22, 29, 0.05);
}

.pane-head {
  margin-bottom: 1.5rem;
}

.pane-head h2 {
  margin: 0 0 0.375rem;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.tip {
  margin: 0;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.login-button {
  width: 100%;
  margin-top: 1.125rem;
}

@media (max-width: 60rem) {
  .login {
    flex-direction: column;
  }

  .cover {
    flex: none;
    max-width: none;
    align-items: flex-start;
    padding: 1.25rem 1.5rem;
  }

  .cover::before,
  .cover-foot {
    display: none;
  }

  .cover-copy {
    display: none;
  }

  .pane {
    align-items: flex-start;
    padding-top: 2rem;
  }

  .pane-logo {
    display: none;
  }
}
</style>
