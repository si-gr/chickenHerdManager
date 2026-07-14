import { Router } from 'express'
import { getDb } from '../db.js'
import { optionalAuthMiddleware } from './auth.js'

const router = Router()

// Apply optional auth to all routes
router.use(optionalAuthMiddleware)

// Get all breeds
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { active_only } = req.query
    
    let query
    let params = []
    
    if (req.user) {
      // Authenticated - show user's breeds or shared system breeds
      query = 'SELECT * FROM breeds WHERE user_id = ? OR user_id IS NULL'
      params = [req.user.userId]
      
      if (active_only === 'true') {
        query += ' AND is_active = 1'
      }
    } else {
      // Not authenticated - show only system breeds (user_id IS NULL)
      query = 'SELECT * FROM breeds WHERE user_id IS NULL'
      
      if (active_only === 'true') {
        query += ' AND is_active = 1'
      }
    }
    
    query += ' ORDER BY name ASC'
    
    const breeds = db.prepare(query).all(...params)
    res.json(breeds)
  } catch (error) {
    console.error('Error fetching breeds:', error)
    res.status(500).json({ error: 'Failed to fetch breeds' })
  }
})

// Get single breed
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const breed = db.prepare('SELECT * FROM breeds WHERE id = ?').get(req.params.id)
    
    if (!breed) {
      return res.status(404).json({ error: 'Breed not found' })
    }
    
    res.json(breed)
  } catch (error) {
    console.error('Error fetching breed:', error)
    res.status(500).json({ error: 'Failed to fetch breed' })
  }
})

// Add breed
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const {
      name, description, peak_production_rate, peak_production_age, decline_rate,
      temperament, size, egg_color, is_active,
      production_curve_type, custom_ramp_start_age, custom_ramp_end_age, custom_peak_rate,
      custom_decline_start_age, custom_decline_rate, custom_molt_start_age, custom_molt_duration,
      custom_molt_rate, custom_post_molt_rate, custom_post_molt_decline
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check for duplicate including system breeds
    const existing = db.prepare('SELECT id FROM breeds WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(name, req.user.userId)
    if (existing) {
      return res.status(409).json({ error: 'Breed already exists (system or your own)' })
    }

    const result = db.prepare(`
      INSERT INTO breeds (
        user_id, name, description, peak_production_rate, peak_production_age, decline_rate,
        temperament, size, egg_color, is_active,
        production_curve_type, custom_ramp_start_age, custom_ramp_end_age, custom_peak_rate,
        custom_decline_start_age, custom_decline_rate, custom_molt_start_age, custom_molt_duration,
        custom_molt_rate, custom_post_molt_rate, custom_post_molt_decline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId,
      name,
      description || '',
      peak_production_rate || 5.0,
      peak_production_age || 32,
      decline_rate || 0.02,
      temperament || '',
      size || '',
      egg_color || '',
      is_active !== false ? 1 : 0,
      production_curve_type || 'standard',
      custom_ramp_start_age || 20,
      custom_ramp_end_age || 32,
      custom_peak_rate || 5.5,
      custom_decline_start_age || 60,
      custom_decline_rate || 0.02,
      custom_molt_start_age || 60,
      custom_molt_duration || 8,
      custom_molt_rate || 2.0,
      custom_post_molt_rate || 3.5,
      custom_post_molt_decline || 0.08
    )

    const breed = db.prepare('SELECT * FROM breeds WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(breed)
  } catch (error) {
    console.error('Error creating breed:', error)
    res.status(500).json({ error: 'Failed to create breed' })
  }
})

// Update breed
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = req.params.id
    const {
      name, description, peak_production_rate, peak_production_age, decline_rate,
      temperament, size, egg_color, is_active,
      production_curve_type, custom_ramp_start_age, custom_ramp_end_age, custom_peak_rate,
      custom_decline_start_age, custom_decline_rate, custom_molt_start_age, custom_molt_duration,
      custom_molt_rate, custom_post_molt_rate, custom_post_molt_decline
    } = req.body
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const existing = db.prepare('SELECT * FROM breeds WHERE id = ? AND user_id = ?').get(id, req.user.userId)
    if (!existing) {
      return res.status(404).json({ error: 'Breed not found' })
    }

    // Check for duplicate name (if name changed)
    if (name && name !== existing.name) {
      const duplicate = db.prepare('SELECT id FROM breeds WHERE name = ? AND user_id = ? AND id != ?').get(name, req.user.userId, id)
      if (duplicate) {
        return res.status(409).json({ error: 'Breed name already exists' })
      }
    }

    db.prepare(`
      UPDATE breeds SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        peak_production_rate = COALESCE(?, peak_production_rate),
        peak_production_age = COALESCE(?, peak_production_age),
        decline_rate = COALESCE(?, decline_rate),
        temperament = COALESCE(?, temperament),
        size = COALESCE(?, size),
        egg_color = COALESCE(?, egg_color),
        is_active = COALESCE(?, is_active),
        production_curve_type = COALESCE(?, production_curve_type),
        custom_ramp_start_age = COALESCE(?, custom_ramp_start_age),
        custom_ramp_end_age = COALESCE(?, custom_ramp_end_age),
        custom_peak_rate = COALESCE(?, custom_peak_rate),
        custom_decline_start_age = COALESCE(?, custom_decline_start_age),
        custom_decline_rate = COALESCE(?, custom_decline_rate),
        custom_molt_start_age = COALESCE(?, custom_molt_start_age),
        custom_molt_duration = COALESCE(?, custom_molt_duration),
        custom_molt_rate = COALESCE(?, custom_molt_rate),
        custom_post_molt_rate = COALESCE(?, custom_post_molt_rate),
        custom_post_molt_decline = COALESCE(?, custom_post_molt_decline),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      name,
      description,
      peak_production_rate,
      peak_production_age,
      decline_rate,
      temperament,
      size,
      egg_color,
      is_active !== undefined ? (is_active ? 1 : 0) : undefined,
      production_curve_type,
      custom_ramp_start_age,
      custom_ramp_end_age,
      custom_peak_rate,
      custom_decline_start_age,
      custom_decline_rate,
      custom_molt_start_age,
      custom_molt_duration,
      custom_molt_rate,
      custom_post_molt_rate,
      custom_post_molt_decline,
      id,
      req.user.userId
    )

    const breed = db.prepare('SELECT * FROM breeds WHERE id = ?').get(id)
    res.json(breed)
  } catch (error) {
    console.error('Error updating breed:', error)
    res.status(500).json({ error: 'Failed to update breed' })
  }
})

