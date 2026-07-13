#!/bin/bash
#
# Chicken Herd Manager - Auto Deploy Script
# Deploys to soarpreme.eu server via Docker Compose with nginx-proxy-manager
#
# Usage: ./deploy.sh [production|staging]
#

set -e

# Configuration
SERVER_HOST="${DEPLOY_HOST:-soarpreme.eu}"
SERVER_USER="${DEPLOY_USER:-root}"
SERVER_PORT="${DEPLOY_PORT:-22}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/chicken-herd-manager}"
IMAGE_NAME="chicken-herd-manager"
TAG="${TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Parse arguments
ENVIRONMENT="${1:-production}"
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
    log_error "Invalid environment: $ENVIRONMENT (use 'production' or 'staging')"
    exit 1
fi

log_info "Deploying Chicken Herd Manager to ${SERVER_HOST}"
log_info "Environment: ${ENVIRONMENT}"
log_info "Remote directory: ${REMOTE_APP_DIR}"

# Step 1: Prepare deployment files
log_info "Step 1/5: Preparing deployment files..."

# Step 2: Transfer files to server
log_info "Step 2/5: Transferring files to ${SERVER_HOST}..."

# Create remote directory for compose files (data uses Docker volume)
ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} << EOF
mkdir -p ${REMOTE_APP_DIR}
chmod 755 ${REMOTE_APP_DIR}
EOF

# Copy all necessary files to server
log_info "Copying deployment files..."
scp -P ${SERVER_PORT} \
    docker-compose.yml \
    Dockerfile \
    .dockerignore \
    package.json \
    package-lock.json \
    vite.config.mjs \
    index.html \
    nginx.conf \
    ${SERVER_USER}@${SERVER_HOST}:${REMOTE_APP_DIR}/

log_info "Copying server code..."
scp -P ${SERVER_PORT} -r \
    server/ \
    ${SERVER_USER}@${SERVER_HOST}:${REMOTE_APP_DIR}/

log_info "Copying frontend source..."
scp -P ${SERVER_PORT} -r \
    src/ \
    public/ \
    ${SERVER_USER}@${SERVER_HOST}:${REMOTE_APP_DIR}/

log_success "All files transferred to server"

# Step 3: Build and deploy on remote server
log_info "Step 3/5: Building Docker images and deploying on remote server..."

ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} << REMOTE_EOF
cd ${REMOTE_APP_DIR}

# Stop existing containers first
echo "Stopping existing containers..."
docker compose down || true

# Clean up orphaned container from old deployment
docker stop chicken-herd-manager 2>/dev/null || true
docker rm chicken-herd-manager 2>/dev/null || true

# Build Docker images on server
echo "Building Docker images on server (this may take a few minutes)..."
docker compose build --no-cache

# Start all services
echo "Starting all services..."
docker compose up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 20

# Check status
echo "Container status:"
docker compose ps

# Show recent logs
echo ""
echo "Recent logs:"
docker compose logs --tail=30
REMOTE_EOF

log_success "Deployment complete!"

# Final status check
log_info "Step 4/5: Checking deployment status..."
HEALTH_STATUS=$(ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \
    "docker inspect --format='{{.State.Health.Status}}' chicken-herd-frontend 2>/dev/null || echo 'unknown'")

if [[ "$HEALTH_STATUS" == "healthy" ]]; then
    log_success "Frontend service is healthy!"
elif [[ "$HEALTH_STATUS" == "starting" ]]; then
    log_warn "Service is starting, check again in a minute"
    log_info "Check logs with: ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs -f chicken-herd-frontend'"
else
    log_warn "Service status: ${HEALTH_STATUS}"
    log_info "Check logs with: ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs -f chicken-herd-frontend'"
fi

BACKEND_HEALTH=$(ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \
    "docker inspect --format='{{.State.Health.Status}}' chicken-herd-backend 2>/dev/null || echo 'unknown'")

if [[ "$BACKEND_HEALTH" == "healthy" ]]; then
    log_success "Backend service is healthy!"
else
    log_warn "Backend status: ${BACKEND_HEALTH}"
fi

# Step 5: Final summary
log_info "Step 5/5: Deployment summary..."

echo ""
log_success "🚀 Chicken Herd Manager deployed!"
echo ""
echo "Access the application at:"
echo "  🌐 https://soarpreme.eu/"
echo ""
echo "Useful commands:"
echo "  View all logs:     ssh ${SERVER_USER}@${SERVER_HOST} 'docker compose -C ${REMOTE_APP_DIR} logs -f'"
echo "  View frontend:     ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs -f chicken-herd-frontend'"
echo "  View backend:      ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs -f chicken-herd-backend'"
echo "  Restart:           ssh ${SERVER_USER}@${SERVER_HOST} 'docker compose -C ${REMOTE_APP_DIR} restart'"
echo "  Stop:              ssh ${SERVER_USER}@${SERVER_HOST} 'docker compose -C ${REMOTE_APP_DIR} down'"
echo "  Rebuild:           ssh ${SERVER_USER}@${SERVER_HOST} 'docker compose -C ${REMOTE_APP_DIR} build --no-cache && docker compose -C ${REMOTE_APP_DIR} up -d'"
echo ""
