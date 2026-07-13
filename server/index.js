import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

import coopsRouter from './routes/coops.js'
import flocksRouter from './routes/flocks.js'
import breedsRouter from './routes/breeds.js'
import settingsRouter from './routes/settings.js'
import eggProductionRouter from './routes/eggProduction.js'
import dashboardRouter from './routes/dashboard.js'
import forecastRouter from './routes/forecast.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// API Routes
app.use('/api/coops', coopsRouter)
app.use('/api/flocks', flocksRouter)
app.use('/api/breeds', breedsRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/egg-production', eggProductionRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/forecast', forecastRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`🐔 Chicken Herd Manager API running on http://localhost:${PORT}`)
  console.log(`📊 Backend API ready for nginx proxy`)
})
