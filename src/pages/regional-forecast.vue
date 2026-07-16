<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-map-marker-radius</v-icon>
          Regional Forecast
        </h1>
      </v-col>
    </v-row>

    <!-- Region Selection -->
    <v-card class="mb-6" elevation="2" color="info" dark>
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="4">
            <div class="text-subtitle-1">📍 Select Region by Postcode</div>
            <div class="text-caption opacity-75">Enter first 2 digits to include all barns in that region</div>
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="regionPostcode"
              label="Postcode Prefix (e.g., 12, 80, 69)"
              placeholder="XX"
              maxlength="2"
              variant="outlined"
              bg-color="white"
              @input="onPostcodeInput"
              @keyup.enter="loadRegionalForecast"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <v-btn color="white" text-color="primary" @click="loadRegionalForecast" :loading="loading" block>
              <v-icon left class="mr-2">mdi-magnify</v-icon>
              Generate Regional Forecast
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Region Info Banner -->
    <v-alert
      v-if="selectedRegionInfo"
      type="info"
      variant="tonal"
      class="mb-6"
      border="start"
    >
      <div class="d-flex align-center">
        <v-icon size="32" class="mr-3">mdi-map-check</v-icon>
        <div>
          <div class="text-h6">Region: {{ selectedRegionInfo.prefix }}XXXXX</div>
          <div class="text-body-2">
            {{ selectedRegionInfo.barnCount }} barn(s) • 
            {{ formatNumber(selectedRegionInfo.totalHens) }} total hens • 
            {{ formatNumber(selectedRegionInfo.totalCapacity) }} total capacity
          </div>
        </div>
      </div>
    </v-alert>

    <!-- Summary Cards -->
    <v-row class="mb-6" v-if="forecast">
      <v-col cols="12" md="3">
        <v-card color="primary" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-egg</v-icon>
            <div class="text-h3">{{ formatNumber(forecast.summary.total_predicted_eggs) }}</div>
            <div class="text-subtitle-1">Predicted Total Eggs</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="success" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chart-line</v-icon>
            <div class="text-h3">{{ formatNumber(forecast.summary.avg_weekly_eggs) }}</div>
            <div class="text-subtitle-1">Avg Eggs/Week</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="info" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-trending-up</v-icon>
            <div class="text-h3">Week {{ forecast.summary.peak_week }}</div>
            <div class="text-subtitle-1">Peak Production</div>
            <div class="text-caption">{{ formatNumber(forecast.summary.peak_eggs) }} eggs/week</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card :color="trendColor" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">{{ trendIcon }}</v-icon>
            <div class="text-h3 text-capitalize">{{ forecast.summary.trend }}</div>
            <div class="text-subtitle-1">Production Trend</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Flock & Barn Info -->
    <v-row class="mb-6" v-if="forecast">
      <v-col cols="12" md="6">
        <v-card elevation="4" color="warning" dark>
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-barn</v-icon>
            <div class="text-h4">{{ selectedRegionInfo?.barnCount || 0 }} barns</div>
            <div class="text-subtitle-1">{{ formatNumber(forecast.summary.total_hens || 0) }} total hens</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card elevation="4" :color="(forecast.replacement_planning?.length || 0) > 0 ? 'error' : 'success'" dark>
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-swap-horizontal</v-icon>
            <div class="text-h4">{{ forecast.replacement_planning?.length || 0 }}</div>
            <div class="text-subtitle-1">Flocks needing replacement</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Barns in Region Table -->
    <v-card class="mb-6" elevation="4" v-if="regionalBarns.length > 0">
      <v-card-title>
        <v-icon left class="mr-2">mdi-barn</v-icon>
        Barns in Region {{ selectedRegionInfo?.prefix || '' }}XXXXX
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="barnHeaders"
          :items="regionalBarns"
          :items-per-page="10"
          class="elevation-1"
        >
          <template v-slot:item.postcode="{ item }">
            <v-chip color="info" size="small">{{ item.postcode }}</v-chip>
          </template>
          <template v-slot:item.utilization="{ item }">
            <v-progress-linear
              :model-value="(item.chicken_count / item.capacity) * 100"
              :color="getUtilizationColor(item.chicken_count, item.capacity)"
              rounded
              height="20"
            >
              <template v-slot:default="{ value }">
                <span class="text-white text-caption font-weight-bold">{{ Math.round(value) }}%</span>
              </template>
            </v-progress-linear>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Replacement Planning Table -->
    <v-card class="mb-6" elevation="4" v-if="forecast?.replacement_planning?.length > 0">
      <v-card-title>
        <v-icon left class="mr-2">mdi-alert-circle</v-icon>
        Upcoming Flock Replacements (Region)
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="replacementHeaders"
          :items="forecast.replacement_planning"
          :items-per-page="5"
          class="elevation-1"
        >
          <template v-slot:item.replacement_due_week="{ item }">
            <v-chip color="error" size="small">Week {{ item.replacement_due_week }}</v-chip>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Forecast Chart -->
    <v-card class="mb-6" elevation="4" v-if="forecast">
      <v-card-title>
        <v-icon left class="mr-2">mdi-chart-timeline-variant</v-icon>
        Regional Production Forecast ({{ forecastWeeks }} weeks)
      </v-card-title>
      <v-card-text>
        <Line :data="forecastChartData" :options="forecastChartOptions" height="350" />
      </v-card-text>
    </v-card>

    <!-- Forecast Details Table -->
    <v-card elevation="4" v-if="forecast">
      <v-card-title>
        <v-icon left class="mr-2">mdi-table</v-icon>
        Forecast Details
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="forecastHeaders"
          :items="forecast.forecast"
          :items-per-page="12"
          class="elevation-1"
        >
          <template v-slot:item.predicted_eggs="{ item }">
            <v-chip :color="getEggColor(item.predicted_eggs)" size="small">
              {{ formatNumber(Math.round(item.predicted_eggs)) }}
            </v-chip>
          </template>

          <template v-slot:item.confidence="{ item }">
            {{ formatNumber(Math.round(item.lower_bound)) }} - {{ formatNumber(Math.round(item.upper_bound)) }}
          </template>
          
          <template v-slot:item.is_replacement_week="{ item }">
            <v-icon v-if="item.is_replacement_week" color="error" title="Flock replacement due">mdi-alert-circle</v-icon>
            <v-icon v-else color="success" title="Normal production">mdi-check-circle</v-icon>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Loading State -->
    <v-card v-else-if="loading" elevation="4">
      <v-card-text class="text-center py-12">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <div class="text-h6 mt-4">Generating regional forecast...</div>
      </v-card-text>
    </v-card>

    <!-- Empty State -->
    <v-card v-else elevation="4">
      <v-card-text class="text-center py-12">
        <v-icon size="80" color="grey-lighten-1">mdi-map-marker-radius</v-icon>
        <div class="text-h6 mt-4 text-medium-emphasis">
          Enter a postcode prefix and click "Generate Regional Forecast"
        </div>
        <div class="text-body-2 mt-2 text-medium-emphasis">
          Example: Enter "12" to include all barns with postcodes starting with 12 (12XXX)
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useEggProductionStore } from '@/stores/eggProduction'
import { useChickenStore } from '@/stores/chickens'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const eggStore = useEggProductionStore()
const chickenStore = useChickenStore()

