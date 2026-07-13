<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-cog</v-icon>
          Forecasting Settings
        </h1>
      </v-col>
      <v-col cols="auto">
        <v-btn color="primary" @click="saveSettings" :loading="saving">
          <v-icon left class="mr-2">mdi-content-save</v-icon>
          Save Changes
        </v-btn>
      </v-col>
    </v-row>

    <!-- General Parameters -->
    <v-card class="mb-6" elevation="2">
      <v-card-title>
        <v-icon left class="mr-2">mdi-chart-line</v-icon>
        Production Forecast Parameters
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-slider
              v-model="params.feed_quality_factor"
              label="Feed Quality Factor"
              min="0.5"
              max="1.5"
              step="0.05"
              thumb-label="always"
              hint="Multiplier for egg production (0.5 = poor feed, 1.5 = premium feed)"
              persistent-hint
            ></v-slider>
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="params.peak_production_age"
              label="Peak Production Age (weeks)"
              type="number"
              min="20"
              max="50"
              variant="outlined"
              hint="Age when egg production reaches maximum"
              persistent-hint
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="params.peak_production_rate"
              label="Peak Production Rate (eggs/hen/week)"
              type="number"
              min="3"
              max="8"
              step="0.1"
              variant="outlined"
              hint="Maximum eggs per hen per week at peak"
              persistent-hint
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="4">
            <v-slider
              v-model="params.production_decline_rate"
              label="Production Decline Rate (per week)"
              min="0.01"
              max="0.05"
              step="0.001"
              thumb-label="always"
              hint="Weekly decline rate after peak"
              persistent-hint
            ></v-slider>
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="params.replacement_threshold"
              label="Replacement Threshold (weeks)"
              type="number"
              min="60"
              max="100"
              variant="outlined"
              hint="Age to replace flock with new birds"
              persistent-hint
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="4">
            <v-text-field
              v-model.number="params.target_flock_size"
              label="Target Flock Size"
              type="number"
              min="10"
              max="500"
              variant="outlined"
              hint="Default number of hens per new flock"
              persistent-hint
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Hen Depreciation / Mortality -->
    <v-card class="mb-6" elevation="2">
      <v-card-title>
        <v-icon left class="mr-2">mdi-trending-down</v-icon>
        Hen Depreciation & Mortality
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="params.weekly_mortality_rate"
              label="Weekly Mortality Rate"
              type="number"
              step="0.001"
              min="0"
              max="0.05"
              variant="outlined"
              hint="Percentage of hens lost per week (0.005 = 0.5%/week ≈ 26%/year)"
              persistent-hint
              suffix="hens/week"
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="6">
            <v-alert type="info" variant="tonal" class="mt-4">
              <strong>Annual Loss:</strong> {{ ((1 - Math.pow(1 - params.weekly_mortality_rate, 52)) * 100).toFixed(1) }}%
              <br>
              <small>Typical range: 0.3-0.7% per week (15-30% annually)</small>
            </v-alert>
          </v-col>
        </v-row>

        <v-alert type="warning" variant="tonal" class="mt-4">
          <strong>Impact on Forecast:</strong> Hen counts decrease weekly by this rate. 
          A 0.5% weekly loss means a flock of 100 hens loses ~0-1 hen/week initially, 
          compounding to ~26 hens lost over a year. Forecast automatically adjusts egg 
          production based on surviving hen count.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Molting Schedule -->
    <v-card class="mb-6" elevation="2">
      <v-card-title>
        <v-icon left class="mr-2">mdi-feather</v-icon>
        Molting Schedule
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="params.molting_start_age"
              label="Molting Start Age (weeks)"
              type="number"
              min="50"
              max="80"
              variant="outlined"
              hint="Typical age to induce molting"
              persistent-hint
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="params.molting_duration"
              label="Molting Duration (weeks)"
              type="number"
              min="4"
              max="12"
              variant="outlined"
              hint="Expected duration of molting period"
              persistent-hint
            ></v-text-field>
          </v-col>
        </v-row>

        <v-alert type="info" variant="tonal" class="mt-4">
          <strong>About Molting:</strong> Induced molting is a management practice where hens are 
          deliberately put through a rest period to rejuvenate egg production. During molting, 
          egg production drops significantly but resumes afterward at a higher rate than if 
          molting hadn't occurred.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Breed-Specific Curves -->
    <v-card class="mb-6" elevation="2">
      <v-card-title>
        <v-icon left class="mr-2">mdi-chicken</v-icon>
        Breed Characteristics
      </v-card-title>
      <v-card-text>
        <p class="text-body-1 mb-4">
          Different chicken breeds have different production characteristics. 
          These values are used in forecasting when breed-specific data is available.
        </p>

        <v-data-table
          :headers="breedHeaders"
          :items="breedCurves"
          class="elevation-1"
          hide-default-footer
        >
          <template v-slot:item.peak="{ item }">
            <v-chip color="success" size="small">{{ item.peak }} eggs/week</v-chip>
          </template>
          <template v-slot:item.decline="{ item }">
            {{ (item.decline * 100).toFixed(2) }}%/week
          </template>
        </v-data-table>

        <v-alert type="warning" variant="tonal" class="mt-4">
          <strong>Note:</strong> Breed-specific adjustments are informational only in this version. 
          To customize breed curves, modify the forecast API route directly.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Tooltip Display Options -->
    <v-card class="mb-6" elevation="2">
      <v-card-title>
        <v-icon left class="mr-2">mdi-tooltip-text</v-icon>
        Forecast Tooltip Display Options
      </v-card-title>
      <v-card-text>
        <p class="text-body-1 mb-4">
          Customize what information appears when hovering over the forecast chart.
        </p>

        <v-row>
          <v-col cols="12" md="6">
            <v-switch
              v-model="uiPrefs.ui_show_tooltip_details"
              label="📊 Show detailed tooltip information"
              hint="Enable/disable all detailed hover information on forecast chart"
              persistent-hint
              color="primary"
            ></v-switch>
          </v-col>

          <v-col cols="12" md="6">
            <v-switch
              v-model="uiPrefs.ui_show_flock_breakdown"
              label="🐔 Show per-flock contribution breakdown"
              hint="Display each flock's egg production (hens × rate = eggs)"
              persistent-hint
              color="primary"
            ></v-switch>
          </v-col>

          <v-col cols="12" md="6">
            <v-switch
              v-model="uiPrefs.ui_show_base_rate_formula"
              label="🧮 Show base rate calculation formula"
              hint="Display how age-based production rates are calculated"
              persistent-hint
              color="primary"
            ></v-switch>
          </v-col>

          <v-col cols="12" md="6">
            <v-switch
              v-model="uiPrefs.ui_show_confidence_details"
              label="🎯 Show confidence interval statistics"
              hint="Display ±%, statistical method, and numeric bounds"
              persistent-hint
              color="primary"
            ></v-switch>
          </v-col>

          <v-col cols="12" md="6">
            <v-switch
              v-model="uiPrefs.ui_show_production_phase"
              label="📈 Show production phase indicator"
              hint="Display current phase (pre-laying, ramp-up, peak, molting, post-molt)"
              persistent-hint
              color="primary"
            ></v-switch>
          </v-col>
        </v-row>

        <v-alert type="info" variant="tonal" class="mt-4">
          <strong>Tip:</strong> Disable some options for a cleaner tooltip view, or enable all for complete transparency on forecast calculations.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Replacement Strategy -->
    <v-card class="mb-6" elevation="2">
      <v-card-title>
        <v-icon left class="mr-2">mdi-swap-horizontal</v-icon>
        Flock Replacement Strategy
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="replacementStrategy"
              :items="replacementStrategies"
              label="Replacement Strategy"
              variant="outlined"
              hint="How to handle flock replacement timing"
              persistent-hint
            ></v-select>
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model.number="overlapWeeks"
              label="Overlap Period (weeks)"
              type="number"
              min="0"
              max="12"
              variant="outlined"
              hint="Weeks of overlap between old and new flocks"
              persistent-hint
            ></v-text-field>
          </v-col>
        </v-row>

        <v-alert type="success" variant="tonal" class="mt-4">
          <strong>Zero Production Gap Strategy:</strong> To maintain continuous egg production, 
          plan new flock introductions {{ overlapWeeks }} weeks before retiring old flocks. 
          The forecast highlights replacement weeks to help with planning.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Reset to Defaults -->
    <v-card elevation="2">
      <v-card-text class="text-center">
        <v-btn color="error" variant="outlined" @click="resetToDefaults">
          <v-icon left class="mr-2">mdi-refresh</v-icon>
          Reset to Default Values
        </v-btn>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const saving = ref(false)
