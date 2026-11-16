/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

type AnyResult<T = any> = { ok: boolean; data?: T; error?: string; [key: string]: any }

interface Window {
  api: {
    auth: {
      login: (payload: { username: string; password: string }) => Promise<AnyResult>
      current: () => Promise<AnyResult>
      logout: () => Promise<AnyResult>
    }
    complaints: {
      list: (filter: unknown) => Promise<AnyResult>
      get: (code: string) => Promise<AnyResult>
      nextCode: () => Promise<AnyResult>
      save: (payload: { isNew: boolean; data: Record<string, string | null> }) => Promise<AnyResult>
      remove: (codes: string[]) => Promise<AnyResult>
    }
    attachments: {
      list: (code: string) => Promise<AnyResult>
      pick: () => Promise<AnyResult>
      add: (payload: unknown) => Promise<AnyResult>
      remove: (ids: number[]) => Promise<AnyResult>
      download: (ids: number[]) => Promise<AnyResult>
      open: (id: number) => Promise<AnyResult>
    }
    dict: {
      classes: () => Promise<AnyResult>
      items: (classId: number) => Promise<AnyResult>
      options: (className: string) => Promise<AnyResult>
      labels: (className: string) => Promise<AnyResult>
      saveClass: (input: unknown) => Promise<AnyResult>
      removeClass: (id: number) => Promise<AnyResult>
      saveItem: (input: unknown) => Promise<AnyResult>
      removeItem: (id: number) => Promise<AnyResult>
    }
    users: {
      list: () => Promise<AnyResult>
      save: (input: unknown) => Promise<AnyResult>
      remove: (id: number) => Promise<AnyResult>
      resetPassword: (payload: { id: number; password: string }) => Promise<AnyResult>
    }
    logs: {
      list: (filter: unknown) => Promise<AnyResult>
      facets: () => Promise<AnyResult>
    }
    stats: {
      overview: () => Promise<AnyResult>
      monthly: () => Promise<AnyResult>
      groups: (field: 'ClueSource' | 'DisposeForm' | 'UndertakeDept') => Promise<AnyResult>
    }
    exports: {
      complaints: (codes?: string[]) => Promise<AnyResult>
      logs: (filter: unknown) => Promise<AnyResult>
      stats: () => Promise<AnyResult>
    }
    app: {
      meta: () => Promise<AnyResult>
    }
  }
}
