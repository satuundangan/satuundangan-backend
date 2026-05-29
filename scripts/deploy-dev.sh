#!/usr/bin/env bash
# Deploy backend to VPS as dev server (port 3001)
set -e

VPS_USER=refda21
VPS_HOST=103.93.129.153
VPS_KEY=~/.ssh/id_ed25519_satuundangan
VPS_APP_DIR=~/apps/satu-undangan
IMAGE_NAME=satuundangan-backend-dev
DOCKER_REGISTRY=ghcr.io/satuundangan

echo "==> Building Docker image..."
docker build -t "$DOCKER_REGISTRY/$IMAGE_NAME:latest" .

echo "==> Pushing image to ghcr.io..."
docker push "$DOCKER_REGISTRY/$IMAGE_NAME:latest"

echo "==> Uploading docker-compose.dev.yml to VPS..."
scp -i "$VPS_KEY" docker-compose.dev.yml "$VPS_USER@$VPS_HOST:$VPS_APP_DIR/docker-compose.dev.yml"

echo "==> Restarting dev service on VPS..."
ssh -i "$VPS_KEY" "$VPS_USER@$VPS_HOST" "
  cd $VPS_APP_DIR
  docker compose -f docker-compose.dev.yml pull
  docker compose -f docker-compose.dev.yml up -d --force-recreate
  docker image prune -f
"

echo "==> Done! Dev backend running at http://$VPS_HOST:3001"
