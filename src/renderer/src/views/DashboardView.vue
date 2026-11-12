<template>
  <div class="page">
    <h2 class="page-title">工作台</h2>
    <p class="page-subtitle">数据均保存在本机 userData 目录，卸载应用不会自动清除。</p>

    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-icon blue"><el-icon><Files /></el-icon></div>
          <div>
            <div class="stat-label">案件总数</div>
            <div class="stat-value">{{ stats.cases }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-icon green"><el-icon><Paperclip /></el-icon></div>
          <div>
            <div class="stat-label">附件总数</div>
            <div class="stat-value">{{ stats.attachments }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-icon orange"><el-icon><Tickets /></el-icon></div>
          <div>
            <div class="stat-label">操作日志</div>
            <div class="stat-value">{{ stats.logs }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never" class="section-card">
          <template #header>
            <span class="section-title">快捷入口</span>
          </template>
          <div class="quick">
            <el-button type="primary" size="large" @click="router.push('/cases/new')">
              <el-icon><DocumentAdd /></el-icon> 新建案件办理单
            </el-button>
            <el-button size="large" @click="router.push('/cases')">
              <el-icon><Files /></el-icon> 查看案件列表
            </el-button>
            <el-button size="large" @click="router.push('/logs')">
              <el-icon><Tickets /></el-icon> 查看操作日志
            </el-button>
          </div>
          <el-alert type="info" :closable="false" show-icon class="hint"
            title="演示要点：登录（记住我 / 错误密码留痕）→ 案件录入（条件校验 / 附件上传）→ 列表 → 操作日志（筛选 / 导出 CSV）" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="section-card">
          <template #header>
            <span class="section-title">运行环境</span>
          </template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="应用版本">v{{ meta.version }}</el-descriptions-item>
            <el-descriptions-item label="Electron">{{ meta.electron }}</el-descriptions-item>
            <el-descriptions-item label="Node">{{ meta.node }}</el-descriptions-item>
            <el-descriptions-item label="SQLite 驱动">{{ stats.driver }}</el-descriptions-item>
            <el-descriptions-item label="平台">{{ meta.platform }}</el-descriptions-item>
            <el-descriptions-item label="数据目录">
              <span class="path">{{ stats.paths?.userData }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const stats = reactive<{
  cases: number
  attachments: number
  logs: number
  driver: string
  paths?: { userData: string }
}>({
  cases: 0,
  attachments: 0,
  logs: 0,
  driver: '-'
})
const meta = reactive({ version: '-', electron: '-', node: '-', platform: '-' })

onMounted(async () => {
  const s = await window.api.app.stats()
  if (s?.ok) {
    stats.cases = s.cases
    stats.attachments = s.attachments
    stats.logs = s.logs
    stats.driver = s.driver ?? '-'
    stats.paths = s.paths
  }
  const m = await window.api.app.meta()
  if (m?.ok) {
    meta.version = m.version
    meta.electron = m.electron
    meta.node = m.node
    meta.platform = m.platform
  }
})
</script>

<style scoped>
.stat-row {
  margin-bottom: 4px;
}

.stat-card {
  display: flex;
  align-items: center;
  border-radius: 8px;
}

.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
}

.stat-icon.blue {
  background: linear-gradient(135deg, #409eff, #2f6fe4);
}

.stat-icon.green {
  background: linear-gradient(135deg, #67c23a, #3f9c22);
}

.stat-icon.orange {
  background: linear-gradient(135deg, #e6a23c, #d18616);
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2d3d;
  line-height: 1.15;
}

.quick {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.hint {
  border-radius: 8px;
}

.path {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  word-break: break-all;
}
</style>
