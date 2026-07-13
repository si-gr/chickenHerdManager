<template>
  <v-container fluid>
    <v-row class="mb-6" align="center">
      <v-col>
        <h1 class="text-h4">
          <v-icon class="mr-2">mdi-chicken-variant</v-icon>
          Chicken Breeds
        </h1>
      </v-col>
      <v-col cols="auto">
        <v-btn color="primary" @click="showAddDialog = true">
          <v-icon left class="mr-2">mdi-plus</v-icon>
          Add Breed
        </v-btn>
      </v-col>
    </v-row>

    <!-- Info Banner -->
    <v-alert type="info" variant="tonal" class="mb-6" border="start" elevation="2">
      <div class="d-flex align-start">
        <v-icon size="32" class="mr-3 mt-1">mdi-information</v-icon>
        <div>
          <strong>Breed Management</strong>
          <p class="mb-0 text-body-2">
            Define production characteristics for different chicken breeds. These parameters are used in 
            <router-link to="/forecast">forecasts</router-link> and when creating new 
            <router-link to="/flocks">flocks</router-link>. Each breed has unique egg production curves, 
            temperament, and hardiness traits.
          </p>
        </div>
      </div>
    </v-alert>

    <!-- Summary Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card color="primary" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chicken-variant</v-icon>
            <div class="text-h3">{{ breeds.length }}</div>
            <div class="text-subtitle-1">Total Breeds</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="success" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-check-circle</v-icon>
            <div class="text-h3">{{ activeBreeds }}</div>
            <div class="text-subtitle-1">Active Breeds</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="info" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-egg</v-icon>
            <div class="text-h3">{{ avgPeakProduction }}</div>
            <div class="text-subtitle-1">Avg Peak (eggs/wk)</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card color="warning" dark elevation="4">
          <v-card-text class="text-center">
            <v-icon size="48" class="mb-2">mdi-chart-line</v-icon>
            <div class="text-h3">{{ avgDeclineRate }}%</div>
            <div class="text-subtitle-1">Avg Decline Rate</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filters -->
    <v-card class="mb-6" elevation="2">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="searchQuery"
              label="Search breeds"
              prepend-inner-icon="mdi-magnify"
              clearable
              variant="outlined"
              density="compact"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filterEggColor"
              :items="eggColorOptions"
              label="Egg Color"
              clearable
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filterSize"
              :items="sizeOptions"
              label="Size"
              clearable
              variant="outlined"
              density="compact"
            ></v-select>
          </v-col>

          <v-col cols="12" md="3">
            <v-switch
              v-model="showActiveOnly"
              label="Show active only"
              hide-details
              class="mt-4"
            ></v-switch>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Breeds Table -->
    <v-card elevation="4">
      <v-card-title>
        <v-icon left class="mr-2">mdi-table</v-icon>
        All Breeds
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="breedHeaders"
          :items="filteredBreeds"
          :items-per-page="15"
          class="elevation-1"
        >
          <template v-slot:item.is_active="{ item }">
            <v-chip :color="item.is_active ? 'success' : 'grey'" size="small">
              {{ item.is_active ? 'Active' : 'Inactive' }}
            </v-chip>
          </template>

          <template v-slot:item.peak_production_rate="{ item }">
            <v-chip color="success" size="small">{{ item.peak_production_rate }}/week</v-chip>
          </template>

          <template v-slot:item.decline_rate="{ item }">
            {{ (item.decline_rate * 100).toFixed(2) }}%/wk
          </template>

          <template v-slot:item.egg_color="{ item }">
            <v-chip :color="getEggColorChip(item.egg_color)" size="small">
              {{ item.egg_color || '—' }}
            </v-chip>
          </template>

          <template v-slot:item.size="{ item }">
            <v-chip size="small" color="grey-lighten-1">
              {{ item.size || '—' }}
            </v-chip>
          </template>

          <template v-slot:item.actions="{ item }">
            <v-btn icon size="small" color="primary" @click="editBreed(item)">
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
            <v-btn icon size="small" color="error" @click="confirmDelete(item)" :disabled="item.flock_count > 0">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="showAddDialog" max-width="900" persistent scrollable>
      <v-card>
        <v-card-title>
          <v-icon left class="mr-2">{{ editingBreed ? 'mdi-pencil' : 'mdi-plus' }}</v-icon>
          {{ editingBreed ? 'Edit Breed' : 'Add New Breed' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="formRef" v-model="formValid">
            <!-- Basic Info -->
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.name"
                  label="Breed Name *"
                  :rules="[v => !!v || 'Name is required']"
                  variant="outlined"
                  hint="e.g., Rhode Island Red, Leghorn"
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.is_active"
                  :items="[true, false]"
                  item-title="text"
                  item-value="value"
                  label="Status"
                  variant="outlined"
                >
                  <template v-slot:selection="{ item }">
                    <v-chip :color="item.value ? 'success' : 'grey'" size="small">
                      {{ item.value ? 'Active' : 'Inactive' }}
                    </v-chip>
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="formData.description"
                  label="Description"
                  variant="outlined"
                  rows="2"
                  hint="Brief description of the breed's characteristics"
                  persistent-hint
                ></v-textarea>
              </v-col>
            </v-row>

            <!-- Production Characteristics -->
            <v-divider class="my-4"></v-divider>
            <h3 class="text-h6 mb-3">
              <v-icon left class="mr-2">mdi-chart-timeline-variant</v-icon>
              Production Characteristics
            </h3>
            
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.production_curve_type"
                  :items="curveTypeOptions"
                  label="Production Curve Type"
                  variant="outlined"
                  hint="Choose preset or custom curve"
                  persistent-hint
                ></v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-alert type="info" variant="tonal" density="compact" class="mt-4">
                  <strong>Tip:</strong> Select "Custom" to define your own production function
                </v-alert>
              </v-col>
            </v-row>

            <!-- Simple mode: standard parameters -->
            <template v-if="!formData.production_curve_type || formData.production_curve_type === 'standard'">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.peak_production_rate"
                    label="Peak Production (eggs/week)"
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    variant="outlined"
                    hint="Maximum eggs per hen per week at peak"
                    persistent-hint
                  ></v-text-field>
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.peak_production_age"
                    label="Peak Age (weeks)"
                    type="number"
                    min="20"
                    max="50"
                    variant="outlined"
                    hint="Age when production peaks"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>

              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.decline_rate"
                    label="Decline Rate (per week after peak)"
                    type="number"
                    min="0.01"
                    max="0.1"
                    step="0.001"
                    variant="outlined"
                    hint="Weekly production decline as fraction (e.g., 0.02)"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>
            </template>

            <!-- Custom mode: full function definition -->
            <template v-if="formData.production_curve_type === 'custom'">
              <v-alert type="warning" variant="tonal" class="my-3">
                <strong>Custom Production Function:</strong> Define each phase of the egg production curve.
              </v-alert>

              <h4 class="text-subtitle-1 mb-2">📈 Ramp-up Phase (20-32 weeks typical)</h4>
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.custom_ramp_start_age"
                    label="Ramp Start Age (weeks)"
                    type="number"
                    min="16"
                    max="24"
                    variant="outlined"
                    hint="When hens start laying"
                    persistent-hint
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.custom_ramp_end_age"
                    label="Ramp End Age (weeks)"
                    type="number"
                    min="28"
                    max="40"
                    variant="outlined"
                    hint="When peak is reached"
                    persistent-hint
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.custom_peak_rate"
                    label="Peak Rate (eggs/hen/week)"
                    type="number"
                    min="3"
                    max="8"
                    step="0.1"
                    variant="outlined"
                    hint="Maximum production rate"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>

              <h4 class="text-subtitle-1 mb-2 mt-4">📉 Decline Phase (32-60 weeks typical)</h4>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.custom_decline_start_age"
                    label="Decline Start Age (weeks)"
                    type="number"
                    min="50"
                    max="70"
                    variant="outlined"
                    hint="When steeper decline begins"
                    persistent-hint
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.custom_decline_rate"
                    label="Decline Rate (per week)"
                    type="number"
                    min="0.005"
                    max="0.1"
                    step="0.001"
                    variant="outlined"
                    hint="Weekly decline during peak phase"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>

              <h4 class="text-subtitle-1 mb-2 mt-4">🪶 Molting Phase (60-68 weeks typical)</h4>
              <v-row>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.custom_molt_start_age"
                    label="Molt Start Age (weeks)"
                    type="number"
                    min="55"
                    max="75"
                    variant="outlined"
                    hint="When molting begins"
                    persistent-hint
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.custom_molt_duration"
                    label="Molt Duration (weeks)"
                    type="number"
                    min="4"
                    max="12"
                    variant="outlined"
                    hint="How long molting lasts"
                    persistent-hint
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="formData.custom_molt_rate"
                    label="Molt Rate (eggs/hen/week)"
                    type="number"
                    min="0"
                    max="4"
                    step="0.1"
                    variant="outlined"
                    hint="Production during molt"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>

              <h4 class="text-subtitle-1 mb-2 mt-4">🔄 Post-Molt Phase (68+ weeks)</h4>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.custom_post_molt_rate"
                    label="Post-Molt Rate (eggs/hen/week)"
                    type="number"
                    min="2"
                    max="5"
                    step="0.1"
                    variant="outlined"
                    hint="Recovery production rate"
                    persistent-hint
                  ></v-text-field>
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model.number="formData.custom_post_molt_decline"
                    label="Post-Molt Decline (per week)"
                    type="number"
                    min="0.02"
                    max="0.15"
                    step="0.001"
                    variant="outlined"
                    hint="Steeper decline after molt"
                    persistent-hint
                  ></v-text-field>
                </v-col>
              </v-row>
            </template>

            <!-- Physical Characteristics -->
            <v-divider class="my-4"></v-divider>
            <h3 class="text-h6 mb-3">
              <v-icon left class="mr-2">mdi-paw</v-icon>
              Physical Characteristics
            </h3>

            <v-row>
              <v-col cols="12" md="4">
                <v-select
                  v-model="formData.size"
                  :items="sizeOptions"
                  label="Size"
                  variant="outlined"
                ></v-select>
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="formData.egg_color"
                  :items="eggColorOptions"
                  label="Egg Color"
                  variant="outlined"
                ></v-select>
              </v-col>

              <v-col cols="12" md="4">
                <v-text-field
                  v-model="formData.temperament"
                  label="Temperament"
                  variant="outlined"
                  hint="e.g., Friendly, Calm, Active"
                  persistent-hint
                ></v-text-field>
              </v-col>
            </v-row>


          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="closeDialog">Cancel</v-btn>
          <v-btn color="primary" @click="saveBreed" :loading="saving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon left color="error" class="mr-2">mdi-alert</v-icon>
          Confirm Delete
        </v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deletingBreed?.name }}</strong>?
          <v-alert type="warning" variant="tonal" class="mt-3" v-if="deletingBreed?.flock_count > 0">
            <strong>Warning:</strong> This breed is used by {{ deletingBreed.flock_count }} flock(s). 
            You must reassign or delete these flocks first.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteBreed" :loading="deleting" :disabled="deletingBreed?.flock_count > 0">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const breeds = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const editingBreed = ref(null)
