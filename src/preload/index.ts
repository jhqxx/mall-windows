import { contextBridge, ipcRenderer } from 'electron'

const api = {
  auth: {
    auto: () => ipcRenderer.invoke('auth:auto'),
    login: (payload: { username: string; password: string; remember: boolean }) =>
      ipcRenderer.invoke('auth:login', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    current: () => ipcRenderer.invoke('auth:current')
  },
  cases: {
    create: (payload: unknown) => ipcRenderer.invoke('case:create', payload),
    list: (payload: { page: number; pageSize: number; keyword?: string }) =>
      ipcRenderer.invoke('case:list', payload),
    get: (payload: { id: number }) => ipcRenderer.invoke('case:get', payload),
    remove: (payload: { id: number }) => ipcRenderer.invoke('case:delete', payload)
  },
  attachments: {
    pick: () => ipcRenderer.invoke('attachment:pick'),
    pending: () => ipcRenderer.invoke('attachment:pending'),
    remove: (payload: { ids: number[] }) => ipcRenderer.invoke('attachment:delete', payload),
    download: (payload: { ids: number[] }) => ipcRenderer.invoke('attachment:download', payload)
  },
  logs: {
    list: (payload: { page: number; pageSize: number; action?: string; keyword?: string }) =>
      ipcRenderer.invoke('log:list', payload),
    actions: () => ipcRenderer.invoke('log:actions'),
    exportCsv: () => ipcRenderer.invoke('log:export')
  },
  dict: {
    types: () => ipcRenderer.invoke('dict:types'),
    items: (payload: { typeCode: string }) => ipcRenderer.invoke('dict:items', payload),
    options: (payload: { code: string }) => ipcRenderer.invoke('dict:options', payload),
    saveType: (payload: { id?: number; code: string; name: string; remark?: string | null }) =>
      ipcRenderer.invoke('dict:type:save', payload),
    removeType: (payload: { id: number }) => ipcRenderer.invoke('dict:type:delete', payload),
    saveItem: (payload: {
      id?: number
      typeCode: string
      parentId?: number | null
      label: string
      value: string
      sortNo: number
      enabled: boolean
      remark?: string | null
    }) => ipcRenderer.invoke('dict:item:save', payload),
    removeItem: (payload: { id: number }) => ipcRenderer.invoke('dict:item:delete', payload)
  },
  app: {
    stats: () => ipcRenderer.invoke('app:stats'),
    meta: () => ipcRenderer.invoke('app:meta')
  }
}

// 仅用于自动化验收（MALL_TEST_HOOKS=1 时暴露），生产运行不会出现
if (process.env['MALL_TEST_HOOKS'] === '1') {
  ;(api as any).__test = {
    addAttachments: (paths: string[]) => ipcRenderer.invoke('test:addAttachments', { paths })
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AppApi = typeof api
