<template>
  <v-container fluid class="pa-6">
    <v-card elevation="2" max-width="1200" class="mx-auto">
      <v-card-title class="text-h4 font-weight-bold pa-4">
        <v-icon class="mr-2">mdi-shield-account</v-icon>
        Admin Panel
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- Login Form -->
        <div v-if="!isLoggedIn" class="mt-4">
          <v-alert type="info" variant="tonal" class="mb-4">
            Please log in with admin credentials to access user management.
          </v-alert>
          
          <v-form @submit.prevent="handleLogin" class="max-width-400 mx-auto">
            <v-text-field
              v-model="loginForm.username"
              label="Username"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              required
              class="mb-3"
            />
            
            <v-text-field
              v-model="loginForm.password"
              label="Password"
              type="password"
              prepend-inner-icon="mdi-lock"
              variant="outlined"
              required
              class="mb-4"
              @keyup.enter="handleLogin"
            />
            
            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loginLoading"
            >
              Login
            </v-btn>
          </v-form>
        </div>

        <!-- User Management (after login) -->
        <div v-else>
          <div class="d-flex justify-space-between align-center mb-4">
            <div>
              <span class="text-body-1 mr-2">Logged in as:</span>
              <v-chip color="primary" size="small">{{ currentUser.username }}</v-chip>
              <v-chip :color="currentUser.role === 'admin' ? 'error' : 'success'" size="small" class="ml-2">
                {{ currentUser.role }}
              </v-chip>
            </div>
            <v-btn color="secondary" variant="outlined" @click="handleLogout">
              <v-icon start>mdi-logout</v-icon>
              Logout
            </v-btn>
          </div>

          <!-- Add New User Button -->
          <v-btn color="primary" class="mb-4" @click="showAddUserDialog = true">
            <v-icon start>mdi-account-plus</v-icon>
            Add New User
          </v-btn>

          <!-- Users Table -->
          <v-table density="comfortable" class="elevation-1">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.username }}</td>
                <td>
                  <v-chip :color="user.role === 'admin' ? 'error' : 'success'" size="small">
                    {{ user.role }}
                  </v-chip>
                </td>
                <td>
                  <v-chip :color="user.is_active ? 'green' : 'grey'" size="small">
                    {{ user.is_active ? 'Active' : 'Inactive' }}
                  </v-chip>
                </td>
                <td>{{ formatDate(user.created_at) }}</td>
                <td>
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    color="primary"
                    @click="editUser(user)"
                    class="mr-1"
                  />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    @click="confirmDeleteUser(user)"
                    :disabled="user.id === currentUser.id"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>

    <!-- Add/Edit User Dialog -->
    <v-dialog v-model="userDialog" max-width="500">
      <v-card>
        <v-card-title>
          {{ editMode ? 'Edit User' : 'Add New User' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="userForm">
            <v-text-field
              v-model="userFormModel.username"
              label="Username"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              :required="!editMode"
              :disabled="editMode"
              class="mb-3"
            />
            
            <v-text-field
              v-model="userFormModel.password"
              label="Password"
              type="password"
              prepend-inner-icon="mdi-lock"
              variant="outlined"
              :required="!editMode"
              :hint="editMode ? 'Leave blank to keep current password' : ''"
              class="mb-3"
            />
            
            <v-select
              v-model="userFormModel.role"
              :items="['admin', 'user']"
              label="Role"
              prepend-inner-icon="mdi-badge-account"
              variant="outlined"
              required
              class="mb-3"
            />
            
            <v-switch
              v-model="userFormModel.isActive"
              label="Active"
              color="success"
              hide-details
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="userDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveUser" :loading="savingUser">
            {{ editMode ? 'Update' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete user <strong>{{ userToDelete?.username }}</strong>?
          This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteUser" :loading="deletingUser">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const API_BASE = '/api'

// Auth state
const isLoggedIn = ref(false)
const loginLoading = ref(false)
const currentUser = ref<any>(null)
const authToken = ref<string | null>(null)

// Login form
const loginForm = ref({
  username: '',
  password: ''
})

// Users list
const users = ref<any[]>([])

// User dialog
const userDialog = ref(false)
const showAddUserDialog = ref(false)
const editMode = ref(false)
const savingUser = ref(false)
const userFormModel = ref({
  id: null as number | null,
  username: '',
  password: '',
  role: 'user' as 'admin' | 'user',
  isActive: true
})

// Delete dialog
const deleteDialog = ref(false)
const deletingUser = ref(false)
const userToDelete = ref<any>(null)

// API helper with auth
function apiClient() {
  return axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': authToken.value ? `Bearer ${authToken.value}` : ''
    }
  })
}

// Check for existing token on mount
onMounted(() => {
  const savedToken = localStorage.getItem('adminToken')
  const savedUser = localStorage.getItem('adminUser')
  
  if (savedToken && savedUser) {
    authToken.value = savedToken
    currentUser.value = JSON.parse(savedUser)
    isLoggedIn.value = true
    loadUsers()
  }
})

// Watch for add user dialog
import { watch } from 'vue'
watch(showAddUserDialog, (newVal) => {
  if (newVal) {
    openAddUserDialog()
  }
})

// Login
async function handleLogin() {
  loginLoading.value = true
  
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, loginForm.value)
    
    if (response.data.success) {
      authToken.value = response.data.token
      currentUser.value = response.data.user
      
      // Save to localStorage
      localStorage.setItem('adminToken', response.data.token)
      localStorage.setItem('adminUser', JSON.stringify(response.data.user))
      
      isLoggedIn.value = true
      loginForm.value = { username: '', password: '' }
      
      await loadUsers()
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Login failed')
  } finally {
    loginLoading.value = false
  }
}

