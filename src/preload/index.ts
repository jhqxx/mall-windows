import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload)

const api = {
  auth: {
    login: (payload: { username: string; password: string }) => invoke('auth:login', payload),
    current: () => invoke('auth:current'),
    logout: () => invoke('auth:logout'),
  },
  complaints: {
    list: (filter: unknown) => invoke('complaint:list', filter),
    get: (code: string) => invoke('complaint:get', code),
    nextCode: () => invoke('complaint:nextCode'),
    save: (payload: { isNew: boolean; data: Record<string, string | null> }) => invoke('complaint:save', payload),
    remove: (codes: string[]) => invoke('complaint:delete', codes),
  },
  attachments: {
    list: (code: string) => invoke('attachment:list', code),
    pick: () => invoke('attachment:pick'),
    add: (payload: unknown) => invoke('attachment:add', payload),
    remove: (ids: number[]) => invoke('attachment:delete', ids),
    download: (ids: number[]) => invoke('attachment:download', ids),
    open: (id: number) => invoke('attachment:open', id),
  },
  dict: {
    classes: () => invoke('dict:classes'),
    items: (classId: number) => invoke('dict:items', classId),
    options: (className: string) => invoke('dict:options', className),
    labels: (className: string) => invoke('dict:labels', className),
    saveClass: (input: unknown) => invoke('dict:class:save', input),
    removeClass: (id: number) => invoke('dict:class:delete', id),
    saveItem: (input: unknown) => invoke('dict:item:save', input),
    removeItem: (id: number) => invoke('dict:item:delete', id),
  },
  users: {
    list: () => invoke('users:list'),
    save: (input: unknown) => invoke('users:save', input),
    remove: (id: number) => invoke('users:delete', id),
    resetPassword: (payload: { id: number; password: string }) => invoke('users:resetPassword', payload),
  },
  logs: {
    list: (filter: unknown) => invoke('logs:list', filter),
    facets: () => invoke('logs:facets'),
  },
  stats: {
    overview: () => invoke('stats:overview'),
    monthly: () => invoke('stats:monthly'),
    groups: (field: 'ClueSource' | 'DisposeForm' | 'UndertakeDept') => invoke('stats:groups', field),
  },
  exports: {
    complaints: (codes?: string[]) => invoke('export:complaints', codes),
    logs: (filter: unknown) => invoke('export:logs', filter),
    stats: () => invoke('export:stats'),
  },
  app: {
    meta: () => invoke('app:meta'),
  },
}

contextBridge.exposeInMainWorld('api', api)
