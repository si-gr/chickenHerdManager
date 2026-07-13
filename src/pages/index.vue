<template>
  <v-container fluid>
    <h1 class="text-h4 mb-6">
      <v-icon class="mr-2">mdi-view-dashboard</v-icon>
      Dashboard
    </h1>

    <!-- Summary Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card color="primary" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-account-group</v-icon>
            <div class="text-h3">{{ flockStats?.total_flocks || 0 }}</div>
            <div class="text-subtitle-1">Total Flocks</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="success" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chicken</v-icon>
            <div class="text-h3">{{ flockStats?.total_hens || 0 }}</div>
            <div class="text-subtitle-1">Total Hens</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="info" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-egg</v-icon>
            <div class="text-h3">{{ stats?.total_eggs_today || 0 }}</div>
            <div class="text-subtitle-1">Eggs Today</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="warning" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chart-line</v-icon>
            <div class="text-h3">{{ productionRate }}%</div>
            <div class="text-subtitle-1">Production Rate</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts Row -->
    <v-row class="mb-6">
      <v-col cols="12" md="8">
        <v-card elevation="4">
          <v-card-title>
            <v-icon left class="mr-2">mdi-chart-timeline-variant</v-icon>
            Egg Production Trend (Last 30 Days)
          </v-card-title>
          <v-card-text>
            <Line v-if="trendChartData" :data="trendChartData" :options="trendChartOptions" height="300" />
            <div v-else class="text-center py-8 text-medium-emphasis">
              No production data available
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card elevation="4">
          <v-card-title>
            <v-icon left class="mr-2">mdi-chart-pie</v-icon>
            Eggs by Breed
          </v-card-title>
          <v-card-text>
            <Doughnut v-if="breedChartData" :data="breedChartData" :options="breedChartOptions" height="300" />
            <div v-else class="text-center py-8 text-medium-emphasis">
              No breed data available
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Recent Activity -->
    <v-card elevation="4">
      <v-card-title>
        <v-icon left class="mr-2">mdi-history</v-icon>
        Recent Egg Production
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="recentHeaders"
          :items="recentRecords"
          :items-per-page="10"
          class="elevation-1"
        >
          <template v-slot:item.egg_count="{ item }">
            <v-chip :color="item.egg_count > 0 ? 'success' : 'grey'" size="small">
              {{ item.egg_count }} {{ item.egg_count === 1 ? 'egg' : 'eggs' }}
            </v-chip>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Line, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useEggProductionStore } from '@/stores/eggProduction'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const store = useEggProductionStore()

const flocks = ref([])
const stats = computed(() => store.dashboardStats)
const recentRecords = computed(() => store.records.slice(0, 20))

const flockStats = computed(() => {
  const totalFlocks = flocks.value.length
  const totalHens = flocks.value.reduce((sum, f) => sum + f.count, 0)
  const activeFlocks = flocks.value.filter(f => f.status === 'active').length
  return { total_flocks: totalFlocks, total_hens: totalHens, active_flocks: activeFlocks }
})

const productionRate = computed(() => {
  if (!flockStats.value.total_hens || !stats.value.total_eggs_today) return 0
  return Math.round((stats.value.total_eggs_today / flockStats.value.total_hens) * 100)
})

const recentHeaders = [
  { title: 'Date', key: 'date', width: '20%' },
  { title: 'Source', key: 'source', width: '30%' },
  { title: 'Coop', key: 'coop_name', width: '25%' },
  { title: 'Eggs', key: 'egg_count', align: 'center', width: '25%' },
]

// Trend chart
const trendChartData = computed(() => {
  const trend = stats.value?.eggs_trend
  if (!trend || trend.length === 0) return null

  return {
    labels: trend.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [{
      label: 'Daily Egg Count',
      data: trend.map(d => d.count),
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: true,
      tension: 0.4,
    }]
  }
})

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `${context.parsed.y} eggs`
      }
    }
  },
  scales: {
    x: {
      title: { display: true, text: 'Date' },
      ticks: { maxTicksLimit: 10 }
    },
    y: {
      title: { display: true, text: 'Eggs' },
      beginAtZero: true
    }
  }
}

// Breed chart colors
const breedColors = [
  '#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336',
  '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
]

const breedChartData = computed(() => {
  const breeds = stats.value?.eggs_by_breed
  if (!breeds || breeds.length === 0) return null

  return {
    labels: breeds.map(b => b.breed),
    datasets: [{
      data: breeds.map(b => b.count),
      backgroundColor: breeds.map((_, i) => breedColors[i % breedColors.length]),
      borderWidth: 2,
    }]
  }
})

const breedChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { boxWidth: 12 }
    }
  }
}

const loadFlocks = async () => {
  try {
    const response = await fetch('/api/flocks')
    flocks.value = await response.json()
  } catch (error) {
    console.error('Error loading flocks:', error)
  }
}

onMounted(async () => {
  await Promise.all([
    store.fetchDashboardStats(),
    store.fetchRecords({ start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }),
    loadFlocks(),
  ])
})
</script>
