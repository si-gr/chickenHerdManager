<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-chart-timeline-variant</v-icon>
          Egg Production Forecast
        </h1>
      </v-col>
    </v-row>

    <!-- Forecast Settings -->
    <v-card class="mb-6" elevation="2">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-select
              v-model="forecastWeeks"
              :items="weekOptions"
              label="Forecast Horizon"
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filterCoop"
              :items="coopOptions"
              item-title="name"
              item-value="id"
              label="Filter by Coop"
              clearable
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filterFlock"
              :items="flockOptions"
              label="Filter by Flock"
              clearable
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-btn color="primary" @click="loadForecast" block>
              <v-icon left class="mr-2">mdi-refresh</v-icon>
              Generate Forecast
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

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

    <!-- Flock & Replacement Info -->
    <v-row class="mb-6" v-if="forecast">
      <v-col cols="12" md="6">
        <v-card elevation="4" color="warning" dark>
          <v-card-text class="text-center">
            <v-icon size="40" class="mb-2">mdi-account-group</v-icon>
            <div class="text-h4">{{ forecast.summary.total_flocks || 0 }} flocks</div>
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

    <!-- Replacement Planning Table -->
    <v-card class="mb-6" elevation="4" v-if="forecast?.replacement_planning?.length > 0">
      <v-card-title>
        <v-icon left class="mr-2">mdi-alert-circle</v-icon>
        Upcoming Flock Replacements
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
        Production Forecast with Confidence Interval
      </v-card-title>
      <v-card-text>
        <Line :data="forecastChartData" :options="forecastChartOptions" height="350" />
      </v-card-text>
    </v-card>

    <!-- Historical + Forecast Data Table -->
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
        <div class="text-h6 mt-4">Generating forecast...</div>
      </v-card-text>
    </v-card>

    <!-- Empty State -->
    <v-card v-else elevation="4">
      <v-card-text class="text-center py-12">
        <v-icon size="80" color="grey-lighten-1">mdi-chart-timeline-variant</v-icon>
        <div class="text-h6 mt-4 text-medium-emphasis">
          Configure forecast settings and click "Generate Forecast"
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

const forecastWeeks = ref(80)
const filterCoop = ref(null)
const filterFlock = ref(null)
const flocks = ref([])
const loading = ref(false)

const forecast = computed(() => eggStore.forecast)
const coopOptions = computed(() => chickenStore.coops)

const weekOptions = [
  { title: '4 weeks', value: 4 },
  { title: '12 weeks', value: 12 },
  { title: '26 weeks (6 months)', value: 26 },
  { title: '52 weeks (1 year)', value: 52 },
  { title: '80 weeks (production cycle)', value: 80 },
]

const flockOptions = computed(() => flocks.value.map(f => ({ title: `${f.name} - ${f.breed} (${f.count} hens)`, value: f.id })))

const trendColor = computed(() => {
  switch (forecast.value?.summary?.trend) {
    case 'increasing': return 'success'
    case 'decreasing': return 'error'
    default: return 'info'
  }
})

const trendIcon = computed(() => {
  switch (forecast.value?.summary?.trend) {
    case 'increasing': return 'mdi-trending-up'
    case 'decreasing': return 'mdi-trending-down'
    default: return 'mdi-trending-neutral'
  }
})

const forecastHeaders = [
  { title: 'Week', key: 'week', align: 'center', width: '8%' },
  { title: 'Date', key: 'date', width: '18%' },
  { title: 'Predicted Eggs', key: 'predicted_eggs', align: 'center', width: '15%' },
  { title: 'Confidence Interval', key: 'confidence', width: '22%' },
  { title: 'Lower Bound', key: 'lower_bound', align: 'center', width: '12%' },
  { title: 'Upper Bound', key: 'upper_bound', align: 'center', width: '12%' },
  { title: 'Replacement', key: 'is_replacement_week', align: 'center', width: '13%' },
]

const replacementHeaders = [
  { title: 'Flock', key: 'flock_name', width: '25%' },
  { title: 'Breed', key: 'breed', width: '20%' },
  { title: 'Current Age', key: 'current_age_weeks', align: 'center', width: '20%' },
  { title: 'Replacement Due', key: 'replacement_due_week', align: 'center', width: '15%' },
  { title: 'Due Date', key: 'replacement_due_date', width: '20%' },
]

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K'
  return num.toString()
}

