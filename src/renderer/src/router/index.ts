import { createRouter, createWebHashHistory } from 'vue-router'
import { session, setUser } from '@/stores/session'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    {
      path: '/',
      component: () => import('@/layout/AppLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'cases/new', name: 'case-form', component: () => import('@/views/CaseFormView.vue') },
        { path: 'cases', name: 'case-list', component: () => import('@/views/CaseListView.vue') },
        { path: 'logs', name: 'logs', component: () => import('@/views/LogsView.vue') }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

let bootstrapped = false

router.beforeEach(async (to) => {
  if (to.path === '/login') {
    return session.user ? '/dashboard' : true
  }
  if (session.user) return true
  if (!bootstrapped) {
    bootstrapped = true
    const res = await window.api.auth.current()
    if (res?.ok && res.user) {
      setUser(res.user)
      return true
    }
  }
  return { path: '/login', query: { redirect: to.fullPath } }
})

export default router
