# Chicken Herd Manager

A redesigned version of the egg project - a comprehensive chicken herd management tool with egg production forecasting.

## Features

- **Chicken Herd Management**: Add, edit, remove chickens with breed, age, status, and coop assignment tracking
- **Egg Production Tracking**: Daily egg count recording per chicken with date range filtering and statistics
- **Egg Production Forecasting**: Linear regression-based predictions with 95% confidence intervals
- **Dashboard**: Summary statistics, production trend charts, and breed distribution visualization
- **No Authentication**: Simple, direct access without login requirements

## Tech Stack

### Frontend
- Vue.js 3
- Vite
- Vuetify 3 (UI components)
- Pinia (state management)
- Chart.js (visualizations)
- Axios (API client)

### Backend
- Node.js/Express
- SQLite (with WAL mode for concurrency)
- REST API

## Project Structure

```
chicken-herd-manager/
├── server/
│   ├── index.js          # Express API server (port 3001)
│   ├── db.js             # SQLite database setup & seed data
│   └── routes/           # API route handlers
│       ├── chickens.js
│       ├── coops.js
│       ├── egg-production.js
│       └── forecast.js
├── src/
│   ├── pages/
│   │   ├── index.vue           # Dashboard
│   │   ├── chickens.vue        # Chicken management
│   │   ├── egg-production.vue  # Egg tracking
│   │   └── forecast.vue        # Production forecasting
│   ├── stores/
│   │   ├── chickens.js         # Pinia store
│   │   └── eggProduction.js    # Pinia store
│   ├── services/
│   │   └── axios.js            # API client with proxy config
│   ├── router/
│   │   └── index.js
│   ├── plugins/
│   │   └── vuetify.js
│   ├── main.ts
│   └── App.vue
├── package.json
├── vite.config.mjs
└── README.md
```

## Running the Application

### Development Mode

#### Start Both Services

```bash
cd /home/qwer/Documents/chicken-herd-manager
npm run dev:all
```

#### Start Backend Only

```bash
cd /home/qwer/Documents/chicken-herd-manager
node server/index.js
```

Backend runs on: http://localhost:3001

#### Start Frontend Only

```bash
cd /home/qwer/Documents/chicken-herd-manager
npx vite --port 3002
```

Frontend runs on: http://localhost:3002

### Docker Deployment

#### Build and Run with Docker Compose

```bash
cd /home/qwer/Documents/chicken-herd-manager
docker-compose up -d --build
```

Application available at: http://localhost:3001

#### Build Docker Image Manually

```bash
docker build -t chicken-herd-manager .
docker run -d -p 3001:3001 -v $(pwd)/data:/app/server/data --name chm chicken-herd-manager
```

#### View Logs

```bash
docker-compose logs -f
# or
docker logs -f chicken-herd-manager
```

#### Stop Services

```bash
docker-compose down
# or
docker stop chicken-herd-manager && docker rm chicken-herd-manager
```

## API Endpoints

### Chickens
- `GET /api/chickens` - List all chickens
- `GET /api/chickens/:id` - Get single chicken
- `POST /api/chickens` - Create new chicken
- `PUT /api/chickens/:id` - Update chicken
- `DELETE /api/chickens/:id` - Delete chicken

### Coops
- `GET /api/coops` - List all coops
- `GET /api/coops/:id` - Get single coop
- `POST /api/coops` - Create new coop
- `PUT /api/coops/:id` - Update coop
- `DELETE /api/coops/:id` - Delete coop

### Egg Production
- `GET /api/egg-production?start_date=&end_date=` - Get egg records with date filter
- `POST /api/egg-production` - Create new egg record
- `PUT /api/egg-production/:id` - Update egg record
- `DELETE /api/egg-production/:id` - Delete egg record

### Dashboard & Forecasting
- `GET /api/dashboard` - Get summary statistics
- `GET /api/forecast?days=30` - Get production forecast (default 30 days)

## Database

SQLite database is stored at `server/chicken_herd.db` with WAL mode enabled.

Seed data is automatically generated on first run:
- 25 hens across 5 breeds (Leghorn, Rhode Island Red, Plymouth Rock, Australorp, Orpington)
- 3 coops (Main Coop, Barn Coop, Garden Coop)
- 90 days of historical egg production data

## Forecasting Algorithm

Uses simple linear regression on historical daily egg production data to predict future trends. Returns:
- Weekly predictions for the requested period
- 95% confidence intervals (lower/upper bounds)
- Historical comparison data
- Summary statistics (total, average, peak week, trend direction)
