import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Support environment variable for Docker, fallback to local path
const DB_PATH = process.env.DB_PATH || join(__dirname, 'chicken_herd.db')

let db

export function getDb() {
  if (!db) {
    // Ensure directory exists (needed for Docker volume mounts)
    const dbDir = dirname(DB_PATH)
    mkdirSync(dbDir, { recursive: true })
    
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initializeDb()
  }
  return db
}

function initializeDb() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS coops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL UNIQUE,
      capacity INTEGER NOT NULL DEFAULT 50,
      postcode TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Breed management with production characteristics
    CREATE TABLE IF NOT EXISTS breeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      peak_production_rate REAL DEFAULT 5.5,
      peak_production_age INTEGER DEFAULT 32,
      decline_rate REAL DEFAULT 0.02,
      temperament TEXT DEFAULT '',
      size TEXT DEFAULT '',
      egg_color TEXT DEFAULT '',
      cold_hardy BOOLEAN DEFAULT 1,
      heat_hardy BOOLEAN DEFAULT 1,
      broodiness INTEGER DEFAULT 2,
      is_active BOOLEAN DEFAULT 1,
      -- Custom production curve parameters (breed-specific function)
      production_curve_type TEXT DEFAULT 'standard',
      custom_ramp_start_age INTEGER DEFAULT 20,
      custom_ramp_end_age INTEGER DEFAULT 32,
      custom_peak_rate REAL DEFAULT 5.5,
      custom_decline_start_age INTEGER DEFAULT 60,
      custom_decline_rate REAL DEFAULT 0.02,
      custom_molt_start_age INTEGER DEFAULT 60,
      custom_molt_duration INTEGER DEFAULT 8,
      custom_molt_rate REAL DEFAULT 2.0,
      custom_post_molt_rate REAL DEFAULT 3.5,
      custom_post_molt_decline REAL DEFAULT 0.08,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Flock/batch management for large-scale herds
    CREATE TABLE IF NOT EXISTS flocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      breed TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      birth_date TEXT NOT NULL,
      coop_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'molt', 'retired', 'dead')),
      target_count INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coop_id) REFERENCES coops(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Keep individual chickens table for backward compatibility
    CREATE TABLE IF NOT EXISTS chickens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      breed TEXT NOT NULL,
      date_of_birth TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'retired', 'deceased')),
      coop_id INTEGER,
      flock_id INTEGER,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coop_id) REFERENCES coops(id) ON DELETE SET NULL,
      FOREIGN KEY (flock_id) REFERENCES flocks(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS egg_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      chicken_id INTEGER,
      flock_id INTEGER,
      coop_id INTEGER,
      date TEXT NOT NULL,
      egg_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chicken_id) REFERENCES chickens(id) ON DELETE CASCADE,
      FOREIGN KEY (flock_id) REFERENCES flocks(id) ON DELETE CASCADE,
      FOREIGN KEY (coop_id) REFERENCES coops(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Forecasting parameters/settings
    CREATE TABLE IF NOT EXISTS forecasting_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      param_name TEXT NOT NULL UNIQUE,
      param_value REAL NOT NULL,
      description TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chickens_coop ON chickens(coop_id);
    CREATE INDEX IF NOT EXISTS idx_chickens_status ON chickens(status);
    CREATE INDEX IF NOT EXISTS idx_chickens_flock ON chickens(flock_id);
    CREATE INDEX IF NOT EXISTS idx_flocks_coop ON flocks(coop_id);
    CREATE INDEX IF NOT EXISTS idx_flocks_status ON flocks(status);
    CREATE INDEX IF NOT EXISTS idx_egg_production_date ON egg_production(date);
    CREATE INDEX IF NOT EXISTS idx_egg_production_chicken ON egg_production(chicken_id);
    CREATE INDEX IF NOT EXISTS idx_egg_production_flock ON egg_production(flock_id);
    CREATE INDEX IF NOT EXISTS idx_egg_production_coop ON egg_production(coop_id);
    
    -- User ownership indexes
    CREATE INDEX IF NOT EXISTS idx_coops_user ON coops(user_id);
    CREATE INDEX IF NOT EXISTS idx_breeds_user ON breeds(user_id);
    CREATE INDEX IF NOT EXISTS idx_flocks_user ON flocks(user_id);
    CREATE INDEX IF NOT EXISTS idx_chickens_user ON chickens(user_id);
    CREATE INDEX IF NOT EXISTS idx_egg_production_user ON egg_production(user_id);

    -- User management for admin access
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Seed default admin user FIRST (before any FK-referencing tables)
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()
  if (userCount.count === 0) {
    seedDefaultAdmin()
  }
  
  // Migrate existing data to admin user if columns don't exist
  migrateDataToUsers(db)

  // Seed forecasting parameters if empty
  const paramsCount = db.prepare('SELECT COUNT(*) as count FROM forecasting_params').get()
  if (paramsCount.count === 0) {
    seedForecastingParams()
  }

  // Seed UI/display preferences if empty
  const uiPrefCount = db.prepare("SELECT COUNT(*) as count FROM forecasting_params WHERE param_name LIKE 'ui_%'").get()
  if (uiPrefCount.count === 0) {
    seedUIPreferences()
  }

  // Seed breeds if empty
  const breedCount = db.prepare('SELECT COUNT(*) as count FROM breeds').get()
  if (breedCount.count === 0) {
    seedBreeds()
  }

  // Seed with sample data if empty
  const coopCount = db.prepare('SELECT COUNT(*) as count FROM coops').get()
  if (coopCount.count === 0) {
    seedData()
  }
}

