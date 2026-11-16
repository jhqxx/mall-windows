<template>
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">操作日志</h1>
        <p class="page-subtitle">共 {{ total }} 条记录</p>
      </div>
    </header>

    <section class="block">
      <div class="toolbar">
        <el-select v-model="filter.module" placeholder="操作模块" clearable class="w-40" @change="reload">
          <el-option v-for="item in facets.modules" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-model="filter.type" placeholder="操作类型" clearable class="w-36" @change="reload">
          <el-option v-for="item in facets.types" :key="item" :label="item" :value="item" />
        </el-select>
        <el-input v-model="filter.user" placeholder="操作人" clearable class="w-36" @keyup.enter="reload" />
        <el-input v-model="filter.keyword" placeholder="内容 / 对象" clearable class="w-52" @keyup.enter="reload" />
        <el-button type="primary" :icon="Search" @click="reload">查询</el-button>
        <el-button :icon="Refresh" @click="reset">重置</el-button>
      </div>

      <el-table :data="rows" border stripe size="small">
        <el-table-column label="时间" width="168" class-name="cell-mono">
          <template #default="{ row }">{{ shortTime(row.OperationTime) }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="150">
          <template #default="{ row }">
            {{ row.UserRealName || row.UserName }}
            <span class="role" v-if="row.UserRole === 'Admin'">管理员</span>
          </template>
        </el-table-column>
        <el-table-column prop="OperationType" label="类型" width="110" />
        <el-table-column prop="OperationModule" label="模块" width="120" />
        <el-table-column prop="OperationContent" label="内容" min-width="240" show-overflow-tooltip />
        <el-table-column prop="TargetName" label="对象" width="150" show-overflow-tooltip />
        <el-table-column prop="IPAddress" label="IP" width="120" class-name="cell-mono" />
        <template #empty>
          <div class="empty">没有匹配的日志</div>
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="filter.page"
          v-model:page-size="filter.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="reload"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { Refresh, Search } from '@element-plus/icons-vue'

type LogRow = {
  Id: number
  UserName: string
  UserRealName: string | null
  UserRole: string | null
  OperationType: string
  OperationModule: string
  OperationContent: string | null
  TargetName: string | null
  IPAddress: string | null
  OperationTime: string
}

const rows = ref<LogRow[]>([])
const total = ref(0)
const facets = reactive<{ modules: string[]; types: string[] }>({ modules: [], types: [] })

const filter = reactive({
  module: '',
  type: '',
  user: '',
  keyword: '',
  page: 1,
  pageSize: 20,
})

function shortTime(value: string | null): string {
  if (!value) return '—'
  return String(value).slice(0, 19)
}

async function load(): Promise<void> {
  const res = await window.api.logs.list({ ...filter })
  if (!res?.ok) return
  rows.value = res.data.rows
  total.value = res.data.total
}

function reload(): void {
  filter.page = 1
  load()
}

function reset(): void {
  filter.module = ''
  filter.type = ''
  filter.user = ''
  filter.keyword = ''
  reload()
}

onMounted(async () => {
  const res = await window.api.logs.facets()
  if (res?.ok) Object.assign(facets, res.data)
  load()
})
</script>

<style scoped>
.page {
  padding: 1.5rem 1.75rem 2rem;
  display: flex;
  flex-direction: column;
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
  padding: 0.75rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.w-36 { width: 9rem; }
.w-40 { width: 10rem; }
.w-52 { width: 13rem; }

.role {
  margin-left: 0.375rem;
  font-size: 0.75rem;
  color: var(--ink-3);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
}

.empty {
  color: var(--ink-3);
  font-size: 0.875rem;
  padding: 0.75rem 0;
}
</style>
