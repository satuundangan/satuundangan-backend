#!/usr/bin/env bash
# ==============================================================================
# SatuUndangan Automated Database Backup Script
# Dumps MySQL from Docker container, compresses with gzip, and enforces 2-day local retention.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$HOME/apps/satu-undangan}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
CONTAINER_NAME="${DB_CONTAINER:-satu-undangan-db}"
DB_NAME="${DB_NAME:-satu_undangan_db}"
RETENTION_DAYS=2

mkdir -p "$BACKUP_DIR"

# 1. Retrieve MySQL Root Password from container or .env
DB_PASS="${MYSQL_ROOT_PASSWORD:-}"
if [ -z "$DB_PASS" ] && [ -f "$APP_DIR/.env" ]; then
  DB_PASS=$(grep -E "^DB_PASSWORD=" "$APP_DIR/.env" | cut -d '=' -f2- | tr -d '"'\'' ' || true)
fi
if [ -z "$DB_PASS" ]; then
  # Fallback: extract from container env
  DB_PASS=$(docker inspect "$CONTAINER_NAME" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -E '^MYSQL_ROOT_PASSWORD=' | cut -d '=' -f2- || true)
fi

if [ -z "$DB_PASS" ]; then
  echo "❌ Error: MySQL root password could not be determined." >&2
  exit 1
fi

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILENAME="backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "📦 [1/3] Starting database dump for '${DB_NAME}'..."
START_TIME=$(date +%s)

docker exec "$CONTAINER_NAME" mysqldump \
  -u root \
  -p"${DB_PASS}" \
  --databases "${DB_NAME}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  2>/dev/null | gzip -9 > "${BACKUP_FILEPATH}"

# Verify backup file integrity
if ! gzip -t "${BACKUP_FILEPATH}"; then
  echo "❌ Error: Backup file is corrupted or empty!" >&2
  rm -f "${BACKUP_FILEPATH}"
  exit 1
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
FILE_SIZE_BYTES=$(wc -c < "${BACKUP_FILEPATH}")
FILE_SIZE_HUMAN=$(du -h "${BACKUP_FILEPATH}" | cut -f1)

echo "✅ [2/3] Backup completed in ${DURATION}s! Size: ${FILE_SIZE_HUMAN} (${FILE_SIZE_BYTES} bytes)"
echo "FILE_NAME=${BACKUP_FILENAME}"
echo "FILE_PATH=${BACKUP_FILEPATH}"
echo "FILE_SIZE=${FILE_SIZE_HUMAN}"
echo "DURATION=${DURATION}"

# 2. Local retention: remove backups older than 2 days, keeping at least the latest 2
echo "🧹 [3/3] Rotating local backups (keeping last ${RETENTION_DAYS} days)..."
# Find and delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -type f -name "backup_${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete || true

# Always ensure at least the newest 2 backups remain
REMAINING_COUNT=$(find "$BACKUP_DIR" -type f -name "backup_${DB_NAME}_*.sql.gz" | wc -l)
echo "📁 Active backups in ${BACKUP_DIR}: ${REMAINING_COUNT} file(s)"
