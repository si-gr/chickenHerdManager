import { Router } from 'express'
import { getDb } from '../db.js'
import { optionalAuthMiddleware } from './auth.js'

const router = Router()

// Apply optional auth to all routes
router.use(optionalAuthMiddleware)

// Generate forecast with 80-week horizon and flock-based model
router.get('/', (req, res) => {
  try {
    const db = getDb()
    
    if (!req.user) {
      return res.json({
        history: [],
        forecast: [],
        total_predicted: 0,
        peak_week: 0,
        peak_eggs: 0,
        replacement_weeks: [],
        flocks_included: [],
        assumptions: {}
      })
    }
    
    const { weeks = 80, coop_id, flock_id } = req.query
    const numWeeks = Math.min(parseInt(weeks) || 80, 160) // Cap at 160 weeks
    const userId = req.user.userId

    // Get forecasting parameters
    const params = db.prepare('SELECT param_name, param_value FROM forecasting_params').all()
    const paramMap = {}
    params.forEach(p => { paramMap[p.param_name] = p.param_value })

    // Get historical data (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let historyQuery = `
      SELECT date, SUM(egg_count) as total_eggs
      FROM egg_production
      WHERE date >= ? AND user_id = ?
    `
    const params_arr = [ninetyDaysAgo, userId]

    if (coop_id) {
      historyQuery += ' AND coop_id = ?'
      params_arr.push(coop_id)
    }
    if (flock_id) {
      historyQuery += ' AND flock_id = ?'
      params_arr.push(flock_id)
    }

    historyQuery += ' GROUP BY date ORDER BY date ASC'
    const history = db.prepare(historyQuery).all(...params_arr)

    // Get all active flocks for forecasting
    let flocksQuery = 'SELECT * FROM flocks WHERE status = ? AND user_id = ?'
    const flockParams = ['active', userId]
    
    if (coop_id) {
      flocksQuery += ' AND coop_id = ?'
      flockParams.push(coop_id)
    }
    if (flock_id) {
      flocksQuery += ' AND id = ?'
      flockParams.push(flock_id)
    }
    
    const flocks = db.prepare(flocksQuery).all(...flockParams)

    // Get breed-specific production curves
    const breeds = db.prepare('SELECT * FROM breeds WHERE is_active = 1 AND (user_id = ? OR user_id IS NULL)').all(userId)
    const breedCurves = {}
    breeds.forEach(b => {
      breedCurves[b.name] = {
        production_curve_type: b.production_curve_type || 'standard',
        custom_ramp_start_age: b.custom_ramp_start_age || 20,
        custom_ramp_end_age: b.custom_ramp_end_age || 32,
        custom_peak_rate: b.custom_peak_rate || b.peak_production_rate,
        custom_decline_start_age: b.custom_decline_start_age || 60,
        custom_decline_rate: b.custom_decline_rate || b.decline_rate,
        custom_molt_start_age: b.custom_molt_start_age || paramMap.molting_start_age,
        custom_molt_duration: b.custom_molt_duration || paramMap.molting_duration,
        custom_molt_rate: b.custom_molt_rate || 2.0,
        custom_post_molt_rate: b.custom_post_molt_rate || 3.5,
        custom_post_molt_decline: b.custom_post_molt_decline || 0.08,
      }
    })

    // Calculate current age for each flock
    const today = new Date()
    const flocksWithAge = flocks.map(flock => ({
      ...flock,
      current_age_weeks: Math.floor((today - new Date(flock.birth_date)) / (7 * 24 * 60 * 60 * 1000))
    }))

    // Generate 80-week forecast based on flock production curves
    const forecast = []
    let totalPredicted = 0
    let peakWeek = 0
    let peakEggs = 0
    const replacementWeeks = []
    
    // Track hen depreciation per flock over time (accumulate fractional losses)
    const flockHenCounts = {} // Float values for accurate calculation
    const flockCumulativeLoss = {} // Track accumulated fractional losses
    flocksWithAge.forEach(f => {
      flockHenCounts[f.id] = f.count
      flockCumulativeLoss[f.id] = 0
    })

    for (let w = 1; w <= numWeeks; w++) {
      let weekTotal = 0
      const flockContributions = []
      let totalAge = 0
      let activeFlocks = 0
      let hasMolting = false
      let totalHensLost = 0
      
      // Mortality rate for this week (constant across all flocks)
      const mortalityRate = paramMap.weekly_mortality_rate || 0.005
      
      for (const flock of flocksWithAge) {
        const weekAge = flock.current_age_weeks + w
        
        // Calculate loss this week (float)
        const lossThisWeek = flockHenCounts[flock.id] * mortalityRate
        flockCumulativeLoss[flock.id] += lossThisWeek
        
        // When accumulated loss >= 1 hen, remove it
        const hensToRemove = Math.floor(flockCumulativeLoss[flock.id])
        if (hensToRemove > 0) {
          flockHenCounts[flock.id] -= hensToRemove
          flockCumulativeLoss[flock.id] -= hensToRemove
        }
        
        const survivingHens = Math.round(flockHenCounts[flock.id])
        const hensLost = hensToRemove
        totalHensLost += hensLost
        
        let weeklyRate = 0
        let rateBeforeFeedFactor = 0
        
        // Get breed-specific curve parameters (or use global defaults)
        const breedCurve = breedCurves[flock.breed] || {}
        const curveType = breedCurve.production_curve_type || 'standard'
        const rampStart = breedCurve.custom_ramp_start_age || 20
        const rampEnd = breedCurve.custom_ramp_end_age || 32
        const peakRate = breedCurve.custom_peak_rate || breedCurve.peak_production_rate || paramMap.peak_production_rate
        const declineStart = breedCurve.custom_decline_start_age || 60
        const declineRate = breedCurve.custom_decline_rate || breedCurve.decline_rate || paramMap.production_decline_rate
        const moltStart = breedCurve.custom_molt_start_age || paramMap.molting_start_age
        const moltDuration = breedCurve.custom_molt_duration || paramMap.molting_duration
        const moltRate = breedCurve.custom_molt_rate || 2.0
        const postMoltRate = breedCurve.custom_post_molt_rate || 3.5
        const postMoltDecline = breedCurve.custom_post_molt_decline || 0.08
        
        // Production curve model (breed-specific)
        if (weekAge < rampStart) {
          // Pre-laying phase
          weeklyRate = 0
          rateBeforeFeedFactor = 0
        } else if (weekAge < rampEnd) {
          // Ramp-up to peak (linear increase)
          rateBeforeFeedFactor = 3.5 + ((weekAge - rampStart) / (rampEnd - rampStart)) * (peakRate - 3.5)
          weeklyRate = rateBeforeFeedFactor
        } else if (weekAge < declineStart) {
          // Peak and gradual decline
          rateBeforeFeedFactor = peakRate - ((weekAge - rampEnd) * declineRate)
          weeklyRate = Math.max(0, rateBeforeFeedFactor)
        } else if (weekAge < moltStart) {
          // Continued decline before molting
          rateBeforeFeedFactor = Math.max(0, 4.0 - ((weekAge - declineStart) * 0.05))
          weeklyRate = rateBeforeFeedFactor
        } else if (weekAge < moltStart + moltDuration) {
          // Molting period - reduced production
          rateBeforeFeedFactor = moltRate
          weeklyRate = rateBeforeFeedFactor
          hasMolting = true
        } else {
          // Post-molt recovery and decline
          rateBeforeFeedFactor = Math.max(0, postMoltRate - ((weekAge - moltStart - moltDuration) * postMoltDecline))
          weeklyRate = rateBeforeFeedFactor
        }
        
        // Apply feed quality factor
        weeklyRate *= paramMap.feed_quality_factor
        
        // Check if flock should be replaced
        if (weekAge >= paramMap.replacement_threshold) {
          // Flock is retired, no more production
          weeklyRate = 0
          
          // Track replacement timing
          if (!replacementWeeks.includes(w)) {
            replacementWeeks.push(w)
          }
        }
        
        const flockEggs = survivingHens * weeklyRate
        weekTotal += flockEggs
        
        // Track contribution for tooltip
        if (survivingHens > 0) {
          flockContributions.push({
            flock_id: flock.id,
            flock_name: flock.name,
            breed: flock.breed,
            hens_start: flockHenCounts[flock.id] + hensLost,
            hens_end: survivingHens,
            hens_lost: hensLost,
            age_weeks: weekAge,
            base_rate: Math.round(rateBeforeFeedFactor * 100) / 100,
            rate_after_feed: Math.round(weeklyRate * 100) / 100,
            eggs: Math.round(flockEggs * 100) / 100
          })
          totalAge += weekAge
          activeFlocks++
        }
      }
      
      // Calculate total hens this week (after mortality)
      const totalHensThisWeek = Object.values(flockHenCounts).reduce((sum, h) => sum + h, 0)
      
      const forecastDate = new Date(today)
      forecastDate.setDate(forecastDate.getDate() + w * 7)
      
      // Calculate confidence interval (wider for longer-term predictions)
      const confidenceFactor = 0.1 + (w / numWeeks) * 0.15 // 10% to 25%
      const stdDev = weekTotal * confidenceFactor
      const lowerBound = Math.max(0, weekTotal - 1.96 * stdDev)
      const upperBound = weekTotal + 1.96 * stdDev

      forecast.push({
        week: w,
        date: forecastDate.toISOString().split('T')[0],
        predicted_eggs: Math.round(weekTotal * 100) / 100,
        lower_bound: Math.round(lowerBound * 100) / 100,
        upper_bound: Math.round(upperBound * 100) / 100,
        is_replacement_week: replacementWeeks.includes(w),
        // Detailed breakdown for tooltip
        flock_contributions: flockContributions,
        avg_flock_age: activeFlocks > 0 ? Math.round((totalAge / activeFlocks) * 10) / 10 : 0,
        confidence_factor: Math.round(confidenceFactor * 1000) / 1000,
        feed_quality_factor: paramMap.feed_quality_factor,
        is_molting_period: hasMolting,
        num_active_flocks: activeFlocks,
        // Hen depreciation tracking
        total_hens_start: Object.values(flockHenCounts).reduce((sum, h) => sum + h, 0) + totalHensLost,
        total_hens_end: totalHensThisWeek,
        hens_lost_this_week: totalHensLost,
        cumulative_hens_lost: flocksWithAge.reduce((sum, f) => sum + f.count, 0) - totalHensThisWeek,
        mortality_rate: mortalityRate
      })

      totalPredicted += weekTotal

      if (weekTotal > peakEggs) {
        peakEggs = weekTotal
        peakWeek = w
      }
    }

    const avgWeekly = totalPredicted / numWeeks
    
    // Determine trend
    let trend = 'stable'
    if (forecast.length >= 2) {
      const firstQuarter = forecast.slice(0, Math.floor(numWeeks / 4))
      const lastQuarter = forecast.slice(Math.floor(numWeeks * 0.75))
      const firstAvg = firstQuarter.reduce((sum, w) => sum + w.predicted_eggs, 0) / firstQuarter.length
      const lastAvg = lastQuarter.reduce((sum, w) => sum + w.predicted_eggs, 0) / lastQuarter.length
      
      if (lastAvg > firstAvg * 1.1) trend = 'increasing'
      else if (lastAvg < firstAvg * 0.9) trend = 'decreasing'
    }

    // Calculate replacement planning info
    const replacementPlanning = flocksWithAge
      .filter(f => f.current_age_weeks + numWeeks >= paramMap.replacement_threshold)
      .map(f => ({
        flock_id: f.id,
        flock_name: f.name,
        breed: f.breed,
        current_age_weeks: f.current_age_weeks,
        replacement_due_week: Math.ceil((paramMap.replacement_threshold - f.current_age_weeks)),
        replacement_due_date: new Date(today.getTime() + Math.ceil((paramMap.replacement_threshold - f.current_age_weeks)) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }))

    res.json({
      forecast,
      weekly_data: forecast, // Alias for easier frontend access
      summary: {
        total_predicted_eggs: Math.round(totalPredicted),
        avg_weekly_eggs: Math.round(avgWeekly * 100) / 100,
        peak_week: peakWeek,
        peak_eggs: Math.round(peakEggs),
        trend,
        total_flocks: flocksWithAge.length,
        total_hens: flocksWithAge.reduce((sum, f) => sum + f.count, 0)
      },
      replacement_planning: replacementPlanning,
      parameters: paramMap,
      ui_preferences: {
        show_tooltip_details: paramMap.ui_show_tooltip_details !== 0,
        show_base_rate_formula: paramMap.ui_show_base_rate_formula === 1,
        show_flock_breakdown: paramMap.ui_show_flock_breakdown !== 0,
        show_confidence_details: paramMap.ui_show_confidence_details !== 0,
        show_production_phase: paramMap.ui_show_production_phase !== 0
      },
      historical: history.slice(-30).map(d => ({
        date: d.date,
        eggs: d.total_eggs,
      })),
    })
  } catch (error) {
    console.error('Error generating forecast:', error)
    res.status(500).json({ error: 'Failed to generate forecast' })
  }
})

// Get breed-specific production curves
router.get('/breed-curves', (req, res) => {
  try {
    const db = getDb()
    
    // Breed-specific parameters (could be extended to store in DB)
    const breedCurves = {
      'Rhode Island Red': { peak: 5.5, decline: 0.02, description: 'Reliable layer, good temperament' },
      'Leghorn': { peak: 6.0, decline: 0.018, description: 'High production, lightweight' },
      'Plymouth Rock': { peak: 5.0, decline: 0.022, description: 'Dual-purpose, cold hardy' },
      'Australorp': { peak: 5.5, decline: 0.02, description: 'Record holder, calm nature' },
      'Orpington': { peak: 4.5, decline: 0.025, description: 'Large, broody, good winter layer' }
    }
    
    const curves = Object.entries(breedCurves).map(([breed, data]) => {
      const points = []
      for (let age = 0; age <= 100; age += 2) {
        let rate = 0
        if (age < 20) {
          rate = 0
        } else if (age < 32) {
          rate = 3.5 + ((age - 20) / 12) * (data.peak - 3.5)
        } else if (age < 60) {
          rate = data.peak - ((age - 32) * data.decline)
        } else {
          rate = Math.max(0, 4.0 - ((age - 60) * 0.05))
        }
        points.push({ age, rate: Math.round(rate * 100) / 100 })
      }
      
      return {
        breed,
        ...data,
        curve: points
      }
    })
    
    res.json({ breed_curves: curves })
  } catch (error) {
    console.error('Error fetching breed curves:', error)
    res.status(500).json({ error: 'Failed to fetch breed curves' })
  }
})

export default router