const replacementStrategy = ref('staggered')
const overlapWeeks = ref(4)

const params = ref({
  feed_quality_factor: 1.0,
  peak_production_age: 32,
  peak_production_rate: 5.5,
  production_decline_rate: 0.02,
  molting_start_age: 60,
  molting_duration: 8,
  replacement_threshold: 80,
  target_flock_size: 100,
  weekly_mortality_rate: 0.005
})

const uiPrefs = ref({
  ui_show_tooltip_details: true,
  ui_show_base_rate_formula: false,
  ui_show_flock_breakdown: true,
  ui_show_confidence_details: true,
  ui_show_production_phase: true
})

const breedHeaders = [
  { title: 'Breed', key: 'breed', width: '25%' },
  { title: 'Peak Production', key: 'peak', align: 'center', width: '25%' },
  { title: 'Decline Rate', key: 'decline', align: 'center', width: '25%' },
  { title: 'Description', key: 'description', width: '25%' },
]

const breedCurves = ref([
  { breed: 'Rhode Island Red', peak: 5.5, decline: 0.02, description: 'Reliable layer, good temperament' },
  { breed: 'Leghorn', peak: 6.0, decline: 0.018, description: 'High production, lightweight' },
  { breed: 'Plymouth Rock', peak: 5.0, decline: 0.022, description: 'Dual-purpose, cold hardy' },
  { breed: 'Australorp', peak: 5.5, decline: 0.02, description: 'Record holder, calm nature' },
  { breed: 'Orpington', peak: 4.5, decline: 0.025, description: 'Large, broody, good winter layer' }
])

