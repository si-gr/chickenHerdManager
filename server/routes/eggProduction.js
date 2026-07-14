import { Router } from 'express'
import { getDb } from '../db.js'
import { optionalAuthMiddleware } from './auth.js'

const router = Router()

// Apply optional auth to all routes
router.use(optionalAuthMiddleware)

// Get egg production records
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date, coop_id, chicken_id, flock_id } = req.query

    if (!req.user) {
      return res.json([])
    }

    let query = `
      SELECT ep.*,
        c.name as chicken_name,
        c.breed as chicken_breed,
        f.name as flock_name,
        f.breed as flock_breed,
        co.name as coop_name
      FROM egg_production ep
      LEFT JOIN chickens c ON ep.chicken_id = c.id
      LEFT JOIN flocks f ON ep.flock_id = f.id
      LEFT JOIN coops co ON ep.coop_id = co.id
      WHERE ep.user_id = ?
    `
    const params = [req.user.userId]

    if (start_date) {
      query += ' AND ep.date >= ?'
      params.push(start_date)
    }
    if (end_date) {
      query += ' AND ep.date <= ?'
      params.push(end_date)
    }
    if (coop_id) {
      query += ' AND ep.coop_id = ?'
      params.push(coop_id)
    }
    if (chicken_id) {
      query += ' AND ep.chicken_id = ?'
      params.push(chicken_id)
    }
    if (flock_id) {
      query += ' AND ep.flock_id = ?'
      params.push(flock_id)
    }

    query += ' ORDER BY ep.date DESC, ep.id DESC'
    const records = db.prepare(query).all(...params)
    res.json(records)
  } catch (error) {
    console.error('Error fetching egg production:', error)
    res.status(500).json({ error: 'Failed to fetch egg production' })
  }
})

// Get daily egg summary
router.get('/daily', (req, res) => {
  try {
    const db = getDb()
    const { start_date, end_date } = req.query

    let query = `
      SELECT date,
        SUM(egg_count) as total_eggs,
        COUNT(DISTINCT chicken_id) as chickens_laying
      FROM egg_production
    `
    const params = []
    const conditions = []

    if (start_date) {
      conditions.push('date >= ?')
      params.push(start_date)
    }
    if (end_date) {
      conditions.push('date <= ?')
      params.push(end_date)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' GROUP BY date ORDER BY date ASC'
    const summary = db.prepare(query).all(...params)
    res.json(summary)
  } catch (error) {
    console.error('Error fetching daily summary:', error)
    res.status(500).json({ error: 'Failed to fetch daily summary' })
  }
})

// Record egg production
router.post('/', (req, res) => {
  try {
    const db = getDb()
    const { chicken_id, flock_id, coop_id, date, egg_count, notes } = req.body

    if (!date || egg_count === undefined) {
      return res.status(400).json({ error: 'Date and egg_count are required' })
    }
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Auto-set coop_id from flock if not provided
    let finalCoopId = coop_id
    if (!finalCoopId && flock_id) {
      const flock = db.prepare('SELECT coop_id FROM flocks WHERE id = ? AND user_id = ?').get(flock_id, req.user.userId)
      if (flock) finalCoopId = flock.coop_id
    }

    const result = db.prepare(
      'INSERT INTO egg_production (user_id, chicken_id, flock_id, coop_id, date, egg_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.userId, chicken_id || null, flock_id || null, finalCoopId || null, date, egg_count, notes || '')

    const record = db.prepare('SELECT * FROM egg_production WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(record)
  } catch (error) {
    console.error('Error creating egg production record:', error)
    res.status(500).json({ error: 'Failed to create egg production record' })
  }
})

// Update egg production record
router.put('/:id', (req, res) => {
  try {
    const db = getDb()
    const { chicken_id, coop_id, date, egg_count, notes } = req.body
    const id = req.params.id
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const existing = db.prepare('SELECT * FROM egg_production WHERE id = ? AND user_id = ?').get(id, req.user.userId)
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' })
    }

    db.prepare(`
      UPDATE egg_production
      SET chicken_id = ?,
          coop_id = ?,
          date = COALESCE(?, date),
          egg_count = COALESCE(?, egg_count),
          notes = COALESCE(?, notes)
      WHERE id = ? AND user_id = ?
    `).run(
      chicken_id ?? existing.chicken_id,
      coop_id ?? existing.coop_id,
      date,
      egg_count,
      notes,
      id,
      req.user.userId
    )

    const record = db.prepare('SELECT * FROM egg_production WHERE id = ?').get(id)
    res.json(record)
  } catch (error) {
    console.error('Error updating egg production:', error)
    res.status(500).json({ error: 'Failed to update egg production' })
  }
})

// Delete egg production record
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    const result = db.prepare('DELETE FROM egg_production WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Record not found' })
    }
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting egg production:', error)
    res.status(500).json({ error: 'Failed to delete egg production' })
  }
})

export default router
