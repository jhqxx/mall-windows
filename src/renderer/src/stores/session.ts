import { reactive } from 'vue'

export type SessionUser = {
  id: number
  username: string
  displayName: string
  role: string
}

export const session = reactive<{ user: SessionUser | null }>({ user: null })

export function setUser(user: SessionUser | null): void {
  session.user = user
}