const replacementStrategies = [
  { title: 'Staggered (recommended)', value: 'staggered' },
  { title: 'All-at-once', value: 'all-at-once' },
  { title: 'Continuous flow', value: 'continuous' }
]

const defaultParams = {
  feed_quality_factor: 1.0,
  peak_production_age: 32,
  peak_production_rate: 5.5,
  production_decline_rate: 0.02,
  molting_start_age: 60,
  molting_duration: 8,
  replacement_threshold: 80,
  target_flock_size: 100,
  weekly_mortality_rate: 0.005
}

const loadSettings = async () => {
  try {
    await settingsStore.fetchParameters()
    if (settingsStore.parameters && Object.keys(settingsStore.parameters).length > 0) {
      params.value = { ...defaultParams, ...settingsStore.parameters }
      // Load UI preferences
      uiPrefs.value = {
        ui_show_tooltip_details: settingsStore.parameters.ui_show_tooltip_details !== 0,
        ui_show_base_rate_formula: settingsStore.parameters.ui_show_base_rate_formula === 1,
        ui_show_flock_breakdown: settingsStore.parameters.ui_show_flock_breakdown !== 0,
        ui_show_confidence_details: settingsStore.parameters.ui_show_confidence_details !== 0,
        ui_show_production_phase: settingsStore.parameters.ui_show_production_phase !== 0
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    // Save production parameters
    await settingsStore.saveParameters(params.value)
    
    // Save UI preferences
    const uiParams = {
      ui_show_tooltip_details: uiPrefs.value.ui_show_tooltip_details ? 1 : 0,
      ui_show_base_rate_formula: uiPrefs.value.ui_show_base_rate_formula ? 1 : 0,
      ui_show_flock_breakdown: uiPrefs.value.ui_show_flock_breakdown ? 1 : 0,
      ui_show_confidence_details: uiPrefs.value.ui_show_confidence_details ? 1 : 0,
      ui_show_production_phase: uiPrefs.value.ui_show_production_phase ? 1 : 0
    }
    await settingsStore.saveParameters(uiParams)
  } catch (error) {
    console.error('Error saving settings:', error)
  } finally {
    saving.value = false
  }
}

const resetToDefaults = () => {
  params.value = { ...defaultParams }
}

onMounted(() => {
  loadSettings()
})
</script>
