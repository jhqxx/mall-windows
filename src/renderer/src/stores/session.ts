import { reactive } from 'vue'

export type SessionUser = {
  id: number
  username: string
  realName: string
  role: string
  department: string
}

export const session = reactive<{ user: SessionUser | null }>({ user: null })

export function setUser(user: SessionUser | null): void {
  session.user = user
}

export function isAdmin(): boolean {
  return session.user?.role === 'Admin'
}
