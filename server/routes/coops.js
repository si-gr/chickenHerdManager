import { Router } from 'express'
import { getDb } from '../db.js'
import { optionalAuthMiddleware } from './auth.js'

const router = Router()

// Apply optional auth to all routes
router.use(optionalAuthMiddleware)

// Get all coops (filtered by user if authenticated, otherwise show public/shared)
router.get('/', (req, res) => {
  try {
    const db = getDb()
    
    let query
    if (req.user) {
      // Authenticated user - show only their coops
      query = `
        SELECT c.*,
          (SELECT COUNT(*) FROM chickens ch WHERE ch.coop_id = c.id AND ch.status = 'active') as chicken_count
        FROM coops c
        WHERE c.user_id = ?
        ORDER BY c.name ASC
      `
      var coops = db.prepare(query).all(req.user.userId)
    } else {
      // No auth - return empty or could show public coops
      coops = []
    }
    res.json(coops)
  } catch (error) {
    console.error('Error fetching coops:', error)
    res.status(500).json({ error: 'Failed to fetch coops' })
  }
})

// Get single coop
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const coop = db.prepare('SELECT * FROM coops WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId)
    if (!coop) {
      return res.status(404).json({ error: 'Coop not found' })
    }
    res.json(coop)
  } catch (error) {
    console.error('Error fetching coop:', error)
    res.status(500).json({ error: 'Failed to fetch coop' })
  }
})

// Add coop
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { name, capacity, postcode, notes } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }
    
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const result = db.prepare(
      'INSERT INTO coops (user_id, name, capacity, postcode, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.userId, name, capacity || 50, postcode || '', notes || '')

    const coop = db.prepare('SELECT * FROM coops WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(coop)
  } catch (error) {
    console.error('Error creating coop:', error)
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A coop with this name already exists' })
    }
    res.status(500).json({ error: 'Failed to create coop' })
  }
})

// Update coop
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { name, capacity, postcode, notes } = req.body
    const id = req.params.id
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Check ownership
    const existing = db.prepare('SELECT * FROM coops WHERE id = ? AND user_id = ?').get(id, req.user.userId)
    if (!existing) {
      return res.status(404).json({ error: 'Coop not found' })
    }

    db.prepare(`
      UPDATE coops
      SET name = COALESCE(?, name),
          capacity = COALESCE(?, capacity),
          postcode = COALESCE(?, postcode),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(name, capacity, postcode, notes, id, req.user.userId)

    const coop = db.prepare('SELECT * FROM coops WHERE id = ? AND user_id = ?').get(id, req.user.userId)
    res.json(coop)
  } catch (error) {
    console.error('Error updating coop:', error)
    res.status(500).json({ error: 'Failed to update coop' })
  }
})

// Delete coop
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const result = db.prepare('DELETE FROM coops WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Coop not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting coop:', error)
    res.status(500).json({ error: 'Failed to delete coop' })
  }
})

export default router