const deletingBreed = ref(null)
const formValid = ref(false)
const formRef = ref(null)

const searchQuery = ref('')
const filterEggColor = ref(null)
const filterSize = ref(null)
const showActiveOnly = ref(true)

const formData = ref({
  name: '',
  description: '',
  peak_production_rate: 5.0,
  peak_production_age: 32,
  decline_rate: 0.02,
  temperament: '',
  size: '',
  egg_color: '',
  is_active: true,
  // Custom production curve fields
  production_curve_type: 'standard',
  custom_ramp_start_age: 20,
  custom_ramp_end_age: 32,
  custom_peak_rate: 5.5,
  custom_decline_start_age: 60,
  custom_decline_rate: 0.02,
  custom_molt_start_age: 60,
  custom_molt_duration: 8,
  custom_molt_rate: 2.0,
  custom_post_molt_rate: 3.5,
  custom_post_molt_decline: 0.08
})

const curveTypeOptions = [
  { title: '📊 Standard (default)', value: 'standard' },
  { title: '⚡ Early Peak (28w)', value: 'early_peak' },
  { title: '🐢 Late Peak (36w)', value: 'late_peak' },
  { title: '➖ Flat (slow decline)', value: 'flat' },
  { title: '📉 Steep Decline', value: 'steep_decline' },
  { title: '🔧 Custom (define all)', value: 'custom' }
]

