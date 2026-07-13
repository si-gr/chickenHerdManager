#!/bin/bash
#
# Chicken Herd Manager - Auto Deploy Script
# Deploys to soarpreme.eu server via Docker Compose
#
# Usage: ./deploy.sh [production|staging]
#

set -e

# Configuration
SERVER_HOST="${DEPLOY_HOST:-soarpreme.eu}"
SERVER_USER="${DEPLOY_USER:-root}"
SERVER_PORT="${DEPLOY_PORT:-22}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/chicken-herd-manager}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
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

# Step 1: Build frontend
log_info "Step 1/6: Building frontend..."
npm run build
log_success "Frontend built successfully"

# Step 2: Run tests (optional, skip if no test suite)
log_info "Step 2/6: Running linting..."
if npm run lint -- --quiet; then
    log_success "Linting passed"
else
    log_warn "Linting found issues (continuing anyway)"
fi

# Step 3: Build Docker image
log_info "Step 3/6: Building Docker image..."
docker build -t ${IMAGE_NAME}:${TAG} .
log_success "Docker image built: ${IMAGE_NAME}:${TAG}"

# Step 4: Tag and push to registry (if configured)
if [[ -n "$DOCKER_REGISTRY" ]]; then
    log_info "Step 4/6: Pushing to registry ${DOCKER_REGISTRY}..."
    docker tag ${IMAGE_NAME}:${TAG} ${DOCKER_REGISTRY}/${IMAGE_NAME}:${TAG}
    docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:${TAG}
    log_success "Image pushed to registry"
else
    log_info "Step 4/6: Skipping registry push (no DOCKER_REGISTRY configured)"
    log_info "Will transfer image directly to server"
fi

# Step 5: Transfer files to server
log_info "Step 5/6: Transferring files to ${SERVER_HOST}..."

# Create remote directory if it doesn't exist
ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} << EOF
mkdir -p ${REMOTE_APP_DIR}/data
chmod 755 ${REMOTE_APP_DIR}
EOF

# Transfer Docker Compose file (create production version)
cat > docker-compose.prod.yml << EOF
services:
  chicken-herd-manager:
    image: \${DOCKER_REGISTRY:-}${IMAGE_NAME}:${TAG}
    container_name: chicken-herd-manager
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/server/data
    environment:
      - NODE_ENV=${ENVIRONMENT}
      - PORT=3001
      - DB_PATH=/app/server/data/chicken_herd.db
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/api/chickens"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - chicken-net

networks:
  chicken-net:
    driver: bridge
EOF

# Copy files to server
scp -P ${SERVER_PORT} \
    docker-compose.prod.yml \
    Dockerfile \
    .dockerignore \
    package.json \
    package-lock.json \
    ${SERVER_USER}@${SERVER_HOST}:${REMOTE_APP_DIR}/

scp -P ${SERVER_PORT} -r \
    server/ \
    dist/ \
    ${SERVER_USER}@${SERVER_HOST}:${REMOTE_APP_DIR}/

# If not using registry, save and transfer Docker image
if [[ -z "$DOCKER_REGISTRY" ]]; then
    log_info "Saving Docker image for transfer..."
    docker save ${IMAGE_NAME}:${TAG} | gzip > /tmp/${IMAGE_NAME}-${TAG}.tar.gz
    
    log_info "Transferring Docker image (this may take a while)..."
    scp -P ${SERVER_PORT} /tmp/${IMAGE_NAME}-${TAG}.tar.gz ${SERVER_USER}@${SERVER_HOST}:${REMOTE_APP_DIR}/
    
    rm /tmp/${IMAGE_NAME}-${TAG}.tar.gz
fi

log_success "Files transferred to server"

# Step 6: Deploy on remote server
log_info "Step 6/6: Deploying on remote server..."

ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} << REMOTE_EOF
cd ${REMOTE_APP_DIR}

# Load Docker image if transferred
if [ -f "${IMAGE_NAME}-${TAG}.tar.gz" ]; then
    echo "Loading Docker image..."
    gunzip -c ${IMAGE_NAME}-${TAG}.tar.gz | docker load
    rm ${IMAGE_NAME}-${TAG}.tar.gz
fi

# Stop existing container
echo "Stopping existing container..."
docker compose -f docker-compose.prod.yml down || true

# Pull image if using registry
if [ -n "${DOCKER_REGISTRY}" ]; then
    echo "Pulling latest image..."
    docker compose -f docker-compose.prod.yml pull
fi

# Start new container
echo "Starting new container..."
docker compose -f docker-compose.prod.yml up -d

# Wait for health check
echo "Waiting for service to be healthy..."
sleep 10

# Check status
docker compose -f docker-compose.prod.yml ps

# Show logs
echo ""
echo "Recent logs:"
docker compose -f docker-compose.prod.yml logs --tail=20
REMOTE_EOF

log_success "Deployment complete!"

# Cleanup local temp file
rm -f docker-compose.prod.yml

# Final status check
log_info "Checking deployment status..."
HEALTH_STATUS=$(ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_HOST} \
    "docker inspect --format='{{.State.Health.Status}}' chicken-herd-manager 2>/dev/null || echo 'unknown'")

if [[ "$HEALTH_STATUS" == "healthy" ]]; then
    log_success "Service is healthy!"
else
    log_warn "Service status: ${HEALTH_STATUS}"
    log_info "Check logs with: ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs chicken-herd-manager'"
fi

echo ""
log_success "🚀 Chicken Herd Manager deployed to http://${SERVER_HOST}:3001"
echo ""
echo "Useful commands:"
echo "  View logs:     ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs -f chicken-herd-manager'"
echo "  Restart:       ssh ${SERVER_USER}@${SERVER_HOST} 'docker compose -C ${REMOTE_APP_DIR} -f docker-compose.prod.yml restart'"
echo "  Stop:          ssh ${SERVER_USER}@${SERVER_HOST} 'docker compose -C ${REMOTE_APP_DIR} -f docker-compose.prod.yml down'"
echo ""
