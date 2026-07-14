<template>
  <v-app>
    <v-app-bar app color="primary" dark elevation="2">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <router-link to="/" style="text-decoration: none; color: inherit; display: flex; align-items: center;">
        <v-toolbar-title class="text-h5 font-weight-bold" style="cursor: pointer;">
          <v-icon class="mr-2">mdi-egg</v-icon>
          Chicken Herd Manager
        </v-toolbar-title>
      </router-link>
      <v-spacer></v-spacer>
      
      <!-- User menu with logout -->
      <div v-if="isLoggedIn" class="d-flex align-center mr-2">
        <v-chip color="white" text-color="primary" size="small" class="mr-2">
          <v-icon start size="small">mdi-account</v-icon>
          {{ currentUser?.username || 'User' }}
        </v-chip>
        <v-btn icon size="small" variant="text" @click="handleLogout" title="Logout">
          <v-icon>mdi-logout</v-icon>
        </v-btn>
      </div>
    </v-app-bar>

    <v-navigation-drawer v-model="drawer" app temporary>
      <v-list nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="xl"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main class="bg-grey-lighten-4">
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const drawer = ref(false)
const isLoggedIn = ref(false)
const currentUser = ref<any>(null)

// Check auth state on mount
onMounted(() => {
  checkAuthState()
  
  // Listen for storage events (login/logout in other tabs/components)
  window.addEventListener('storage', handleStorageChange)
  
  // Listen for custom auth change events (same-page login/logout)
  window.addEventListener('auth-changed', checkAuthState)
})

// Re-check auth state on route navigation (catches login -> navigate flow)
watch(() => route.fullPath, () => {
  checkAuthState()
})

// Check current auth state from localStorage
function checkAuthState() {
  const token = localStorage.getItem('adminToken')
  const userStr = localStorage.getItem('adminUser')
  
  if (token && userStr) {
    try {
      currentUser.value = JSON.parse(userStr)
      isLoggedIn.value = true
    } catch (e) {
      // Invalid stored data
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      isLoggedIn.value = false
      currentUser.value = null
    }
  } else {
    isLoggedIn.value = false
    currentUser.value = null
  }
}

// Handle storage changes (login/logout events)
function handleStorageChange(event: StorageEvent) {
  if (event.key === 'adminToken' || event.key === 'adminUser') {
    checkAuthState()
  }
}

// Logout handler
function handleLogout() {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUser')
  isLoggedIn.value = false
  currentUser.value = null
  
  // Trigger storage event for same-page updates
  window.dispatchEvent(new Event('storage'))
  
  // Redirect to admin login page
  router.push('/admin')
}

const navItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
  { title: 'Flocks', icon: 'mdi-account-group', to: '/flocks' },
  { title: 'Breeds', icon: 'mdi-chicken-variant', to: '/breeds' },
  { title: 'Egg Production', icon: 'mdi-egg-outline', to: '/egg-production' },
  { title: 'Forecast', icon: 'mdi-chart-timeline-variant', to: '/forecast' },
  { title: 'Settings', icon: 'mdi-cog', to: '/settings' },
  { title: 'Admin', icon: 'mdi-shield-account', to: '/admin' },
]
</script>

<style>
html {
  overflow-y: auto !important;
}
</style>