const sizeOptions = ['Bantam', 'Small', 'Medium', 'Large', 'Very Large']
const eggColorOptions = ['White', 'Cream', 'Tinted', 'Brown', 'Dark Brown', 'Blue', 'Green', 'Blue/Green', 'Pink', 'Varies']

const breedHeaders = [
  { title: 'Name', key: 'name', width: '20%' },
  { title: 'Status', key: 'is_active', align: 'center', width: '10%' },
  { title: 'Peak Rate', key: 'peak_production_rate', align: 'center', width: '12%' },
  { title: 'Peak Age', key: 'peak_production_age', align: 'center', width: '10%' },
  { title: 'Decline', key: 'decline_rate', align: 'center', width: '10%' },
  { title: 'Egg Color', key: 'egg_color', align: 'center', width: '12%' },
  { title: 'Size', key: 'size', align: 'center', width: '10%' },
  { title: 'Actions', key: 'actions', align: 'center', width: '16%', sortable: false },
]

const filteredBreeds = computed(() => {
  let result = [...breeds.value]

  if (showActiveOnly.value) {
    result = result.filter(b => b.is_active)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(b => 
      b.name.toLowerCase().includes(query) ||
      b.description?.toLowerCase().includes(query) ||
      b.temperament?.toLowerCase().includes(query)
    )
  }

  if (filterEggColor.value) {
    result = result.filter(b => b.egg_color === filterEggColor.value)
  }

  if (filterSize.value) {
    result = result.filter(b => b.size === filterSize.value)
  }

  return result
})

