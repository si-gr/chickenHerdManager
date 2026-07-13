# Chicken Herd Manager - Multi-stage Docker Build
# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy root package files (includes all deps for dev)
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy frontend source
COPY vite.config.mjs index.html ./
COPY src/ ./src/
COPY public/ ./public/

# Build frontend
RUN npm run build

# Stage 2: Backend Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Install runtime dependencies for SQLite
RUN apk add --no-cache sqlite-libs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy backend package files
COPY server/package.json server/package-lock.json ./
COPY server/ ./server/

# Install backend dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./public

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/chickens || exit 1

# Start the server
CMD ["node", "server/index.js"]
