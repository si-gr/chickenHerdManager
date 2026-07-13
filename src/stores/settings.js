import { defineStore } from 'pinia'
import apiClient from '@/services/axios'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    parameters: {},
    loading: false,
    error: null,
  }),

  actions: {
    async fetchParameters() {
      this.loading = true
      try {
        // Fetch forecast which includes current parameters
        const response = await apiClient.get('/forecast', { params: { weeks: 1 } })
        this.parameters = response.data.parameters || {}
      } catch (error) {
        this.error = error.message
        console.error('Error fetching parameters:', error)
      } finally {
        this.loading = false
      }
    },

    async saveParameters(params) {
      try {
        // Save each parameter individually via API
        const savePromises = Object.entries(params).map(([name, value]) => {
          return apiClient.put(`/settings/${name}`, { value })
        })
        
        await Promise.all(savePromises)
        
        // Refresh parameters after save
        await this.fetchParameters()
      } catch (error) {
        this.error = error.message
        console.error('Error saving parameters:', error)
        throw error
      }
    },
  },
})
