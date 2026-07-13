import { defineStore } from 'pinia'
import apiClient from '@/services/axios'

export const useEggProductionStore = defineStore('eggProduction', {
  state: () => ({
    records: [],
    dailySummary: [],
    dashboardStats: null,
    forecast: null,
    loading: false,
    error: null,
  }),

  getters: {
    eggsToday: (state) => {
      const today = new Date().toISOString().split('T')[0]
      const todayRecords = state.records.filter(r => r.date === today)
      return todayRecords.reduce((sum, r) => sum + r.egg_count, 0)
    },
    eggsThisWeek: (state) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      return state.records
        .filter(r => r.date >= weekAgo)
        .reduce((sum, r) => sum + r.egg_count, 0)
    },
  },

  actions: {
    async fetchRecords(params = {}) {
      this.loading = true
      try {
        const response = await apiClient.get('/egg-production', { params })
        this.records = response.data
      } catch (error) {
        this.error = error.message
        console.error('Error fetching egg production:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchDailySummary(params = {}) {
      try {
        const response = await apiClient.get('/egg-production/daily', { params })
        this.dailySummary = response.data
      } catch (error) {
        console.error('Error fetching daily summary:', error)
      }
    },

    async addRecord(record) {
      try {
        const response = await apiClient.post('/egg-production', record)
        this.records.unshift(response.data)
        return response.data
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async updateRecord(id, record) {
      try {
        const response = await apiClient.put(`/egg-production/${id}`, record)
        const index = this.records.findIndex(r => r.id === id)
        if (index !== -1) {
          this.records[index] = response.data
        }
        return response.data
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async deleteRecord(id) {
      try {
        await apiClient.delete(`/egg-production/${id}`)
        this.records = this.records.filter(r => r.id !== id)
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    async fetchDashboardStats() {
      try {
        const response = await apiClient.get('/dashboard/stats')
        this.dashboardStats = response.data
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      }
    },

    async fetchForecast(params = {}) {
      try {
        const response = await apiClient.get('/forecast', { params })
        this.forecast = response.data
      } catch (error) {
        console.error('Error fetching forecast:', error)
      }
    },
  },
})