const activeBreeds = computed(() => breeds.value.filter(b => b.is_active).length)
const avgPeakProduction = computed(() => {
  const active = breeds.value.filter(b => b.is_active)
  if (active.length === 0) return 0
  const avg = active.reduce((sum, b) => sum + b.peak_production_rate, 0) / active.length
  return avg.toFixed(1)
})
const avgDeclineRate = computed(() => {
  const active = breeds.value.filter(b => b.is_active)
  if (active.length === 0) return 0
  const avg = active.reduce((sum, b) => sum + b.decline_rate, 0) / active.length
  return (avg * 100).toFixed(2)
})

const getEggColorChip = (color) => {
  const map: Record<string, string> = {
    'White': 'grey-lighten-3',
    'Cream': 'amber-lighten-4',
    'Tinted': 'brown-lighten-4',
    'Brown': 'brown',
    'Dark Brown': 'brown-darken-2',
    'Blue': 'blue-lighten-4',
    'Green': 'green-lighten-3',
    'Blue/Green': 'teal-lighten-3',
    'Pink': 'pink-lighten-4'
  }
  return map[color] || 'grey'
}

const loadBreeds = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/breeds?active_only=false')
    const data = await response.json()
    
    // Get flock counts for each breed
    const flockResponse = await fetch('/api/flocks')
    const flocks = await flockResponse.json()
    
    breeds.value = data.map((breed: any) => ({
      ...breed,
      flock_count: flocks.filter((f: any) => f.breed === breed.name).length
    }))
  } catch (error) {
    console.error('Error loading breeds:', error)
  } finally {
    loading.value = false
  }
}

const editBreed = (breed) => {
  editingBreed.value = breed
  formData.value = {
    name: breed.name,
    description: breed.description || '',
    peak_production_rate: breed.peak_production_rate,
    peak_production_age: breed.peak_production_age,
    decline_rate: breed.decline_rate,
    temperament: breed.temperament || '',
    size: breed.size || '',
    egg_color: breed.egg_color || '',
    is_active: !!breed.is_active,
    // Custom curve fields
    production_curve_type: breed.production_curve_type || 'standard',
    custom_ramp_start_age: breed.custom_ramp_start_age || 20,
    custom_ramp_end_age: breed.custom_ramp_end_age || 32,
    custom_peak_rate: breed.custom_peak_rate || 5.5,
    custom_decline_start_age: breed.custom_decline_start_age || 60,
    custom_decline_rate: breed.custom_decline_rate || 0.02,
    custom_molt_start_age: breed.custom_molt_start_age || 60,
    custom_molt_duration: breed.custom_molt_duration || 8,
    custom_molt_rate: breed.custom_molt_rate || 2.0,
    custom_post_molt_rate: breed.custom_post_molt_rate || 3.5,
    custom_post_molt_decline: breed.custom_post_molt_decline || 0.08
  }
  showAddDialog.value = true
}

const closeDialog = () => {
  showAddDialog.value = false
  editingBreed.value = null
  formData.value = {
    name: '',
    description: '',
    peak_production_rate: 5.0,
    peak_production_age: 32,
    decline_rate: 0.02,
    temperament: '',
    size: '',
    egg_color: '',
    is_active: true,
    production_curve_type: 'standard',
    custom_ramp_start_age: 20,
    custom_ramp_end_age: 32,
    custom_peak_rate: 5.5,
    custom_decline_start_age: 60,
    custom_decline_rate: 0.02,
    custom_molt_start_age: 60,
    custom_molt_duration: 8,
    custom_molt_rate: 2.0,
    custom_post_molt_rate: 3.5,
    custom_post_molt_decline: 0.08
  }
  if (formRef.value) formRef.value.reset()
}

const saveBreed = async () => {
  if (!formValid.value) return
  
  saving.value = true
  try {
    const url = editingBreed.value 
      ? `/api/breeds/${editingBreed.value.id}`
      : '/api/breeds'
    
    const method = editingBreed.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData.value)
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save breed')
    }
    
    await loadBreeds()
    closeDialog()
  } catch (error) {
    console.error('Error saving breed:', error)
    alert(error.message)
  } finally {
    saving.value = false
  }
}

const confirmDelete = (breed) => {
  deletingBreed.value = breed
  showDeleteDialog.value = true
}

const deleteBreed = async () => {
  if (!deletingBreed.value) return
  
  deleting.value = true
  try {
    const response = await fetch(`/api/breeds/${deletingBreed.value.id}`, { method: 'DELETE' })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete breed')
    }
    await loadBreeds()
    showDeleteDialog.value = false
    deletingBreed.value = null
  } catch (error) {
    console.error('Error deleting breed:', error)
    alert(error.message)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadBreeds()
})
</script>

<style scoped>
.gap-1 {
  gap: 4px;
}
</style>
