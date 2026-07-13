<template>
  <v-app>
    <v-app-bar app color="primary" dark elevation="2">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title class="text-h5 font-weight-bold">
        <v-icon class="mr-2">mdi-egg</v-icon>
        Chicken Herd Manager
      </v-toolbar-title>
      <v-spacer></v-spacer>
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
import { ref } from 'vue'

const drawer = ref(false)

const navItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
  { title: 'Flocks', icon: 'mdi-account-group', to: '/flocks' },
  { title: 'Breeds', icon: 'mdi-chicken-variant', to: '/breeds' },
  { title: 'Egg Production', icon: 'mdi-egg-outline', to: '/egg-production' },
  { title: 'Forecast', icon: 'mdi-chart-timeline-variant', to: '/forecast' },
  { title: 'Settings', icon: 'mdi-cog', to: '/settings' },
]
</script>

<style>
html {
  overflow-y: auto !important;
}
</style>
