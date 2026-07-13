import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../pages/index.vue'),
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
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
