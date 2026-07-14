import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from '../db.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'chicken-herd-secret-key-change-in-production'

// Login endpoint
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username)
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const validPassword = bcrypt.compareSync(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    )
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Logout endpoint (client-side token removal, but we can invalidate if needed)
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' })
})

// Verify token middleware
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  const token = authHeader.split(' ')[1]
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Admin-only middleware
export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

// Optional auth middleware - doesn't fail if no token, but sets req.user if valid
export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.user = decoded
    } catch (error) {
      // Token invalid, continue without user
    }
  }
  next()
}

export default router
