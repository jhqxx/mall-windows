/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

type AnyResult = { ok: boolean; message?: string; [key: string]: any }

interface Window {
  api: {
    auth: {
      auto: () => Promise<AnyResult>
      login: (payload: { username: string; password: string; remember: boolean }) => Promise<AnyResult>
      logout: () => Promise<AnyResult>
      current: () => Promise<AnyResult>
    }
    cases: {
      create: (payload: unknown) => Promise<AnyResult>
      list: (payload: { page: number; pageSize: number; keyword?: string }) => Promise<AnyResult>
      get: (payload: { id: number }) => Promise<AnyResult>
      remove: (payload: { id: number }) => Promise<AnyResult>
    }
    attachments: {
      pick: () => Promise<AnyResult>
      pending: () => Promise<AnyResult>
      remove: (payload: { ids: number[] }) => Promise<AnyResult>
      download: (payload: { ids: number[] }) => Promise<AnyResult>
    }
    logs: {
      list: (payload: { page: number; pageSize: number; action?: string; keyword?: string }) => Promise<AnyResult>
      actions: () => Promise<AnyResult>
      exportCsv: () => Promise<AnyResult>
    }
    app: {
      stats: () => Promise<AnyResult>
      meta: () => Promise<AnyResult>
    }
  }
}
