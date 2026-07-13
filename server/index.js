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

// Serve static frontend files
// Check for production build (dist/) first, then development fallback
const distPath = join(__dirname, '../dist')
const publicPath = join(__dirname, '../public')
const rootIndexPath = join(__dirname, '../index.html')

let servedFrom = null

if (existsSync(distPath)) {
  // Production build exists
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
  servedFrom = 'dist (production build)'
} else if (existsSync(rootIndexPath)) {
  // Development mode - serve root index.html and proxy to Vite
  app.use(express.static(join(__dirname, '../')))
  app.get('*', (req, res) => {
    res.sendFile(rootIndexPath)
  })
  servedFrom = 'root (development mode)'
} else if (existsSync(publicPath)) {
  // Fallback to public folder
  app.use(express.static(publicPath))
  app.get('*', (req, res) => {
    const indexPath = join(publicPath, 'index.html')
    if (existsSync(indexPath)) {
      res.sendFile(indexPath)
    } else {
      res.status(404).json({ error: 'Frontend not found. Run "npm run build" first.' })
    }
  })
  servedFrom = 'public'
}

// Start server
app.listen(PORT, () => {
  console.log(`🐔 Chicken Herd Manager API running on http://localhost:${PORT}`)
  if (servedFrom) {
    console.log(`📊 Frontend served from: ${servedFrom}`)
    console.log(`📊 Frontend available at http://localhost:${PORT}`)
  } else {
    console.log(`⚠️  No frontend found. Run "npm run build" to create production build.`)
  }
})
