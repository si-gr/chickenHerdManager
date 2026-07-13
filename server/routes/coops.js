import { Router } from 'express'
import { getDb } from '../db.js'

const router = Router()

// Get all coops
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const coops = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM chickens ch WHERE ch.coop_id = c.id AND ch.status = 'active') as chicken_count
      FROM coops c
      ORDER BY c.name ASC
    `).all()
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
    const coop = db.prepare('SELECT * FROM coops WHERE id = ?').get(req.params.id)
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
    const { name, capacity, notes } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const result = db.prepare(
      'INSERT INTO coops (name, capacity, notes) VALUES (?, ?, ?)'
    ).run(name, capacity || 50, notes || '')

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
    const { name, capacity, notes } = req.body
    const id = req.params.id

    const existing = db.prepare('SELECT * FROM coops WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Coop not found' })
    }

    db.prepare(`
      UPDATE coops
      SET name = COALESCE(?, name),
          capacity = COALESCE(?, capacity),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, capacity, notes, id)

    const coop = db.prepare('SELECT * FROM coops WHERE id = ?').get(id)
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
    const result = db.prepare('DELETE FROM coops WHERE id = ?').run(req.params.id)
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
