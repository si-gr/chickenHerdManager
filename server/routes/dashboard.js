import { Router } from 'express'
import { getDb } from '../db.js'
import { optionalAuthMiddleware } from './auth.js'

const router = Router()

// Apply optional auth to all routes
router.use(optionalAuthMiddleware)

// Get dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const db = getDb()
    
    if (!req.user) {
      return res.json({
        total_flocks: 0,
        active_flocks: 0,
        total_hens: 0,
        avg_flock_age_weeks: 0,
        production_rate: 0,
        total_chickens: 0,
        active_chickens: 0,
        total_eggs_today: 0,
        total_eggs_week: 0,
        total_eggs_month: 0,
        avg_eggs_per_hen: 0,
        eggs_by_breed: [],
        eggs_trend: [],
        coop_stats: [],
      })
    }
    
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const userId = req.user.userId

    // Flock statistics (new model)
    const totalFlocks = db.prepare('SELECT COUNT(*) as count FROM flocks WHERE user_id = ?').get(userId).count
    const activeFlocks = db.prepare("SELECT COUNT(*) as count FROM flocks WHERE user_id = ? AND status = 'active'").get(userId).count
    const totalHensObj = db.prepare('SELECT COALESCE(SUM(count), 0) as total FROM flocks WHERE user_id = ? AND status = ?').get(userId, 'active')
    const totalHens = totalHensObj ? totalHensObj.total : 0
    
    // Get average age of active flocks
    const avgAgeResult = db.prepare(`
      SELECT AVG(julianday('now') - julianday(birth_date)) / 7 as avg_age
      FROM flocks WHERE user_id = ? AND status = 'active'
    `).get(userId)
    const avgFlockAge = avgAgeResult ? Math.round(avgAgeResult.avg_age) : 0

    // Traditional chicken statistics (backward compat)
    const totalChickens = db.prepare('SELECT COUNT(*) as count FROM chickens WHERE user_id = ?').get(userId).count
    const activeChickens = db.prepare("SELECT COUNT(*) as count FROM chickens WHERE user_id = ? AND status = 'active'").get(userId).count

    // Eggs today
    const eggsToday = db.prepare(
      'SELECT COALESCE(SUM(egg_count), 0) as total FROM egg_production WHERE user_id = ? AND date = ?'
    ).get(userId, today).total

    // Eggs this week
    const eggsWeek = db.prepare(
      'SELECT COALESCE(SUM(egg_count), 0) as total FROM egg_production WHERE user_id = ? AND date >= ?'
    ).get(userId, weekAgo).total

    // Eggs this month
    const eggsMonth = db.prepare(
      'SELECT COALESCE(SUM(egg_count), 0) as total FROM egg_production WHERE user_id = ? AND date >= ?'
    ).get(userId, monthAgo).total

    // Average eggs per hen (last 7 days)
    const avgEggsPerHen = totalHens > 0
      ? Math.round((eggsWeek / 7 / totalHens) * 100) / 100
      : 0

    // Production rate (today's eggs / total hens)
    const productionRate = totalHens > 0
      ? Math.round((eggsToday / totalHens) * 100)
      : 0

    // Eggs by breed (from flocks)
    const eggsByBreed = db.prepare(`
      SELECT f.breed, COALESCE(SUM(ep.egg_count), 0) as count
      FROM flocks f
      LEFT JOIN egg_production ep ON ep.flock_id = f.id
      WHERE f.user_id = ? AND ep.date >= ?
      GROUP BY f.breed
      ORDER BY count DESC
    `).all(userId, weekAgo)

    // Eggs trend (last 30 days)
    const eggsTrend = db.prepare(`
      SELECT date, SUM(egg_count) as count
      FROM egg_production
      WHERE user_id = ? AND date >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(userId, monthAgo)

    // Coop utilization
    const coopStats = db.prepare(`
      SELECT c.name, c.capacity, COALESCE(SUM(f.count), 0) as current_hens
      FROM coops c
      LEFT JOIN flocks f ON f.coop_id = c.id AND f.status = 'active' AND f.user_id = ?
      WHERE c.user_id = ?
      GROUP BY c.id
    `).all(userId, userId)

    res.json({
      // Flock-based stats (primary)
      total_flocks: totalFlocks,
      active_flocks: activeFlocks,
      total_hens: totalHens,
      avg_flock_age_weeks: avgFlockAge,
      production_rate: productionRate,
      
      // Legacy chicken stats (backward compat)
      total_chickens: totalChickens,
      active_chickens: activeChickens,
      
      // Egg production
      total_eggs_today: eggsToday,
      total_eggs_week: eggsWeek,
      total_eggs_month: eggsMonth,
      avg_eggs_per_hen: avgEggsPerHen,
      eggs_by_breed: eggsByBreed,
      eggs_trend: eggsTrend,
      coop_stats: coopStats,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard stats' })
  }
})

export default router
