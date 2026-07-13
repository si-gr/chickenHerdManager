import { defineStore } from 'pinia'
import apiClient from '@/services/axios'

export const useChickenStore = defineStore('coops', {
  state: () => ({
    coops: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchCoops() {
      try {
        const response = await apiClient.get('/coops')
        this.coops = response.data
      } catch (error) {
        console.error('Error fetching coops:', error)
      }
    },

  },
})