function seedBreeds() {
  const insertBreed = db.prepare(`
    INSERT INTO breeds (
      name, description, peak_production_rate, peak_production_age, decline_rate,
      temperament, size, egg_color, cold_hardy, heat_hardy, broodiness, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  
  const breeds = [
    ['Rhode Island Red', 'Reliable layer, excellent for beginners, dual-purpose breed', 5.5, 32, 0.02, 'Friendly, hardy, active', 'Large', 'Brown', 1, 1, 2, 1],
    ['Leghorn', 'High production white egg layer, lightweight and active', 6.0, 30, 0.018, 'Active, flighty, good forager', 'Medium', 'White', 0, 1, 1, 1],
    ['Plymouth Rock', 'Dual-purpose, cold hardy, friendly family bird', 5.0, 32, 0.022, 'Calm, friendly, docile', 'Large', 'Brown', 1, 0, 3, 1],
    ['Australorp', 'Record holder for egg production, calm temperament', 5.5, 32, 0.02, 'Gentle, quiet, easy to handle', 'Large', 'Brown', 1, 1, 3, 1],
    ['Orpington', 'Large, broody, excellent winter layer', 4.5, 34, 0.025, 'Docile, friendly, broody', 'Very Large', 'Brown', 1, 0, 5, 1],
    ['Sussex', 'Dual-purpose, good forager, calm nature', 5.0, 32, 0.02, 'Calm, friendly, curious', 'Large', 'Cream/Tinted', 1, 0, 3, 1],
    ['Wyandotte', 'Beautiful laced feathers, cold hardy, dual-purpose', 5.0, 32, 0.02, 'Calm, confident, friendly', 'Large', 'Brown', 1, 0, 3, 1],
    ['Silkie', 'Ornamental, broody, unique fluffy feathers', 3.0, 36, 0.03, 'Gentle, tame, good with kids', 'Bantam', 'Cream', 0, 0, 5, 1],
    ['Cochin', 'Large ornamental, very broody, feathered feet', 4.0, 36, 0.028, 'Calm, friendly, lazy', 'Very Large', 'Brown', 1, 0, 5, 1],
    ['New Hampshire Red', 'Fast maturing, good layer, dual-purpose', 5.5, 30, 0.02, 'Friendly, active, hardy', 'Large', 'Brown', 1, 1, 2, 1],
    ['Barnevelder', 'Dark brown eggs, cold hardy, attractive', 4.5, 34, 0.022, 'Calm, friendly, quiet', 'Large', 'Dark Brown', 1, 0, 3, 1],
    ['Marans', 'Famous for chocolate-brown eggs', 4.5, 34, 0.022, 'Active, hardy, independent', 'Large', 'Dark Brown', 1, 0, 2, 1],
    ['Easter Egger', 'Colorful eggs (blue/green/pink), friendly', 5.0, 32, 0.02, 'Friendly, curious, hardy', 'Medium', 'Blue/Green', 1, 1, 2, 1],
    ['Minorca', 'Large white eggs, Mediterranean breed', 5.5, 30, 0.02, 'Active, alert, good forager', 'Large', 'White', 0, 1, 1, 1],
    ['Mixed', 'Unknown or mixed breed chickens', 5.0, 32, 0.022, 'Varies', 'Varies', 'Varies', 1, 1, 2, 1]
  ]
  
  breeds.forEach(b => insertBreed.run(...b))
  console.log('Breeds seeded:', breeds.length)
}

function seedUIPreferences() {
  const insertParam = db.prepare('INSERT INTO forecasting_params (param_name, param_value, description) VALUES (?, ?, ?)')
  
  // UI display preferences
  insertParam.run('ui_show_tooltip_details', 1, 'Show detailed tooltip information on forecast chart hover (0=off, 1=on)')
  insertParam.run('ui_show_base_rate_formula', 0, 'Show base rate calculation formula in tooltip (0=off, 1=on)')
  insertParam.run('ui_show_flock_breakdown', 1, 'Show per-flock contribution breakdown in tooltip (0=off, 1=on)')
  insertParam.run('ui_show_confidence_details', 1, 'Show confidence interval statistical details (0=off, 1=on)')
  insertParam.run('ui_show_production_phase', 1, 'Show production phase indicator (0=off, 1=on)')
  
  // Hen depreciation/mortality parameter
  insertParam.run('weekly_mortality_rate', 0.005, 'Weekly hen mortality/depreciation rate (0.005 = 0.5% per week, ~26% annual loss)')
  
  console.log('UI preferences seeded')
}

function seedForecastingParams() {
  const insertParam = db.prepare('INSERT INTO forecasting_params (param_name, param_value, description) VALUES (?, ?, ?)')
  
  // Feed quality factor (0.5-1.5, default 1.0)
  insertParam.run('feed_quality_factor', 1.0, 'Multiplier for egg production based on feed quality (0.5-1.5)')
  
  // Peak production age (weeks)
  insertParam.run('peak_production_age', 32, 'Age in weeks when egg production peaks')
  
  // Peak production rate (eggs per hen per week)
  insertParam.run('peak_production_rate', 5.5, 'Maximum eggs per hen per week at peak')
  
  // Production decline rate (per week after peak)
  insertParam.run('production_decline_rate', 0.02, 'Weekly decline rate after peak (fraction)')
  
  // Molting duration (weeks)
  insertParam.run('molting_duration', 8, 'Typical molting period duration in weeks')
  
  // Molting start age (weeks)
  insertParam.run('molting_start_age', 60, 'Typical age to induce molting')
  
  // Replacement threshold (weeks)
  insertParam.run('replacement_threshold', 80, 'Age to replace flock')
  
  // Target flock size
  insertParam.run('target_flock_size', 100, 'Default target number of hens per flock')
  
  console.log('Forecasting parameters seeded')
}

function seedData() {
  const insertCoop = db.prepare('INSERT INTO coops (name, capacity, postcode, notes) VALUES (?, ?, ?, ?)')
  const insertFlock = db.prepare('INSERT INTO flocks (name, breed, count, birth_date, coop_id, status, target_count, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insertChicken = db.prepare('INSERT INTO chickens (name, breed, date_of_birth, status, coop_id, flock_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const insertEgg = db.prepare('INSERT INTO egg_production (chicken_id, flock_id, coop_id, date, egg_count, notes) VALUES (?, ?, ?, ?, ?, ?)')

  // Create coops
  insertCoop.run('Main Coop', 100, '12345', 'Primary coop for large flocks')
  insertCoop.run('Barn Coop', 75, '67890', 'Secondary coop')
  insertCoop.run('Garden Coop', 50, '54321', 'Free-range coop')

  // Create flocks with different breeds and ages (large-scale model)
  const breeds = [
    { name: 'Rhode Island Red', peak: 5.5, decline: 0.02 },
    { name: 'Leghorn', peak: 6.0, decline: 0.018 },
    { name: 'Plymouth Rock', peak: 5.0, decline: 0.022 },
    { name: 'Australorp', peak: 5.5, decline: 0.02 },
    { name: 'Orpington', peak: 4.5, decline: 0.025 }
  ]
  const flockStatuses = ['active', 'active', 'active', 'molt', 'retired']

  for (let i = 1; i <= 10; i++) {
    const breed = breeds[i % breeds.length]
    const coopId = (i % 3) + 1
    const status = flockStatuses[i % flockStatuses.length]
    const ageWeeks = 20 + Math.floor(Math.random() * 60)
    const birthDate = new Date()
    birthDate.setDate(birthDate.getDate() - (ageWeeks * 7))
    const birthDateStr = birthDate.toISOString().split('T')[0]
    const count = 50 + Math.floor(Math.random() * 100) // 50-150 hens per flock

    insertFlock.run(
      `Flock ${i}`,
      breed.name,
      count,
      birthDateStr,
      coopId,
      status,
      100,
      `${breed.name} flock, ${count} hens, age ${ageWeeks} weeks`
    )
  }

  // Generate egg production data for last 90 days based on flock model
  const today = new Date()
  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - dayOffset)
    const dateStr = date.toISOString().split('T')[0]

    // Get all active flocks
    const flocks = db.prepare('SELECT * FROM flocks WHERE status = ?').all('active')
    
    for (const flock of flocks) {
      const ageWeeks = Math.floor((date - new Date(flock.birth_date)) / (7 * 24 * 60 * 60 * 1000))
      
      // Calculate daily production rate based on age curve
      let dailyRate = 0
      if (ageWeeks < 20) {
        // Pre-laying phase
        dailyRate = 0
      } else if (ageWeeks < 32) {
        // Ramp-up to peak
        dailyRate = 0.5 + ((ageWeeks - 20) / 12) * 0.4 // 0.5 to 0.9
      } else if (ageWeeks < 60) {
        // Peak and gradual decline
        dailyRate = 0.9 - ((ageWeeks - 32) * 0.005) // declines from 0.9
      } else {
        // Steeper decline after 60 weeks
        dailyRate = Math.max(0.3, 0.75 - ((ageWeeks - 60) * 0.01))
      }
      
      // Total eggs for this flock on this day
      const expectedEggs = Math.round(flock.count * dailyRate)
      
      if (expectedEggs > 0) {
        insertEgg.run(null, flock.id, flock.coop_id, dateStr, expectedEggs, `Flock ${flock.id} daily production`)
      }
    }
  }

  console.log('Database seeded with flock-based sample data')
}

function seedDefaultAdmin() {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, role, is_active)
    VALUES (?, ?, ?, ?)
  `)
  
  // Default admin: sigr / rentacar
  const passwordHash = bcrypt.hashSync('rentacar', 10)
  insertUser.run('sigr', passwordHash, 'admin', 1)
  console.log('Default admin user created (username: sigr)')
}

function migrateDataToUsers(db) {
  // Check if user_id columns exist and add them if not
  try {
    // For each table, check if user_id column exists
    const tables = ['coops', 'breeds', 'flocks', 'chickens', 'egg_production']
    
    for (const table of tables) {
      const columns = db.pragma(`table_info(${table})`)
      const hasUserId = columns.some(col => col.name === 'user_id')
      
      if (!hasUserId) {
        // Add user_id column with default value 1 (admin user)
        db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`)
        console.log(`Added user_id column to ${table}`)
      }
    }
    
    // Update all existing records to belong to admin user (id=1)
    for (const table of tables) {
      db.exec(`UPDATE ${table} SET user_id = 1 WHERE user_id IS NULL`)
    }
    
    // Check if postcode column exists in coops table and add it if not
    const coopColumns = db.pragma('table_info(coops)')
    const hasPostcode = coopColumns.some(col => col.name === 'postcode')
    
    if (!hasPostcode) {
      db.exec(`ALTER TABLE coops ADD COLUMN postcode TEXT DEFAULT ''`)
      console.log('Added postcode column to coops')
    }
    
    console.log('Data migration to users completed')
  } catch (error) {
    console.error('Migration error:', error.message)
  }
}

export default getDb