const regionPostcode = ref('')
const forecastWeeks = ref(80)
const loading = ref(false)
const regionalBarns = ref([])
const selectedRegionInfo = ref(null)

const forecast = computed(() => eggStore.forecast)

const trendColor = computed(() => {
  if (!forecast.value) return 'grey'
  switch (forecast.value.summary.trend) {
    case 'increasing': return 'success'
    case 'stable': return 'info'
    case 'decreasing': return 'warning'
    default: return 'grey'
  }
})

const trendIcon = computed(() => {
  if (!forecast.value) return 'mdi-trending-flat'
  switch (forecast.value.summary.trend) {
    case 'increasing': return 'mdi-trending-up'
    case 'stable': return 'mdi-trending-flat'
    case 'decreasing': return 'mdi-trending-down'
    default: return 'mdi-trending-flat'
  }
})

const barnHeaders = [
  { title: 'Barn Name', key: 'name', width: '25%' },
  { title: 'Postcode', key: 'postcode', align: 'center', width: '15%' },
  { title: 'Capacity', key: 'capacity', align: 'center', width: '15%' },
  { title: 'Current Hens', key: 'chicken_count', align: 'center', width: '15%' },
  { title: 'Utilization', key: 'utilization', width: '30%' },
]

const replacementHeaders = [
  { title: 'Flock', key: 'flock_name', width: '25%' },
  { title: 'Barn', key: 'coop_name', width: '25%' },
  { title: 'Current Age', key: 'current_age_weeks', align: 'center', width: '15%' },
  { title: 'Replacement Due', key: 'replacement_due_week', align: 'center', width: '15%' },
  { title: 'Status', key: 'status', width: '20%' },
]

const forecastHeaders = [
  { title: 'Week', key: 'week', align: 'center', width: '10%' },
  { title: 'Date', key: 'date', width: '15%' },
  { title: 'Predicted Eggs', key: 'predicted_eggs', align: 'center', width: '15%' },
  { title: 'Confidence Interval', key: 'confidence', align: 'center', width: '20%' },
  { title: 'Status', key: 'is_replacement_week', align: 'center', width: '10%' },
]

