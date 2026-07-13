<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-chicken</v-icon>
          Flock Management
        </h1>
      </v-col>
      <v-col cols="auto">
        <v-btn color="primary" @click="showAddDialog = true">
          <v-icon left class="mr-2">mdi-plus</v-icon>
          Add Flock
        </v-btn>
      </v-col>
    </v-row>

    <!-- Summary Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card color="primary" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-account-group</v-icon>
            <div class="text-h3">{{ flocks.length }}</div>
            <div class="text-subtitle-1">Total Flocks</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="success" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chicken</v-icon>
            <div class="text-h3">{{ totalHens }}</div>
            <div class="text-subtitle-1">Total Hens</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="info" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-egg</v-icon>
            <div class="text-h3">{{ activeFlocks }}</div>
            <div class="text-subtitle-1">Active Flocks</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card :color="avgAgeColor" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-calendar-clock</v-icon>
            <div class="text-h3">{{ avgAgeWeeks }}</div>
            <div class="text-subtitle-1">Avg Age (weeks)</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Flocks Table -->
    <v-card elevation="4">
      <v-card-title>
        <v-icon left class="mr-2">mdi-table</v-icon>
        All Flocks
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="flockHeaders"
          :items="flocks"
          :items-per-page="15"
          class="elevation-1"
        >
          <template v-slot:item.status="{ item }">
            <v-chip :color="getStatusColor(item.status)" size="small">
              {{ item.status }}
            </v-chip>
          </template>

          <template v-slot:item.age_weeks="{ item }">
            <v-chip :color="getAgeColor(item.age_weeks)" size="small">
              {{ item.age_weeks }} weeks
            </v-chip>
          </template>

          <template v-slot:item.production_rate="{ item }">
            {{ getProductionRate(item.age_weeks) }}%
          </template>

          <template v-slot:item.actions="{ item }">
            <v-btn icon size="small" color="primary" @click="editFlock(item)">
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
            <v-btn icon size="small" color="error" @click="deleteFlock(item)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Add/Edit Flock Dialog -->
    <v-dialog v-model="showAddDialog" max-width="600px">
      <v-card>
        <v-card-title>
          {{ editingFlock ? 'Edit Flock' : 'Add New Flock' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValid">
            <v-text-field
              v-model="formData.name"
              label="Flock Name"
              :rules="[v => !!v || 'Name is required']"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-select
              v-model="formData.breed"
              :items="breedOptions"
              label="Breed"
              :rules="[v => !!v || 'Breed is required']"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-text-field
              v-model.number="formData.count"
              label="Number of Hens"
              type="number"
              min="1"
              :rules="[v => v > 0 || 'Count must be positive']"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="formData.birth_date"
              label="Birth Date / Hatch Date"
              type="date"
              :rules="[v => !!v || 'Birth date is required']"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-select
              v-model="formData.coop_id"
              :items="coopOptions"
              item-title="name"
              item-value="id"
              label="Coop"
              clearable
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-select
              v-model="formData.status"
              :items="statusOptions"
              label="Status"
              variant="outlined"
              class="mb-4"
            ></v-select>

            <v-text-field
              v-model="formData.notes"
              label="Notes"
              variant="outlined"
              rows="3"
              multiline
            ></v-text-field>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveFlock" :loading="saving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChickenStore } from '@/stores/chickens'

const chickenStore = useChickenStore()

const flocks = ref([])
const loading = ref(false)
const saving = ref(false)
const showAddDialog = ref(false)
const editingFlock = ref(null)
const formValid = ref(false)
const formRef = ref(null)

const formData = ref({
  name: '',
  breed: '',
  count: 0,
  birth_date: '',
  coop_id: null,
  status: 'active',
  notes: ''
})

const breedOptions = [
  'Rhode Island Red',
  'Leghorn',
  'Plymouth Rock',
  'Australorp',
  'Orpington',
  'Sussex',
  'Wyandotte',
  'Mixed'
]

const statusOptions = ['active', 'molt', 'retired', 'dead']

const flockHeaders = [
  { title: 'Name', key: 'name', width: '15%' },
  { title: 'Breed', key: 'breed', width: '15%' },
  { title: 'Count', key: 'count', align: 'center', width: '10%' },
  { title: 'Age', key: 'age_weeks', align: 'center', width: '10%' },
  { title: 'Coop', key: 'coop_name', width: '15%' },
  { title: 'Status', key: 'status', align: 'center', width: '12%' },
  { title: 'Prod. Rate', key: 'production_rate', align: 'center', width: '10%' },
  { title: 'Actions', key: 'actions', align: 'center', width: '13%', sortable: false },
]

const totalHens = computed(() => flocks.value.reduce((sum, f) => sum + f.count, 0))
const activeFlocks = computed(() => flocks.value.filter(f => f.status === 'active').length)
const avgAgeWeeks = computed(() => {
  if (flocks.value.length === 0) return 0
  const total = flocks.value.reduce((sum, f) => sum + f.age_weeks, 0)
  return Math.round(total / flocks.value.length)
})

const avgAgeColor = computed(() => {
  if (avgAgeWeeks.value < 30) return 'success'
  if (avgAgeWeeks.value < 60) return 'info'
  if (avgAgeWeeks.value < 80) return 'warning'
  return 'error'
})

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'success'
    case 'molt': return 'warning'
    case 'retired': return 'info'
    case 'dead': return 'grey'
    default: return 'grey'
  }
}

