<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-barn</v-icon>
          Barn Management
        </h1>
      </v-col>
      <v-col cols="auto">
        <v-btn color="primary" @click="showAddDialog = true">
          <v-icon left class="mr-2">mdi-plus</v-icon>
          Add Barn
        </v-btn>
      </v-col>
    </v-row>

    <!-- Summary Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card color="primary" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-barn</v-icon>
            <div class="text-h3">{{ coops.length }}</div>
            <div class="text-subtitle-1">Total Barns</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="success" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chicken</v-icon>
            <div class="text-h3">{{ totalCapacity }}</div>
            <div class="text-subtitle-1">Total Capacity</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="info" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-map-marker</v-icon>
            <div class="text-h3">{{ coopsWithPostcode }}</div>
            <div class="text-subtitle-1">Barns with Postcode</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card :color="avgCapacityColor" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-gauge</v-icon>
            <div class="text-h3">{{ avgCapacity }}</div>
            <div class="text-subtitle-1">Avg Capacity</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Barns Table -->
    <v-card elevation="4">
      <v-card-title>
        <v-icon left class="mr-2">mdi-table</v-icon>
        All Barns
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="coopHeaders"
          :items="coops"
          :items-per-page="15"
          class="elevation-1"
        >
          <template v-slot:item.postcode="{ item }">
            <v-chip v-if="item.postcode" color="info" size="small">
              {{ item.postcode }}
            </v-chip>
            <span v-else class="text-medium-emphasis">—</span>
          </template>

          <template v-slot:item.chicken_count="{ item }">
            <v-chip :color="getCapacityColor(item.chicken_count, item.capacity)" size="small">
              {{ item.chicken_count || 0 }} / {{ item.capacity }}
            </v-chip>
          </template>

          <template v-slot:item.actions="{ item }">
            <v-btn icon size="small" color="primary" @click="editCoop(item)">
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
            <v-btn icon size="small" color="error" @click="deleteCoop(item)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Add/Edit Barn Dialog -->
    <v-dialog v-model="showAddDialog" max-width="600px">
      <v-card>
        <v-card-title>
          {{ editingCoop ? 'Edit Barn' : 'Add New Barn' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValid">
            <v-text-field
              v-model="formData.name"
              label="Barn Name"
              :rules="[v => !!v || 'Name is required']"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model.number="formData.capacity"
              label="Capacity (hens)"
              type="number"
              min="1"
              :rules="[v => v > 0 || 'Capacity must be positive']"
              variant="outlined"
              class="mb-4"
            ></v-text-field>

            <v-text-field
              v-model="formData.postcode"
              label="Postcode"
              :rules="[v => !!v || 'Postcode is required']"
              variant="outlined"
              class="mb-4"
              hint="Every barn must have a postcode associated with it"
              persistent-hint
            ></v-text-field>

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
          <v-btn color="primary" @click="saveCoop" :loading="saving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useChickenStore } from '@/stores/chickens'

const chickenStore = useChickenStore()

const coops = ref([])
const loading = ref(false)
const saving = ref(false)
const showAddDialog = ref(false)
const editingCoop = ref(null)
const formValid = ref(false)
const formRef = ref(null)

const formData = ref({
  name: '',
  capacity: 50,
  postcode: '',
  notes: ''
})

const coopHeaders = [
  { title: 'Name', key: 'name', width: '20%' },
  { title: 'Capacity', key: 'capacity', align: 'center', width: '15%' },
  { title: 'Postcode', key: 'postcode', align: 'center', width: '20%' },
  { title: 'Current Hens', key: 'chicken_count', align: 'center', width: '15%' },
  { title: 'Notes', key: 'notes', width: '20%' },
  { title: 'Actions', key: 'actions', align: 'center', width: '10%', sortable: false },
]

const totalCapacity = computed(() => coops.value.reduce((sum, c) => sum + c.capacity, 0))
const coopsWithPostcode = computed(() => coops.value.filter(c => c.postcode).length)
const avgCapacity = computed(() => {
  if (coops.value.length === 0) return 0
  return Math.round(totalCapacity.value / coops.value.length)
})

const avgCapacityColor = computed(() => {
  if (avgCapacity.value < 50) return 'warning'
  if (avgCapacity.value < 100) return 'success'
  return 'info'
})

const getCapacityColor = (current, capacity) => {
  if (!current || current === 0) return 'grey'
  const ratio = current / capacity
  if (ratio < 0.5) return 'info'
  if (ratio < 0.8) return 'success'
  return 'warning'
}

const loadCoops = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/coops')
    coops.value = await response.json()
  } catch (error) {
    console.error('Error loading coops:', error)
  } finally {
    loading.value = false
  }
}

const editCoop = (coop) => {
  editingCoop.value = coop
  formData.value = {
    name: coop.name,
    capacity: coop.capacity,
    postcode: coop.postcode || '',
    notes: coop.notes || ''
  }
  showAddDialog.value = true
}

const closeDialog = () => {
  showAddDialog.value = false
  editingCoop.value = null
  formData.value = {
    name: '',
    capacity: 50,
    postcode: '',
    notes: ''
  }
  if (formRef.value) formRef.value.reset()
}

const saveCoop = async () => {
  if (!formValid.value) return
  
  saving.value = true
  try {
    const url = editingCoop.value 
      ? `/api/coops/${editingCoop.value.id}`
      : '/api/coops'
    
    const method = editingCoop.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData.value)
    })
    
    if (!response.ok) throw new Error('Failed to save coop')
    
    await loadCoops()
    closeDialog()
  } catch (error) {
    console.error('Error saving coop:', error)
  } finally {
    saving.value = false
  }
}

const deleteCoop = async (coop) => {
  if (!confirm(`Delete barn "${coop.name}"? This cannot be undone.`)) return
  
  try {
    const response = await fetch(`/api/coops/${coop.id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete coop')
    await loadCoops()
  } catch (error) {
    console.error('Error deleting coop:', error)
  }
}

onMounted(async () => {
  await loadCoops()
})
</script>