const forecastChartData = computed(() => {
  if (!forecast.value) return { labels: [], datasets: [] }

  const historical = forecast.value.historical || []
  const predicted = forecast.value.forecast || []

  const labels = [
    ...historical.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    ...predicted.map(d => `W${d.week}`),
  ]

  const historicalData = historical.map(d => d.eggs)
  const predictedData = [
    ...Array(historical.length).fill(null),
    ...predicted.map(d => d.predicted_eggs),
  ]
  const upperData = [
    ...Array(historical.length).fill(null),
    ...predicted.map(d => d.upper_bound),
  ]
  const lowerData = [
    ...Array(historical.length).fill(null),
    ...predicted.map(d => d.lower_bound),
  ]

  // Mark replacement weeks
  const replacementWeeks = predicted.filter(w => w.is_replacement_week).map(w => w.week)
  const replacementAnnotations = predicted.map((d, i) => {
    if (d.is_replacement_week) {
      return {
        type: 'line',
        xMin: historical.length + i,
        xMax: historical.length + i,
        borderColor: 'rgba(244, 67, 54, 0.5)',
        borderWidth: 2,
        borderDash: [5, 5],
        label: { content: 'Replace', display: true, position: 'start' }
      }
    }
    return null
  }).filter(a => a !== null)

  return {
    labels,
    datasets: [
      {
        label: 'Historical',
        data: historicalData,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      },
      {
        label: 'Predicted',
        data: predictedData,
        borderColor: '#2196F3',
        borderDash: [5, 5],
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        fill: false,
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: 'Upper Bound',
        data: upperData,
        borderColor: 'rgba(33, 150, 243, 0.3)',
        backgroundColor: 'rgba(33, 150, 243, 0.05)',
        fill: '+1',
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: 'Lower Bound',
        data: lowerData,
        borderColor: 'rgba(33, 150, 243, 0.3)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  }
})

const forecastChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: { boxWidth: 12 }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (items) => {
          const idx = items[0].dataIndex
          const historical = forecast.value?.historical || []
          const weeklyData = forecast.value?.weekly_data || forecast.value?.forecast || []
          
          // Check if hovering over historical or predicted
          if (idx < historical.length) {
            const h = historical[idx]
            return `📅 ${h.date} (Historical)`
          } else {
            const weekIdx = idx - historical.length
            const week = weeklyData[weekIdx]
            if (week) {
              return `Week ${week.week} — ${week.date}`
            }
            return `Week ${weekIdx + 1}`
          }
        },
        label: (context) => {
          const dataset = context.dataset.label
          const value = context.parsed.y
          if (value === null) return null
          
          const historical = forecast.value?.historical || []
          const weeklyData = forecast.value?.weekly_data || forecast.value?.forecast || []
          const weekIdx = context.dataIndex - historical.length
          const week = weeklyData[weekIdx]
          
          if (dataset === 'Predicted') {
            return [`🥚 Predicted: ${value.toFixed(1)} eggs/week`]
          }
          if (dataset === 'Upper Bound') {
            const range = week ? (week.upper_bound - week.lower_bound).toFixed(1) : 'N/A'
            return [`📈 Upper (95% CI): ${value.toFixed(1)} eggs (range: ${range})`]
          }
          if (dataset === 'Lower Bound') {
            return [`📉 Lower (95% CI): ${value.toFixed(1)} eggs`]
          }
          if (dataset === 'Historical') {
            return [`✅ Actual: ${value.toFixed(1)} eggs`]
          }
          return `${dataset}: ${value.toFixed(1)}`
        },
        afterBody: (items) => {
          const historical = forecast.value?.historical || []
          const weeklyData = forecast.value?.weekly_data || forecast.value?.forecast || []
          const uiPrefs = forecast.value?.ui_preferences || {}
          const weekIdx = items[0].dataIndex - historical.length
          const week = weeklyData[weekIdx]
          
          // Check if tooltips are enabled
          if (!week || uiPrefs.show_tooltip_details === false) return ''
          
          const lines = []
          lines.push('─────────────────────────────')
          lines.push('📊 CALCULATION DETAILS')
          lines.push('─────────────────────────────')
          
          // Flock breakdown
          if (uiPrefs.show_flock_breakdown !== false) {
            lines.push('🐔 CONTRIBUTIONS BY FLOCK:')
            if (week.flock_contributions && week.flock_contributions.length > 0) {
              week.flock_contributions.forEach(fc => {
                const henChange = fc.hens_lost > 0 ? `(-${fc.hens_lost})` : ''
                lines.push(`   • ${fc.flock_name} (${fc.breed}): ${fc.eggs.toFixed(0)} eggs`)
                lines.push(`     ${fc.hens_end} hens${henChange} × ${fc.rate_after_feed.toFixed(2)} = Age ${fc.age_weeks}w`)
              })
            } else {
              lines.push('   No active flocks')
            }
            const henLossText = week.hens_lost_this_week > 0 ? `| Lost: ${week.hens_lost_this_week}` : ''
            lines.push('📈 WEEK SUMMARY:' + `   Flocks: ${week.num_active_flocks || 0} | Hens: ${week.total_hens_end || 0}${henLossText} | Avg age: ${week.avg_flock_age?.toFixed(1) || 0}w`)
          }
          
          // Production phase
          if (uiPrefs.show_production_phase !== false) {
            const avgAge = week.avg_flock_age || 0
            let phase = '', phaseDesc = ''
            if (avgAge < 20) { phase = 'Pre-laying'; phaseDesc = 'not yet laying' }
            else if (avgAge < 32) { phase = 'Ramp-up'; phaseDesc = 'to peak' }
            else if (avgAge < 60) { phase = 'Peak/Decline'; phaseDesc = 'gradual' }
            else if (avgAge < 68) { phase = 'Molting'; phaseDesc = 'reduced' }
            else { phase = 'Post-molt'; phaseDesc = 'steeper decline' }
            lines.push(`📊 PHASE (${avgAge.toFixed(0)}w): ${phase} — ${phaseDesc}`)
          }
          
          // Confidence interval details
          if (uiPrefs.show_confidence_details !== false) {
            const confPct = (week.confidence_factor * 100)?.toFixed(1) || 15
            lines.push(`🎯 CI(95%): ±${confPct}% | Range: ${week.lower_bound?.toFixed(0) || 0}–${week.upper_bound?.toFixed(0) || 0} eggs`)
          }
          
          // Special indicators
          const indicators = []
          if (week.is_molting_period) indicators.push('🪶 Molting')
          if (week.is_replacement_week) indicators.push('🔄 Replacement')
          if (indicators.length === 0) indicators.push('✓ Normal')
          lines.push(`⚠️ ${indicators.join(' | ')}`)

          
          // Base rate formula details
          if (uiPrefs.show_base_rate_formula !== false && week.flock_contributions && week.flock_contributions.length > 0) {
            const ex = week.flock_contributions[0]
            let formula = ''
            if (ex.age_weeks < 20) formula = 'base=0 (pre-laying)'
            else if (ex.age_weeks < 32) formula = `base=3.5+((age-20)/12)×2.0 = ${ex.base_rate.toFixed(2)}`
            else if (ex.age_weeks < 60) formula = `base=5.5-((age-32)×0.02) = ${ex.base_rate.toFixed(2)}`
            else if (ex.age_weeks < 68) formula = 'base=2.0 (molting)'
            else formula = `base=3.5-((age-68)×0.08) = ${ex.base_rate.toFixed(2)}`
            lines.push(`🧮 FORMULA: ${formula} | Final=${ex.base_rate.toFixed(2)}×${week.feed_quality_factor?.toFixed(2)||1}=${ex.rate_after_feed.toFixed(2)}`)
          }
          
          return lines.join('\n')
        },
        footer: (items) => {
          return '💡 eggs=Σ(hens×base_rate(age)×feed) | Peak@32w:5.5 | Decline:-0.02/wk | Molt@60-67w:2.0 | Replace@80w'
        }
      }
    }
  },
  scales: {
    x: {
      title: { display: true, text: 'Time' },
      ticks: { maxTicksLimit: 20 }
    },
    y: {
      title: { display: true, text: 'Eggs per Week' },
      beginAtZero: true
    }
  }
}

const getEggColor = (eggs) => {
  if (eggs >= 100) return 'success'
  if (eggs >= 70) return 'info'
  if (eggs >= 40) return 'warning'
  return 'error'
}

const loadForecast = async () => {
  loading.value = true
  try {
    const params = { weeks: forecastWeeks.value }
    if (filterCoop.value) params.coop_id = filterCoop.value
    if (filterFlock.value) params.flock_id = filterFlock.value
    await eggStore.fetchForecast(params)
  } finally {
    loading.value = false
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
    chickenStore.fetchCoops(),
    loadFlocks()
  ])
  loadForecast()
})
</script>