const getAgeColor = (age) => {
  if (age < 20) return 'info' // Too young to lay
  if (age < 32) return 'success' // Approaching peak
  if (age < 60) return 'success' // Peak production
  if (age < 80) return 'warning' // Declining
  return 'error' // Ready for replacement
}

const getProductionRate = (ageWeeks) => {
  if (ageWeeks < 20) return 0
  if (ageWeeks < 32) return Math.round(50 + ((ageWeeks - 20) / 12) * 40)
  if (ageWeeks < 60) return Math.round(90 - ((ageWeeks - 32) * 1.5))
  return Math.max(30, Math.round(75 - ((ageWeeks - 60) * 2)))
}

const loadFlocks = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/flocks')
    flocks.value = await response.json()
  } catch (error) {
    console.error('Error loading flocks:', error)
  } finally {
    loading.value = false
  }
}

const editFlock = (flock) => {
  editingFlock.value = flock
  formData.value = {
    name: flock.name,
    breed: flock.breed,
    count: flock.count,
    birth_date: flock.birth_date,
    coop_id: flock.coop_id,
    status: flock.status,
    notes: flock.notes || ''
  }
  showAddDialog.value = true
}

const closeDialog = () => {
  showAddDialog.value = false
  editingFlock.value = null
  formData.value = {
    name: '',
    breed: '',
    count: 0,
    birth_date: '',
    coop_id: null,
    status: 'active',
    notes: ''
  }
  if (formRef.value) formRef.value.reset()
}

const saveFlock = async () => {
  if (!formValid.value) return
  
  saving.value = true
  try {
    const url = editingFlock.value 
      ? `/api/flocks/${editingFlock.value.id}`
      : '/api/flocks'
    
    const method = editingFlock.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData.value)
    })
    
    if (!response.ok) throw new Error('Failed to save flock')
    
    await loadFlocks()
    closeDialog()
  } catch (error) {
    console.error('Error saving flock:', error)
  } finally {
    saving.value = false
  }
}

const deleteFlock = async (flock) => {
  if (!confirm(`Delete flock "${flock.name}"? This cannot be undone.`)) return
  
  try {
    const response = await fetch(`/api/flocks/${flock.id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete flock')
    await loadFlocks()
  } catch (error) {
    console.error('Error deleting flock:', error)
  }
}

const coopOptions = computed(() => chickenStore.coops)

onMounted(async () => {
  await chickenStore.fetchCoops()
  await loadFlocks()
})
</script>
