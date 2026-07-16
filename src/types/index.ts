export interface Chicken {
  id: number
  name: string
  breed: string
  date_of_birth: string
  status: 'active' | 'retired' | 'deceased'
  coop_id: number | null
  notes: string
  created_at: string
  updated_at: string
}

export interface Coop {
  id: number
  name: string
  capacity: number
  postcode: string
  notes: string
  created_at: string
  updated_at: string
}

export interface EggProduction {
  id: number
  chicken_id: number | null
  coop_id: number | null
  date: string
  egg_count: number
  notes: string
  created_at: string
}

export interface DashboardStats {
  total_chickens: number
  active_chickens: number
  total_eggs_today: number
  total_eggs_week: number
  total_eggs_month: number
  avg_eggs_per_chicken: number
  eggs_by_breed: Array<{ breed: string; count: number }>
  eggs_trend: Array<{ date: string; count: number }>
}

export interface ForecastItem {
  week: number
  date: string
  predicted_eggs: number
  lower_bound: number
  upper_bound: number
}

export interface ForecastSummary {
  total_predicted_eggs: number
  avg_weekly_eggs: number
  peak_week: number
  peak_eggs: number
  trend: 'increasing' | 'stable' | 'decreasing'
}