// Delete breed
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const id = req.params.id
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check ownership
    const existing = db.prepare('SELECT * FROM breeds WHERE id = ? AND user_id = ?').get(id, req.user.userId)
    if (!existing) {
      return res.status(404).json({ error: 'Breed not found' })
    }

    // Check if breed is in use by any flocks
    const flockCount = db.prepare('SELECT COUNT(*) as count FROM flocks WHERE breed = ?').get(existing.name)
    if (flockCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete breed - it is used by existing flocks',
        flock_count: flockCount.count
      })
    }

    const result = db.prepare('DELETE FROM breeds WHERE id = ? AND user_id = ?').run(id, req.user.userId)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Breed not found' })
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting breed:', error)
    res.status(500).json({ error: 'Failed to delete breed' })
  }
})

// Get breed statistics
router.get('/:id/stats', (req, res) => {
  try {
    const db = getDb()
    const breed = db.prepare('SELECT name FROM breeds WHERE id = ?').get(req.params.id)
    
    if (!breed) {
      return res.status(404).json({ error: 'Breed not found' })
    }

    // Count flocks using this breed
    const flockStats = db.prepare(`
      SELECT COUNT(*) as total_flocks, SUM(count) as total_hens
      FROM flocks WHERE breed = ?
    `).get(breed.name)

    // Get production curve data
    const params = db.prepare('SELECT param_name, param_value FROM forecasting_params').all()
    const paramMap = {}
    params.forEach(p => { paramMap[p.param_name] = p.param_value })

    const curve = []
    for (let age = 0; age <= 100; age += 2) {
      let rate = 0
      if (age < 20) {
        rate = 0
      } else if (age < breed.peak_production_age) {
        rate = 3.5 + ((age - 20) / (breed.peak_production_age - 20)) * (breed.peak_production_rate - 3.5)
      } else if (age < 60) {
        rate = breed.peak_production_rate - ((age - breed.peak_production_age) * breed.decline_rate)
      } else {
        rate = Math.max(0, 4.0 - ((age - 60) * 0.05))
      }
      curve.push({ age, rate: Math.round(rate * 100) / 100 })
    }

    res.json({
      breed_id: req.params.id,
      breed_name: breed.name,
      flock_stats: flockStats,
      production_curve: curve
    })
  } catch (error) {
    console.error('Error fetching breed stats:', error)
    res.status(500).json({ error: 'Failed to fetch breed stats' })
  }
})

export default router
