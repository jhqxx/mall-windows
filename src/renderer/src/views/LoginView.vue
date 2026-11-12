<template>
  <div class="login-page">
    <div class="login-brand">
      <div class="brand-badge">MD</div>
      <h1>Mall Desktop</h1>
      <p>案件办理 · 桌面端</p>
      <ul>
        <li>本地 SQLite 存储，数据不出本机</li>
        <li>案件录入 + 附件管理 + 操作日志</li>
        <li>Windows / macOS 双平台安装包</li>
      </ul>
    </div>

    <el-card class="login-card" shadow="always">
      <h2>账号登录</h2>
      <p class="tip">默认账号 admin / 123456（首次启动自动创建）</p>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent>
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="submit"
          />
        </el-form-item>
        <div class="row">
          <el-checkbox v-model="form.remember">记住我（下次自动登录）</el-checkbox>
        </div>
        <el-button type="primary" class="login-button" :loading="loading" @click="submit">
          登 录
        </el-button>
      </el-form>
      <p class="footer">v{{ version }} · Electron {{ electron }} · Node {{ node }}</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { setUser } from '@/stores/session'

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)
const version = ref('0.1.0')
const electron = ref('-')
const node = ref('-')

const form = reactive({ username: 'admin', password: '123456', remember: false })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(async () => {
  const meta = await window.api.app.meta()
  if (meta?.ok) {
    version.value = meta.version
    electron.value = meta.electron
    node.value = meta.node
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
.login-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 90px;
  background: radial-gradient(circle at 20% 20%, #1f3a68 0%, #16233c 45%, #101a2c 100%);
  padding: 40px;
}

.login-brand {
  color: #dfe7f5;
  max-width: 380px;
}

.brand-badge {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #2f6fe4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
  margin-bottom: 18px;
}

.login-brand h1 {
  margin: 0 0 6px;
  font-size: 30px;
  letter-spacing: 1px;
}

.login-brand p {
  margin: 0 0 22px;
  color: #9fb3d1;
  font-size: 14px;
}

.login-brand ul {
  margin: 0;
  padding-left: 18px;
  color: #9fb3d1;
  font-size: 13px;
  line-height: 2;
}

.login-card {
  width: 400px;
  border-radius: 14px;
  padding: 10px 6px;
}

.login-card h2 {
  margin: 4px 0 6px;
  font-size: 21px;
  color: #1f2d3d;
}

.tip {
  margin: 0 0 20px;
  font-size: 12px;
  color: #909399;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.login-button {
  width: 100%;
  letter-spacing: 4px;
}

.footer {
  margin: 18px 0 4px;
  text-align: center;
  font-size: 11px;
  color: #c0c4cc;
}
</style>