const formatNumber = (num: number) => {
  return num.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

const getEggColor = (eggs: number) => {
  if (eggs >= 500) return 'success'
  if (eggs >= 300) return 'info'
  if (eggs >= 100) return 'warning'
  return 'error'
}

const getUtilizationColor = (current: number, capacity: number) => {
  if (!current || current === 0) return 'grey'
  const ratio = current / capacity
  if (ratio < 0.5) return 'info'
  if (ratio < 0.8) return 'success'
  return 'warning'
}

const onPostcodeInput = () => {
  // Only allow digits, max 2 characters
  regionPostcode.value = regionPostcode.value.replace(/[^0-9]/g, '').slice(0, 2)
}

const loadRegionalForecast = async () => {
  if (!regionPostcode.value || regionPostcode.value.length !== 2) {
    alert('Please enter a valid 2-digit postcode prefix (e.g., 12, 80, 69)')
    return
  }

  loading.value = true
  try {
    // Fetch all coops/barns
    const coopsResponse = await fetch('/api/coops')
    const allCoops = await coopsResponse.json()

    // Filter barns by postcode prefix
    const filteredBarns = allCoops.filter((coop: any) => 
      coop.postcode && coop.postcode.startsWith(regionPostcode.value)
    )

    if (filteredBarns.length === 0) {
      alert(`No barns found with postcode prefix "${regionPostcode.value}"`)
      loading.value = false
      selectedRegionInfo.value = null
      regionalBarns.value = []
      return
    }

    // Get flock data for these barns
    const flocksResponse = await fetch('/api/flocks')
    const allFlocks = await flocksResponse.json()

    // Filter flocks belonging to the selected barns
    const barnIds = filteredBarns.map((b: any) => b.id)
    const filteredFlocks = allFlocks.filter((flock: any) => 
      flock.coop_id && barnIds.includes(flock.coop_id)
    )

    // Calculate region info
    const totalHens = filteredFlocks.reduce((sum: number, f: any) => sum + f.count, 0)
    const totalCapacity = filteredBarns.reduce((sum: number, b: any) => sum + b.capacity, 0)

    selectedRegionInfo.value = {
      prefix: regionPostcode.value,
      barnCount: filteredBarns.length,
      totalHens,
      totalCapacity,
      barns: filteredBarns,
      flocks: filteredFlocks
    }

    regionalBarns.value = filteredBarns.map((barn: any) => ({
      ...barn,
      chicken_count: filteredFlocks
        .filter((f: any) => f.coop_id === barn.id && f.status === 'active')
        .reduce((sum: number, f: any) => sum + f.count, 0)
    }))

    // Generate forecast for the region
    await eggStore.generateRegionalForecast({
      weeks: forecastWeeks.value,
      coop_ids: barnIds,
      flock_ids: filteredFlocks.map((f: any) => f.id)
    })
  } catch (error) {
    console.error('Error generating regional forecast:', error)
    alert('Failed to generate regional forecast. Please try again.')
  } finally {
    loading.value = false
  }
}

const forecastChartData = computed(() => {
  if (!forecast.value) return null

  const historicalData = eggStore.records.slice(-30)
  const historicalLabels = historicalData.map(d => {
    const date = new Date(d.date)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const forecastLabels = forecast.value.forecast.map((item: any, idx: number) => `W${item.week}`)

  return {
    labels: [...historicalLabels, ...forecastLabels],
    datasets: [
      {
        label: 'Historical Production',
        data: [
          ...historicalData.map(d => d.egg_count),
          ...Array(forecast.value.forecast.length).fill(null)
        ],
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Predicted Production',
        data: [
          ...Array(historicalData.length).fill(null),
          ...forecast.value.forecast.map((d: any) => d.predicted_eggs)
        ],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
        tension: 0.4,
        borderDash: [5, 5],
      },
      {
        label: 'Lower Bound',
        data: [
          ...Array(historicalData.length).fill(null),
          ...forecast.value.forecast.map((d: any) => d.lower_bound)
        ],
        borderColor: 'rgba(158, 158, 158, 0.5)',
        backgroundColor: 'rgba(158, 158, 158, 0.1)',
        fill: '+1',
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'Upper Bound',
        data: [
          ...Array(historicalData.length).fill(null),
          ...forecast.value.forecast.map((d: any) => d.upper_bound)
        ],
        borderColor: 'rgba(158, 158, 158, 0.5)',
        backgroundColor: 'rgba(158, 158, 158, 0.0)',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      }
    ]
  }
})

const forecastChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    }
  },
  scales: {
    x: {
      title: { display: true, text: 'Time (Historical → Forecast)' },
      ticks: { maxTicksLimit: 20 }
    },
    y: {
      title: { display: true, text: 'Eggs per Day' },
      beginAtZero: true
    }
  }
}

onMounted(async () => {
  await chickenStore.fetchCoops()
})
</script>
