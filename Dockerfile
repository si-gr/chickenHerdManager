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
FROM node:20-alpine AS backend

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

# Create data directory with proper ownership for non-root user
RUN mkdir -p /app/server/data && chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["node", "server/index.js"]

# Stage 3: Frontend with Nginx
FROM nginx:alpine AS frontend

WORKDIR /usr/share/nginx/html

RUN rm -rf /usr/share/nginx/html/*

# Create cache and run directories with proper permissions for non-root nginx user
RUN mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp /run && \
    chown -R nginx:nginx /var/cache/nginx /run

# Copy custom nginx config for Vue SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder stage
COPY --from=frontend-builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Expose port 80 for NPM proxy
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Run nginx in foreground (Docker requirement)
ENTRYPOINT ["nginx", "-c", "/etc/nginx/nginx.conf"]
CMD ["-g", "daemon off;"]
