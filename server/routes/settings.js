import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// Get all forecasting parameters
router.get('/parameters', (req, res) => {
  try {
    const db = getDb()
    const params = db.prepare('SELECT param_name, param_value, description FROM forecasting_params').all()
    
    const paramMap = {}
    params.forEach(p => {
      paramMap[p.param_name] = {
        value: p.param_value,
        description: p.description
      }
    })
    
    res.json(paramMap)
  } catch (error) {
    console.error('Error fetching parameters:', error)
    res.status(500).json({ error: 'Failed to fetch parameters' })
  }
})

// Update a single parameter
router.put('/:name', (req, res) => {
  try {
    const db = getDb()
    const { name } = req.params
    const { value } = req.body
    
    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value is required' })
    }
    
    // Validate parameter exists
    const existing = db.prepare('SELECT * FROM forecasting_params WHERE param_name = ?').get(name)
    if (!existing) {
      return res.status(404).json({ error: 'Parameter not found' })
    }
    
    // Validate value ranges
    const validRanges = {
      feed_quality_factor: { min: 0.5, max: 1.5 },
      peak_production_age: { min: 20, max: 50 },
      peak_production_rate: { min: 3, max: 8 },
      production_decline_rate: { min: 0.005, max: 0.1 },
      molting_start_age: { min: 50, max: 80 },
      molting_duration: { min: 4, max: 12 },
      replacement_threshold: { min: 60, max: 100 },
      target_flock_size: { min: 10, max: 500 },
      // UI preferences (boolean as 0/1)
      ui_show_tooltip_details: { min: 0, max: 1 },
      ui_show_base_rate_formula: { min: 0, max: 1 },
      ui_show_flock_breakdown: { min: 0, max: 1 },
      ui_show_confidence_details: { min: 0, max: 1 },
      ui_show_production_phase: { min: 0, max: 1 },
      // Mortality rate
      weekly_mortality_rate: { min: 0, max: 0.1 }
    }
    
    const range = validRanges[name]
    if (range && (value < range.min || value > range.max)) {
      return res.status(400).json({ 
        error: `Value must be between ${range.min} and ${range.max}`,
        valid_range: range
      })
    }
    
    db.prepare(`
      UPDATE forecasting_params
      SET param_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE param_name = ?
    `).run(value, name)
    
    const updated = db.prepare('SELECT param_name, param_value, description FROM forecasting_params WHERE param_name = ?').get(name)
    res.json({ [name]: { value: updated.param_value, description: updated.description } })
  } catch (error) {
    console.error('Error updating parameter:', error)
    res.status(500).json({ error: 'Failed to update parameter' })
  }
})

export default router
