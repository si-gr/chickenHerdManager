<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-egg-outline</v-icon>
          Egg Production Tracking
        </h1>
      </v-col>
      <v-col cols="auto">
        <v-btn color="primary" @click="showAddDialog = true">
          <v-icon left class="mr-2">mdi-plus</v-icon>
          Record Eggs
        </v-btn>
      </v-col>
    </v-row>

    <!-- Date Range Filter -->
    <v-card class="mb-6" elevation="2">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="startDate"
              label="Start Date"
              type="date"
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="endDate"
              label="End Date"
              type="date"
              variant="outlined"
              density="compact"
            ></v-text-field>
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
            <v-btn color="primary" @click="loadRecords" block>
              <v-icon left class="mr-2">mdi-magnify</v-icon>
              Search
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Production Chart -->
    <v-card class="mb-6" elevation="4">
      <v-card-title>
        <v-icon left class="mr-2">mdi-chart-timeline-variant</v-icon>
        Daily Production
      </v-card-title>
      <v-card-text>
        <Line v-if="chartData" :data="chartData" :options="chartOptions" height="250" />
        <div v-else class="text-center py-8 text-medium-emphasis">
          No production data for selected period
        </div>
      </v-card-text>
    </v-card>

    <!-- Production Records Table -->
    <v-card elevation="4">
      <v-card-title>
        <v-icon left class="mr-2">mdi-table</v-icon>
        Production Records
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="headers"
          :items="eggStore.records"
          :loading="eggStore.loading"
          :items-per-page="15"
          class="elevation-1"
        >
          <template v-slot:item.egg_count="{ item }">
            <v-chip :color="item.egg_count > 0 ? 'success' : 'grey'" size="small">
              {{ item.egg_count }}
            </v-chip>
          </template>

          <template v-slot:item.actions="{ item }">
            <v-icon size="small" class="mr-2" @click="editRecord(item)">
              mdi-pencil
            </v-icon>
            <v-icon size="small" color="error" @click="confirmDelete(item)">
              mdi-delete
            </v-icon>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="showDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>
          <v-icon left class="mr-2">{{ editingRecord ? 'mdi-pencil' : 'mdi-plus' }}</v-icon>
          {{ editingRecord ? 'Edit Record' : 'Record Egg Production' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="form" v-model="formValid">
            <v-text-field
              v-model="formData.date"
              label="Date"
              type="date"
              :rules="[v => !!v || 'Date is required']"
              variant="outlined"
            ></v-text-field>

            <v-select
              v-model="formData.chicken_id"
              :items="chickenStore.activeChickens"
              item-title="name"
              item-value="id"
              label="Chicken (optional)"
              clearable
              variant="outlined"
            ></v-select>

            <v-select
              v-model="formData.coop_id"
              :items="chickenStore.coops"
              item-title="name"
              item-value="id"
              label="Coop (optional)"
              clearable
              variant="outlined"
            ></v-select>

            <v-text-field
              v-model.number="formData.egg_count"
              label="Number of Eggs"
              type="number"
              min="0"
              :rules="[v => v >= 0 || 'Must be 0 or more']"
              variant="outlined"
            ></v-text-field>

            <v-textarea
              v-model="formData.notes"
              label="Notes"
              rows="2"
              variant="outlined"
            ></v-textarea>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="closeDialog" :disabled="saving">Cancel</v-btn>
          <v-btn color="primary" @click="saveRecord" :loading="saving" :disabled="!formValid">
            {{ editingRecord ? 'Update' : 'Save' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>
          <v-icon left color="error" class="mr-2">mdi-alert</v-icon>
          Confirm Delete
        </v-card-title>
        <v-card-text>
          Are you sure you want to delete this egg production record?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteRecord" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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

const showDialog = ref(false)
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const editingRecord = ref(null)
const deletingRecord = ref(null)
const saving = ref(false)
const deleting = ref(false)
const formValid = ref(false)
const form = ref(null)

const today = new Date().toISOString().split('T')[0]
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const startDate = ref(thirtyDaysAgo)
const endDate = ref(today)
const filterCoop = ref(null)

const formData = ref({
  date: today,
  chicken_id: null,
  coop_id: null,
  egg_count: 0,
  notes: '',
})

const headers = [
  { title: 'Date', key: 'date', width: '15%' },
  { title: 'Chicken', key: 'chicken_name', width: '20%' },
  { title: 'Breed', key: 'chicken_breed', width: '20%' },
  { title: 'Coop', key: 'coop_name', width: '20%' },
  { title: 'Eggs', key: 'egg_count', align: 'center', width: '10%' },
  { title: 'Notes', key: 'notes', width: '10%' },
  { title: 'Actions', key: 'actions', sortable: false, width: '5%' },
]

const coopOptions = computed(() => chickenStore.coops)

// Chart data from daily summary
const chartData = computed(() => {
  const summary = eggStore.dailySummary
  if (!summary || summary.length === 0) return null

  return {
    labels: summary.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [{
      label: 'Daily Egg Count',
      data: summary.map(d => d.total_eggs),
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: true,
      tension: 0.4,
    }]
  }
})

const chartOptions = {
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
      ticks: { maxTicksLimit: 15 }
    },
    y: {
      title: { display: true, text: 'Eggs' },
      beginAtZero: true
    }
  }
}

const loadRecords = async () => {
  const params = {
    start_date: startDate.value,
    end_date: endDate.value,
  }
  if (filterCoop.value) params.coop_id = filterCoop.value

  await Promise.all([
    eggStore.fetchRecords(params),
    eggStore.fetchDailySummary(params),
  ])
}

const editRecord = (record) => {
  editingRecord.value = record
  formData.value = {
    date: record.date,
    chicken_id: record.chicken_id,
    coop_id: record.coop_id,
    egg_count: record.egg_count,
    notes: record.notes,
  }
  showDialog.value = true
}

const closeDialog = () => {
  showDialog.value = false
  editingRecord.value = null
  formData.value = {
    date: today,
    chicken_id: null,
    coop_id: null,
    egg_count: 0,
    notes: '',
  }
}

const saveRecord = async () => {
  if (!formValid.value) return

  saving.value = true
  try {
    if (editingRecord.value) {
      await eggStore.updateRecord(editingRecord.value.id, formData.value)
    } else {
      await eggStore.addRecord(formData.value)
    }
    closeDialog()
    await loadRecords()
  } catch (error) {
    console.error('Error saving record:', error)
  } finally {
    saving.value = false
  }
}

const confirmDelete = (record) => {
  deletingRecord.value = record
  showDeleteDialog.value = true
}

const deleteRecord = async () => {
  deleting.value = true
  try {
    await eggStore.deleteRecord(deletingRecord.value.id)
    showDeleteDialog.value = false
    deletingRecord.value = null
    await loadRecords()
  } catch (error) {
    console.error('Error deleting record:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await chickenStore.fetchChickens()
  await chickenStore.fetchCoops()
  await loadRecords()
})
</script>