// Logout
function handleLogout() {
  authToken.value = null
  currentUser.value = null
  isLoggedIn.value = false
  users.value = []
  
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminUser')
}

// Load users
async function loadUsers() {
  try {
    const response = await apiClient().get('/admin/users')
    if (response.data.success) {
      users.value = response.data.users
    }
  } catch (error: any) {
    console.error('Failed to load users:', error)
    if (error.response?.status === 401) {
      handleLogout()
    }
  }
}

// Open add user dialog
function openAddUserDialog() {
  editMode.value = false
  userFormModel.value = {
    id: null,
    username: '',
    password: '',
    role: 'user',
    isActive: true
  }
  userDialog.value = true
  showAddUserDialog.value = false
}

// Edit user
function editUser(user: any) {
  editMode.value = true
  userFormModel.value = {
    id: user.id,
    username: user.username,
    password: '',
    role: user.role,
    isActive: user.is_active
  }
  userDialog.value = true
}

// Save user (create or update)
async function saveUser() {
  savingUser.value = true
  
  try {
    if (editMode.value) {
      // Update existing user
      const updateData: any = {
        role: userFormModel.value.role,
        isActive: userFormModel.value.isActive
      }
      if (userFormModel.value.password) {
        updateData.password = userFormModel.value.password
      }
      
      await apiClient().put(`/admin/users/${userFormModel.value.id}`, updateData)
    } else {
      // Create new user
      await apiClient().post('/admin/users', {
        username: userFormModel.value.username,
        password: userFormModel.value.password,
        role: userFormModel.value.role,
        isActive: userFormModel.value.isActive
      })
    }
    
    userDialog.value = false
    await loadUsers()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to save user')
  } finally {
    savingUser.value = false
  }
}

// Confirm delete
function confirmDeleteUser(user: any) {
  userToDelete.value = user
  deleteDialog.value = true
}

// Delete user
async function deleteUser() {
  deletingUser.value = true
  
  try {
    await apiClient().delete(`/admin/users/${userToDelete.value.id}`)
    deleteDialog.value = false
    userToDelete.value = null
    await loadUsers()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Failed to delete user')
  } finally {
    deletingUser.value = false
  }
}

// Format date
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>

<style scoped>
.max-width-400 {
  max-width: 400px;
}
</style>
