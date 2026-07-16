import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    redirect: '/forecast',
  },
  {
    path: '/coops',
    name: 'coops',
    component: () => import('../pages/coops.vue'),
  },
  {
    path: '/regional-forecast',
    name: 'regional-forecast',
    component: () => import('../pages/regional-forecast.vue'),
  },
  {
    path: '/flocks',
    name: 'flocks',
    component: () => import('../pages/flocks.vue'),
  },
  {
    path: '/breeds',
    name: 'breeds',
    component: () => import('../pages/breeds.vue'),
  },
  {
    path: '/egg-production',
    name: 'egg-production',
    component: () => import('../pages/egg-production.vue'),
  },
  {
    path: '/forecast',
    name: 'forecast',
    component: () => import('../pages/forecast.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../pages/settings.vue'),
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('../pages/admin.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Global navigation guard - redirect to admin login if not authenticated
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('adminToken')
  
  // Admin page is always accessible (it shows login form when not logged in)
  if (to.name === 'admin') {
    return next()
  }
  
  // All other pages require authentication
  if (!token) {
    return next({ name: 'admin' })
  }
  
  next()
})

export default router
