import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// Get all flocks
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { coop_id, status } = req.query

    let query = `
      SELECT f.*, c.name as coop_name
      FROM flocks f
      LEFT JOIN coops c ON f.coop_id = c.id
    `
    const params = []
    const conditions = []

    if (coop_id) {
      conditions.push('f.coop_id = ?')
      params.push(coop_id)
    }
    if (status) {
      conditions.push('f.status = ?')
      params.push(status)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY f.created_at DESC'
    const flocks = db.prepare(query).all(...params)
    
    // Calculate age in weeks for each flock
    const today = new Date()
    const flocksWithAge = flocks.map(flock => ({
      ...flock,
      age_weeks: Math.floor((today - new Date(flock.birth_date)) / (7 * 24 * 60 * 60 * 1000))
    }))
    
    res.json(flocksWithAge)
  } catch (error) {
    console.error('Error fetching flocks:', error)
    res.status(500).json({ error: 'Failed to fetch flocks' })
  }
})

// Get single flock
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const flock = db.prepare(`
      SELECT f.*, c.name as coop_name
      FROM flocks f
      LEFT JOIN coops c ON f.coop_id = c.id
      WHERE f.id = ?
    `).get(req.params.id)
    
    if (!flock) {
      return res.status(404).json({ error: 'Flock not found' })
    }
    
    const today = new Date()
    const ageWeeks = Math.floor((today - new Date(flock.birth_date)) / (7 * 24 * 60 * 60 * 1000))
    
    res.json({ ...flock, age_weeks: ageWeeks })
  } catch (error) {
    console.error('Error fetching flock:', error)
    res.status(500).json({ error: 'Failed to fetch flock' })
  }
})

// Add flock
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { name, breed, count, birth_date, coop_id, target_count, notes } = req.body

    if (!name || !breed || !birth_date) {
      return res.status(400).json({ error: 'Name, breed, and birth_date are required' })
    }

    const result = db.prepare(
      'INSERT INTO flocks (name, breed, count, birth_date, coop_id, target_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, breed, count || 0, birth_date, coop_id || null, target_count || 0, notes || '')

    const flock = db.prepare(`
      SELECT f.*, c.name as coop_name
      FROM flocks f
      LEFT JOIN coops c ON f.coop_id = c.id
      WHERE f.id = ?
    `).get(result.lastInsertRowid)
    
    res.status(201).json(flock)
  } catch (error) {
    console.error('Error creating flock:', error)
    res.status(500).json({ error: 'Failed to create flock' })
  }
})

// Update flock
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { name, breed, count, status, coop_id, target_count, notes } = req.body
    const id = req.params.id

    const existing = db.prepare('SELECT * FROM flocks WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Flock not found' })
    }

    db.prepare(`
      UPDATE flocks
      SET name = COALESCE(?, name),
          breed = COALESCE(?, breed),
          count = COALESCE(?, count),
          status = COALESCE(?, status),
          coop_id = ?,
          target_count = COALESCE(?, target_count),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, breed, count, status, coop_id ?? existing.coop_id, target_count, notes, id)

    const flock = db.prepare(`
      SELECT f.*, c.name as coop_name
      FROM flocks f
      LEFT JOIN coops c ON f.coop_id = c.id
      WHERE f.id = ?
    `).get(id)
    
    res.json(flock)
  } catch (error) {
    console.error('Error updating flock:', error)
    res.status(500).json({ error: 'Failed to update flock' })
  }
})

// Delete flock
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const result = db.prepare('DELETE FROM flocks WHERE id = ?').run(req.params.id)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Flock not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting flock:', error)
    res.status(500).json({ error: 'Failed to delete flock' })
  }
})

// Get flock production curve data
router.get('/:id/production-curve', (req, res) => {
  try {
    const db = getDb()
    const flock = db.prepare('SELECT * FROM flocks WHERE id = ?').get(req.params.id)
    
    if (!flock) {
      return res.status(404).json({ error: 'Flock not found' })
    }
    
    // Get forecasting parameters
    const params = db.prepare('SELECT param_name, param_value FROM forecasting_params').all()
    const paramMap = {}
    params.forEach(p => { paramMap[p.param_name] = p.param_value })
    
    const today = new Date()
    const ageWeeks = Math.floor((today - new Date(flock.birth_date)) / (7 * 24 * 60 * 60 * 1000))
    
    // Generate 80-week production curve
    const curve = []
    for (let w = 0; w <= 80; w++) {
      const weekAge = ageWeeks + w
      let weeklyRate = 0
      
      if (weekAge < 20) {
        weeklyRate = 0
      } else if (weekAge < 32) {
        // Ramp-up phase
        weeklyRate = 3.5 + ((weekAge - 20) / 12) * 2.0
      } else if (weekAge < 60) {
        // Peak and gradual decline
        weeklyRate = 5.5 - ((weekAge - 32) * paramMap.production_decline_rate)
      } else {
        // Steeper decline
        weeklyRate = Math.max(0, 4.0 - ((weekAge - 60) * 0.05))
      }
      
      // Apply feed quality factor
      weeklyRate *= paramMap.feed_quality_factor
      
      const weekEggs = flock.count * weeklyRate
      
      curve.push({
        week: w,
        age_weeks: weekAge,
        predicted_eggs_per_hen: Math.round(weeklyRate * 100) / 100,
        predicted_total_eggs: Math.round(weekEggs)
      })
    }
    
    res.json({
      flock_id: flock.id,
      current_age_weeks: ageWeeks,
      breed: flock.breed,
      count: flock.count,
      curve
    })
  } catch (error) {
    console.error('Error generating production curve:', error)
    res.status(500).json({ error: 'Failed to generate production curve' })
  }
})

export default router
