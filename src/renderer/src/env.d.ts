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
    dict: {
      groups: () => Promise<AnyResult>
      saveGroup: (payload: { id?: number; name: string; sortNo?: number; remark?: string | null }) => Promise<AnyResult>
      removeGroup: (payload: { id: number }) => Promise<AnyResult>
      types: (payload?: { groupId?: number }) => Promise<AnyResult>
      items: (payload: { typeCode: string }) => Promise<AnyResult>
      options: (payload: { code: string }) => Promise<AnyResult>
      saveType: (payload: {
        id?: number
        code: string
        name: string
        groupId?: number | null
        remark?: string | null
      }) => Promise<AnyResult>
      removeType: (payload: { id: number }) => Promise<AnyResult>
      saveItem: (payload: {
        id?: number
        typeCode: string
        label: string
        value: string
        sortNo: number
        enabled: boolean
        remark?: string | null
      }) => Promise<AnyResult>
      removeItem: (payload: { id: number }) => Promise<AnyResult>
    }
    app: {
      stats: () => Promise<AnyResult>
      meta: () => Promise<AnyResult>
    }
  }
}
