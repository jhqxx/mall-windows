<template>
  <div class="login">
    <aside class="cover">
      <header class="cover-head">
        <div class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="cover-id mono">MALL DESKTOP · PORT OPS</div>
      </header>

      <div class="cover-copy">
        <h1>案件办理<br />桌面终端</h1>
        <p class="cover-sub">案件登记、附件归档、操作留痕，全部落在本机数据库。</p>
        <ul class="cover-points">
          <li>数据只写入本机 SQLite，不经过任何服务器</li>
          <li>录入、附件、日志共用同一套案件编号</li>
          <li>Windows 与 macOS 共用数据目录约定</li>
        </ul>
        <div class="cover-steps">
          <div><span class="mono">01</span><strong>案件登记</strong></div>
          <div><span class="mono">02</span><strong>附件归档</strong></div>
          <div><span class="mono">03</span><strong>操作留痕</strong></div>
        </div>
      </div>

      <footer class="cover-foot mono">
        <span>31°14'N 121°29'E</span>
        <span>TERMINAL 03 · v{{ version }}</span>
      </footer>
    </aside>

    <main class="pane">
      <span class="pane-tag mono">LOCAL SESSION · NO NETWORK</span>
      <div class="pane-inner">
        <header class="pane-head">
          <h2>账号登录</h2>
          <p class="tip">默认账号 admin / 123456（首次启动自动创建）</p>
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
          <el-checkbox v-model="form.remember">记住我（下次自动登录）</el-checkbox>
          <el-button type="primary" class="login-button" :loading="loading" @click="submit">
            登录
          </el-button>
        </el-form>

        <p class="meta mono">ELECTRON {{ electron }} · NODE {{ node }}</p>
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
.login {
  height: 100%;
  display: flex;
  background: var(--page);
}

.cover {
  position: relative;
  width: 46%;
  min-width: 380px;
  background: var(--night);
  color: var(--night-text);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 28px 34px 22px;
  overflow: hidden;
}

.cover::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 54px;
  height: 1px;
  background: rgba(169, 183, 198, 0.16);
}

.cover::after {
  content: '';
  position: absolute;
  left: 34px;
  bottom: 53px;
  width: 96px;
  height: 2px;
  background: var(--harbor);
}

.cover-head,
.cover-copy,
.cover-foot {
  position: relative;
}

.cover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.mark {
  width: 30px;
  height: 30px;
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

.cover-id {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: var(--night-muted);
}

.cover-copy {
  max-width: 430px;
}

.cover h1 {
  margin: 0 0 16px;
  font-size: 33px;
  font-weight: 600;
  line-height: 1.28;
  letter-spacing: -0.01em;
  color: #f2f6fa;
}

.cover-sub {
  margin: 0 0 26px;
  max-width: 34ch;
  font-size: 13px;
  line-height: 1.8;
  color: var(--night-text);
}

.cover-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--night-text);
}

.cover-points li {
  position: relative;
  padding-left: 16px;
}

.cover-points li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 5px;
  height: 2px;
  background: #6fb3e0;
}

.cover-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 34px;
}

.cover-steps div {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(169, 183, 198, 0.18);
}

.cover-steps span {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #6fb3e0;
}

.cover-steps strong {
  font-size: 12.5px;
  font-weight: 500;
  color: #dfe8ef;
}

.cover-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 9px;
  letter-spacing: 0.14em;
  color: var(--night-muted);
  border-top: 1px solid rgba(169, 183, 198, 0.14);
  padding-top: 14px;
}

.pane-tag {
  position: absolute;
  top: 26px;
  right: 30px;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--ink-3);
}

.pane {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--surface);
}

.pane-inner {
  width: 340px;
}

.pane-head {
  margin-bottom: 24px;
}

.pane-head h2 {
  margin: 0 0 8px;
  font-size: 23px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--ink);
}

.tip {
  margin: 0;
  font-size: 12px;
  color: var(--ink-3);
}

.login-button {
  width: 100%;
  margin-top: 18px;
  height: 42px;
  font-size: 13.5px;
  letter-spacing: 0.08em;
}

.meta {
  margin: 26px 0 0;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--ink-3);
  border-top: 1px solid var(--rule);
  padding-top: 12px;
}
</style>
