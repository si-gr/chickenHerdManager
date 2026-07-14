import express from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'
import { authMiddleware, adminMiddleware } from './auth.js'

const router = express.Router()

// All admin routes require authentication and admin role
router.use(authMiddleware)
router.use(adminMiddleware)

// Get all users
router.get('/users', (req, res) => {
  try {
    const db = getDb()
    const users = db.prepare(`
      SELECT id, username, role, is_active, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `).all()
    
    res.json({ success: true, users })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// Get single user by ID
router.get('/users/:id', (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare(`
      SELECT id, username, role, is_active, created_at, updated_at 
      FROM users 
      WHERE id = ?
    `).get(req.params.id)
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    res.json({ success: true, user })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// Create new user
router.post('/users', (req, res) => {
  try {
    const { username, password, role, isActive } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "user"' })
    }
    
    const db = getDb()
    
    // Check if username already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' })
    }
    
    const passwordHash = bcrypt.hashSync(password, 10)
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?)
    `).run(username, passwordHash, role, isActive !== false ? 1 : 0)
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      userId: result.lastInsertRowid
    })
  } catch (error) {
    console.error('Create user error:', error)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

// Update user
router.put('/users/:id', (req, res) => {
  try {
    const { id } = req.params
    const { password, role, isActive } = req.body
    
    const db = getDb()
    
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Prevent self-deactivation
    if (isActive === false && parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' })
    }
    
    let updateFields = []
    let values = []
    
    if (role && ['admin', 'user'].includes(role)) {
      updateFields.push('role = ?')
      values.push(role)
    }
    
    if (isActive !== undefined) {
      updateFields.push('is_active = ?')
      values.push(isActive ? 1 : 0)
    }
    
    if (password) {
      updateFields.push('password_hash = ?')
      values.push(bcrypt.hashSync(password, 10))
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP')
      values.push(id)
      
      db.prepare(`
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).run(...values)
    }
    
    res.json({ success: true, message: 'User updated successfully' })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// Delete user
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params
    
    // Prevent self-deletion
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    
    const db = getDb()
    
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    
    res.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

export default router
